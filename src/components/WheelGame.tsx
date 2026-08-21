import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface WheelGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
// mesma ordem/valores do SQL (0013_roda_dados.sql) — só pra desenhar a roda
const SEGMENTS = [0, 0.5, 1, 1.5, 2, 3, 10, 16];

export function WheelGame({ credits, onBalanceChange, onWin }: WheelGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [resultMultiplier, setResultMultiplier] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handleSpin = useCallback(async () => {
    if (spinning || credits < betAmount) return;

    setSpinning(true);
    setPlayError(null);
    setLastPayout(null);
    setResultMultiplier(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_wheel', { bet_amount: betAmount });

    if (error || !data) {
      setSpinning(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível girar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 1400));

    setResultMultiplier(data.multiplier);
    setSpinning(false);
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
  }, [betAmount, credits, onBalanceChange, onWin, spinning]);

  const canDecreaseBet = betIndex > 0 && !spinning;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !spinning;
  const canSpin = !spinning && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🎡 Roda da Sorte do Tigre</h2>

      <div className={`wheel-stage ${spinning ? 'wheel-stage--spinning' : ''}`}>
        <div className="wheel-disc">
          {SEGMENTS.map((v) => (
            <span key={v} className="wheel-disc__segment">
              {v}x
            </span>
          ))}
        </div>
        <div className="wheel-pointer">🐯</div>
      </div>

      <div className="payout-line" aria-live="polite">
        {playError
          ? playError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : resultMultiplier !== null
              ? `Caiu em ${resultMultiplier}x`
              : ' '}
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

        <button className="spin-btn" onClick={handleSpin} disabled={!canSpin}>
          {spinning ? 'Girando…' : 'Girar'}
        </button>
      </div>
    </div>
  );
}
