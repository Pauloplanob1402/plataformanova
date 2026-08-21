import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface DiceGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

type BetRange = 'low' | 'seven' | 'high';

const BET_STEPS = [5, 10, 25, 50, 100];

const BET_OPTIONS: { id: BetRange; label: string; payout: string }[] = [
  { id: 'low', label: 'Baixo (2-6)', payout: 'ganha 2.25x' },
  { id: 'seven', label: 'Sete', payout: 'ganha 5.6x' },
  { id: 'high', label: 'Alto (8-12)', payout: 'ganha 2.25x' },
];

function DiceFace({ value }: { value: number | null }) {
  return <div className="dice-face">{value ?? '?'}</div>;
}

export function DiceGame({ credits, onBalanceChange, onWin }: DiceGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [choice, setChoice] = useState<BetRange>('low');
  const [playing, setPlaying] = useState(false);
  const [die1, setDie1] = useState<number | null>(null);
  const [die2, setDie2] = useState<number | null>(null);
  const [range, setRange] = useState<BetRange | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setDie1(null);
    setDie2(null);
    setRange(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_dice', { bet_amount: betAmount, choice });

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

    setDie1(data.die1);
    setDie2(data.die2);
    setRange(data.range as BetRange);
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
  const sum = die1 !== null && die2 !== null ? die1 + die2 : null;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🎲 Dados do Tigre</h2>

      <div className="dice-stage">
        <DiceFace value={die1} />
        <DiceFace value={die2} />
        {sum !== null && <div className="dice-sum">= {sum}</div>}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : ' '}
      </div>

      <div className="dragon-tiger-bets">
        {BET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dragon-tiger-bet ${choice === opt.id ? 'dragon-tiger-bet--active' : ''} ${range === opt.id ? 'dragon-tiger-bet--result' : ''}`}
            onClick={() => setChoice(opt.id)}
            disabled={playing}
          >
            {choice === opt.id && <span className="dragon-tiger-bet__check">✓</span>}
            <span className="dragon-tiger-bet__name">{opt.label}</span>
            <span className="dragon-tiger-bet__payout">{opt.payout}</span>
          </button>
        ))}
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
          {playing ? 'Rolando…' : 'Rolar'}
        </button>
      </div>
    </div>
  );
}
