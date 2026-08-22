import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface PlinkoGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const SLOT_MULTIPLIERS = [14, 3.5, 1.4, 0.5, 0.3, 0.5, 1.4, 3.5, 14];

export function PlinkoGame({ credits, onBalanceChange, onWin }: PlinkoGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [dropping, setDropping] = useState(false);
  const [finalSlot, setFinalSlot] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handleDrop = useCallback(async () => {
    if (dropping || credits < betAmount) return;

    setDropping(true);
    setPlayError(null);
    setLastPayout(null);
    setFinalSlot(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_plinko', { bet_amount: betAmount });

    if (error || !data) {
      setDropping(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));

    setFinalSlot(data.slot);
    setDropping(false);
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
  }, [betAmount, credits, dropping, onBalanceChange, onWin]);

  const canDecreaseBet = betIndex > 0 && !dropping;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !dropping;
  const canPlay = !dropping && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🏮 Plinko do Tigre</h2>

      <div className="plinko-slots">
        {SLOT_MULTIPLIERS.map((m, i) => (
          <div key={i} className={`plinko-slot ${finalSlot === i ? 'plinko-slot--hit' : ''}`}>
            {m}x
          </div>
        ))}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : ' '}
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

        <button className="spin-btn" onClick={handleDrop} disabled={!canPlay}>
          {dropping ? 'Caindo…' : 'Soltar bolinha'}
        </button>
      </div>
    </div>
  );
}
