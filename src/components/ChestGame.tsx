import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface ChestGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];

export function ChestGame({ credits, onBalanceChange, onWin }: ChestGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [values, setValues] = useState<(number | null)[]>([null, null, null]);
  const [chosenIndex, setChosenIndex] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePick = useCallback(
    async (index: number) => {
      if (playing || credits < betAmount) return;

      setPlaying(true);
      setPlayError(null);
      setLastPayout(null);
      setValues([null, null, null]);
      setChosenIndex(index);

      try {
        soundEngine.click();
      } catch {
        // som nunca deve travar o jogo
      }

      const { data, error } = await supabase.rpc('play_chest', { bet_amount: betAmount, choice: index + 1 });

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

      setValues(data.chest_values);
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
    },
    [betAmount, credits, onBalanceChange, onWin, playing],
  );

  const canDecreaseBet = betIndex > 0 && !playing;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !playing;
  const canPlay = !playing && credits >= betAmount;
  const revealed = values[0] !== null;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🧧 Baú do Tigre</h2>

      <div className="chest-row">
        {[0, 1, 2].map((i) => {
          const isChosen = chosenIndex === i;
          const value = values[i];
          return (
            <button
              key={i}
              type="button"
              className={`chest-box ${isChosen ? 'chest-box--chosen' : ''} ${revealed && !isChosen ? 'chest-box--other' : ''}`}
              onClick={() => handlePick(i)}
              disabled={!canPlay}
            >
              {value !== null ? (
                <span className="chest-box__value">{value}x</span>
              ) : (
                <span className="chest-box__icon">🧧</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : 'Toque num baú pra abrir'}
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
      </div>
    </div>
  );
}
