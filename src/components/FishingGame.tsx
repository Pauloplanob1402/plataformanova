import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface FishingGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];

export function FishingGame({ credits, onBalanceChange, onWin }: FishingGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [casting, setCasting] = useState(false);
  const [caughtMultiplier, setCaughtMultiplier] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handleCast = useCallback(async () => {
    if (casting || credits < betAmount) return;

    setCasting(true);
    setPlayError(null);
    setLastPayout(null);
    setCaughtMultiplier(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_fishing', { bet_amount: betAmount });

    if (error || !data) {
      setCasting(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 900));

    setCaughtMultiplier(data.multiplier);
    setCasting(false);
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
  }, [betAmount, casting, credits, onBalanceChange, onWin]);

  const canDecreaseBet = betIndex > 0 && !casting;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !casting;
  const canPlay = !casting && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🎣 Pesca do Tigre</h2>

      <div className={`fishing-pond ${casting ? 'fishing-pond--casting' : ''}`}>
        <div className="fishing-pond__catch">
          {caughtMultiplier !== null ? (caughtMultiplier > 0 ? '🐟' : '🌊') : '🎣'}
        </div>
      </div>

      <div className="payout-line" aria-live="polite">
        {playError
          ? playError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : caughtMultiplier !== null
              ? `Fisgou ${caughtMultiplier}x`
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

        <button className="spin-btn" onClick={handleCast} disabled={!canPlay}>
          {casting ? 'Pescando…' : 'Pescar'}
        </button>
      </div>
    </div>
  );
}
