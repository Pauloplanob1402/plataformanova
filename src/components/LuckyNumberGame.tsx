import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface LuckyNumberGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1);

export function LuckyNumberGame({ credits, onBalanceChange, onWin }: LuckyNumberGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [choice, setChoice] = useState(7);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setResult(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_lucky_number', { bet_amount: betAmount, choice });

    if (error || !data) {
      setPlaying(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 500));

    setResult(data.result);
    setPlaying(false);
    onBalanceChange(data.new_balance);

    try {
      soundEngine.reelStop();
    } catch {
      // ignora falha de áudio
    }

    if (data.payout > 0) {
      setLastPayout(data.payout);
      onWin(data.payout);
      try {
        soundEngine.win(data.payout / betAmount);
      } catch {
        // ignora falha de áudio
      }
    }
  }, [betAmount, choice, credits, onBalanceChange, onWin, playing]);

  const canDecreaseBet = betIndex > 0 && !playing;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !playing;
  const canPlay = !playing && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🏮 Número da Sorte</h2>

      <div className="lucky-number-grid">
        {NUMBERS.map((n) => {
          const isChoice = choice === n;
          const isResult = result === n;
          return (
            <button
              key={n}
              type="button"
              className={`lucky-number-cell ${isChoice ? 'lucky-number-cell--chosen' : ''} ${isResult ? 'lucky-number-cell--result' : ''}`}
              onClick={() => setChoice(n)}
              disabled={playing}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : `Escolhido: ${choice} · acerta e ganha 9.4x`}
      </div>

      <div className="controls">
        <div className="bet-control">
          <button className="bet-btn" onClick={() => setBetIndex((i) => Math.max(0, i - 1))} disabled={!canDecreaseBet} aria-label="Diminuir aposta">
            −
          </button>
          <div className="bet-amount">
            <span className="bet-amount__label">Aposta</span>
            <span className="bet-amount__value">{betAmount}</span>
          </div>
          <button className="bet-btn" onClick={() => setBetIndex((i) => Math.min(BET_STEPS.length - 1, i + 1))} disabled={!canIncreaseBet} aria-label="Aumentar aposta">
            +
          </button>
        </div>

        <button className="spin-btn" onClick={handlePlay} disabled={!canPlay}>
          {playing ? 'Girando…' : 'Girar'}
        </button>
      </div>
    </div>
  );
}
