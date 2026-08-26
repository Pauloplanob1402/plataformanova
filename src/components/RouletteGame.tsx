import { useCallback, useState } from 'react';
import thumbRoleta from '../assets/thumb-roleta.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface RouletteGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
  onRequestDeposit: () => void;
}

type BetType = 'straight' | 'red' | 'black' | 'even' | 'odd' | 'low' | 'high';

const BET_STEPS = [5, 10, 25, 50, 100];

const OUTSIDE_BETS: { id: BetType; label: string }[] = [
  { id: 'red', label: '🔴 Vermelho' },
  { id: 'black', label: '⚫ Preto' },
  { id: 'even', label: 'Par' },
  { id: 'odd', label: 'Ímpar' },
  { id: 'low', label: '1-18' },
  { id: 'high', label: '19-36' },
];

export function RouletteGame({ credits, onBalanceChange, onWin, onRequestDeposit }: RouletteGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [betType, setBetType] = useState<BetType>('red');
  const [straightNumber, setStraightNumber] = useState(7);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ number: number; color: string } | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handleSpin = useCallback(async () => {
    if (spinning) return;
    if (credits < betAmount) {
      onRequestDeposit();
      return;
    }

    setSpinning(true);
    setPlayError(null);
    setLastPayout(null);
    setResult(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_roulette', {
      bet_amount: betAmount,
      bet_type: betType,
      bet_value: betType === 'straight' ? straightNumber : null,
    });

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

    setResult({ number: data.winning_number, color: data.color });
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
    } else {
      try {
        soundEngine.lose();
      } catch {
        // ignora falha de áudio
      }
    }
  }, [betAmount, betType, straightNumber, credits, onBalanceChange, onWin, spinning]);

  const canDecreaseBet = betIndex > 0 && !spinning;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !spinning;
  const canSpin = !spinning && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title panel-card__title--icon"><img src={thumbRoleta} alt="" className="panel-card__title-icon" /> Roleta da Fortuna</h2>

      <div className={`roulette-result ${spinning ? 'roulette-result--spinning' : ''}`}>
        <div className={`roulette-result__ball ${result ? `roulette-result__ball--${result.color}` : ''}`}>
          {result ? result.number : '?'}
        </div>
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : ' '}
      </div>

      <div className="deposit-quick-amounts">
        {OUTSIDE_BETS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`bet-btn deposit-quick-amounts__btn ${betType === opt.id ? 'tab--active' : ''}`}
            onClick={() => setBetType(opt.id)}
            disabled={spinning}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          className={`bet-btn deposit-quick-amounts__btn ${betType === 'straight' ? 'tab--active' : ''}`}
          onClick={() => setBetType('straight')}
          disabled={spinning}
        >
          Número (36x)
        </button>
      </div>

      {betType === 'straight' && (
        <label className="auth-field">
          <span>Número (0-36)</span>
          <input
            type="number"
            min={0}
            max={36}
            value={straightNumber}
            onChange={(e) => setStraightNumber(Math.max(0, Math.min(36, Number(e.target.value) || 0)))}
            disabled={spinning}
          />
        </label>
      )}

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
