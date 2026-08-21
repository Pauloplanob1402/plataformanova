import { useCallback, useState } from 'react';
import coinImg from '../assets/symbol-coin.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface CoinFlipGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

type Side = 'heads' | 'tails';

const BET_STEPS = [5, 10, 25, 50, 100];

export function CoinFlipGame({ credits, onBalanceChange, onWin }: CoinFlipGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [choice, setChoice] = useState<Side>('heads');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<Side | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setFlipping(true);
    setPlayError(null);
    setLastPayout(null);
    setResult(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_coin_flip', { bet_amount: betAmount, choice });

    if (error || !data) {
      setPlaying(false);
      setFlipping(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 700));

    const typedResult = data.result as Side;
    setResult(typedResult);
    setFlipping(false);
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
      <h2 className="panel-card__title panel-card__title--icon">
        <img src={coinImg} alt="" className="panel-card__title-icon" /> Moeda do Tigre
      </h2>

      <div className={`coin-flip-stage ${flipping ? 'coin-flip-stage--flipping' : ''}`}>
        <div className={`coin-flip-coin ${result ? `coin-flip-coin--${result}` : ''}`}>
          {result === 'heads' ? '🐯' : result === 'tails' ? '🧧' : '?'}
        </div>
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : ' '}
      </div>

      <div className="dragon-tiger-bets" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <button
          type="button"
          className={`dragon-tiger-bet ${choice === 'heads' ? 'dragon-tiger-bet--active' : ''}`}
          onClick={() => setChoice('heads')}
          disabled={playing}
        >
          {choice === 'heads' && <span className="dragon-tiger-bet__check">✓</span>}
          <span className="dragon-tiger-bet__name">🐯 Tigre</span>
          <span className="dragon-tiger-bet__payout">ganha 1.9x</span>
        </button>
        <button
          type="button"
          className={`dragon-tiger-bet ${choice === 'tails' ? 'dragon-tiger-bet--active' : ''}`}
          onClick={() => setChoice('tails')}
          disabled={playing}
        >
          {choice === 'tails' && <span className="dragon-tiger-bet__check">✓</span>}
          <span className="dragon-tiger-bet__name">🧧 Sorte</span>
          <span className="dragon-tiger-bet__payout">ganha 1.9x</span>
        </button>
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
          {playing ? 'Jogando…' : 'Jogar'}
        </button>
      </div>
    </div>
  );
}
