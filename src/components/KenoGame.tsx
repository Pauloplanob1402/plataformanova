import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface KenoGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const NUMBERS = Array.from({ length: 40 }, (_, i) => i + 1);
const PICKS_NEEDED = 5;

export function KenoGame({ credits, onBalanceChange, onWin }: KenoGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const togglePick = (n: number) => {
    if (playing) return;
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((p) => p !== n);
      if (prev.length >= PICKS_NEEDED) return prev;
      return [...prev, n];
    });
  };

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount || picks.length !== PICKS_NEEDED) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setDrawn([]);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_keno', { bet_amount: betAmount, picks });

    if (error || !data) {
      setPlaying(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 600));

    setDrawn(data.drawn);
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
  }, [betAmount, credits, onBalanceChange, onWin, picks, playing]);

  const canDecreaseBet = betIndex > 0 && !playing;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !playing;
  const canPlay = !playing && credits >= betAmount && picks.length === PICKS_NEEDED;
  const hits = drawn.length ? picks.filter((p) => drawn.includes(p)).length : null;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🎋 Keno do Tigre</h2>

      <div className="keno-grid">
        {NUMBERS.map((n) => {
          const isPicked = picks.includes(n);
          const isDrawn = drawn.includes(n);
          const isHit = isPicked && isDrawn;
          return (
            <button
              key={n}
              type="button"
              className={`keno-cell ${isPicked ? 'keno-cell--picked' : ''} ${isDrawn ? 'keno-cell--drawn' : ''} ${isHit ? 'keno-cell--hit' : ''}`}
              onClick={() => togglePick(n)}
              disabled={playing}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError
          ? playError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : hits !== null
              ? `${hits} de 5 acertos`
              : `Escolha ${PICKS_NEEDED} números (${picks.length}/${PICKS_NEEDED})`}
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
          {playing ? 'Sorteando…' : 'Jogar'}
        </button>
      </div>
    </div>
  );
}
