import { useCallback, useState } from 'react';
import { SYMBOL_IMAGES } from '../symbols/images';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface ScratchGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const CELL_COUNT = 9;

function emptyGrid(): (string | null)[] {
  return Array.from({ length: CELL_COUNT }, () => null);
}

export function ScratchGame({ credits, onBalanceChange, onWin }: ScratchGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [grid, setGrid] = useState<(string | null)[]>(emptyGrid());
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [bought, setBought] = useState(false);

  const betAmount = BET_STEPS[betIndex];

  const handleBuy = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setGrid(emptyGrid());
    setBought(true);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_scratch', { bet_amount: betAmount });

    if (error || !data) {
      setPlaying(false);
      setBought(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    // guarda o resultado já pronto — a "raspagem" só revela célula por célula visualmente
    const finalGrid: string[] = data.grid;
    setPlaying(false);
    onBalanceChange(data.new_balance);

    // revela célula por célula, como se estivesse raspando
    for (let i = 0; i < CELL_COUNT; i++) {
      await new Promise((r) => setTimeout(r, 90));
      setGrid((prev) => {
        const next = [...prev];
        next[i] = finalGrid[i];
        return next;
      });
    }

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
  }, [betAmount, credits, onBalanceChange, onWin, playing]);

  const canDecreaseBet = betIndex > 0 && !playing;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !playing;
  const canPlay = !playing && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🧾 Raspadinha do Tigre</h2>

      <div className="scratch-grid">
        {grid.map((symbolId, i) => (
          <div key={i} className={`scratch-cell ${symbolId ? 'scratch-cell--revealed' : ''}`}>
            {symbolId && symbolId !== 'blank' && <img src={SYMBOL_IMAGES[symbolId]} alt={symbolId} />}
          </div>
        ))}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : bought ? ' ' : '3 iguais na cartela pagam'}
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

        <button className="spin-btn" onClick={handleBuy} disabled={!canPlay}>
          {playing ? 'Raspando…' : 'Comprar cartela'}
        </button>
      </div>
    </div>
  );
}
