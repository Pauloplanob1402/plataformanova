import { useCallback, useRef, useState } from 'react';
import coinImg from '../assets/symbol-coin.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface HoldWinGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

interface SpinFrame {
  cells: (number | null)[];
}

interface SpinHoldWinResult {
  frames: SpinFrame[];
  feature_triggered: boolean;
  full_grid: boolean;
  coin_count: number;
  payout: number;
  new_balance: number;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const FRAME_DELAY_MS = 550;
const CELL_COUNT = 15;

function emptyCells(): (number | null)[] {
  return Array.from({ length: CELL_COUNT }, () => null);
}

export function HoldWinGame({ credits, onBalanceChange, onWin }: HoldWinGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [cells, setCells] = useState<(number | null)[]>(emptyCells());
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [featureActive, setFeatureActive] = useState(false);
  const timeoutIdsRef = useRef<number[]>([]);

  const betAmount = BET_STEPS[betIndex];

  const clearTimers = useCallback(() => {
    timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutIdsRef.current = [];
  }, []);

  const playFrames = useCallback((frames: SpinFrame[]): Promise<void> => {
    return new Promise((resolve) => {
      let idx = 0;
      const step = () => {
        const frame = frames[idx];
        if (!frame) {
          resolve();
          return;
        }
        setCells(frame.cells);
        try {
          soundEngine.reelStop();
        } catch {
          // ignora falha de áudio
        }
        idx += 1;
        const timeoutId = window.setTimeout(step, FRAME_DELAY_MS);
        timeoutIdsRef.current.push(timeoutId);
      };
      step();
    });
  }, []);

  const handleSpin = useCallback(async () => {
    if (spinning || credits < betAmount) return;

    clearTimers();
    setSpinError(null);
    setLastPayout(null);
    setStatusMessage(null);
    setFeatureActive(false);
    setCells(emptyCells());
    setSpinning(true);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('spin_hold_win', { bet_amount: betAmount });

    if (error || !data) {
      setSpinning(false);
      setSpinError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível girar agora. Tente novamente.',
      );
      return;
    }

    const result = data as SpinHoldWinResult;

    // 1º frame = giro inicial normal
    await playFrames([result.frames[0]]);

    if (result.feature_triggered) {
      setFeatureActive(true);
      setStatusMessage('🪙 Moedas do Tigre ativado! Girando as células vazias...');
      await playFrames(result.frames.slice(1));
      setFeatureActive(false);
    }

    setSpinning(false);
    onBalanceChange(result.new_balance);

    if (result.payout > 0) {
      setLastPayout(result.payout);
      onWin(result.payout);
      if (result.full_grid) {
        setStatusMessage('🐯 GRADE CHEIA! Prêmio máximo!');
      } else {
        setStatusMessage(null);
      }
      try {
        soundEngine.win(result.payout / betAmount);
      } catch {
        // ignora falha de áudio
      }
    } else if (!result.feature_triggered) {
      setStatusMessage(null);
    }
  }, [betAmount, clearTimers, credits, onBalanceChange, onWin, playFrames, spinning]);

  const canDecreaseBet = betIndex > 0 && !spinning;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !spinning;
  const canSpin = !spinning && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🪙 Moedas do Tigre</h2>
      <p className="panel-card__subtitle">
        6 ou mais moedas na grade ativam o recurso: elas travam e o resto gira de novo até fechar a grade ou as vidas
        acabarem. O prêmio é a soma de todas as moedas travadas.
      </p>

      <div className={`hold-win-grid ${featureActive ? 'hold-win-grid--feature' : ''}`}>
        {cells.map((value, i) => (
          <div key={i} className={`hold-win-cell ${value !== null ? 'hold-win-cell--coin' : ''}`}>
            {value !== null && (
              <>
                <img src={coinImg} alt="Moeda" />
                <span className="hold-win-cell__value">{value}x</span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="payout-line" aria-live="polite">
        {spinError ? spinError : statusMessage ? statusMessage : lastPayout ? `+${lastPayout} créditos!` : ' '}
      </div>

      <div className="controls">
        <div className="bet-control">
          <button
            className="bet-btn"
            onClick={() => setBetIndex((i) => Math.max(0, i - 1))}
            disabled={!canDecreaseBet}
            aria-label="Diminuir aposta"
          >
            −
          </button>
          <div className="bet-amount">
            <span className="bet-amount__label">Aposta</span>
            <span className="bet-amount__value">{betAmount}</span>
          </div>
          <button
            className="bet-btn"
            onClick={() => setBetIndex((i) => Math.min(BET_STEPS.length - 1, i + 1))}
            disabled={!canIncreaseBet}
            aria-label="Aumentar aposta"
          >
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
