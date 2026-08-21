import { useCallback, useState } from 'react';
import mascoteTigre from '../assets/mascote-tigre.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface DragonTigerGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

type BetType = 'dragon' | 'tiger' | 'tie';

interface PlayResult {
  dragon_card: number;
  tiger_card: number;
  winner: BetType;
  payout: number;
  new_balance: number;
}

const BET_STEPS = [5, 10, 25, 50, 100];

const BET_OPTIONS: { id: BetType; label: string; payout: string }[] = [
  { id: 'dragon', label: '🐉 Dragão', payout: 'ganha 2x' },
  { id: 'tie', label: '🤝 Empate', payout: 'ganha 9x' },
  { id: 'tiger', label: '🐯 Tigre', payout: 'ganha 2x' },
];

function cardLabel(value: number): string {
  return String(value);
}

export function DragonTigerGame({ credits, onBalanceChange, onWin }: DragonTigerGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [betType, setBetType] = useState<BetType>('dragon');
  const [playing, setPlaying] = useState(false);
  const [dragonCard, setDragonCard] = useState<number | null>(null);
  const [tigerCard, setTigerCard] = useState<number | null>(null);
  const [winner, setWinner] = useState<BetType | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setWinner(null);
    setDragonCard(null);
    setTigerCard(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_dragon_tiger', {
      bet_amount: betAmount,
      bet_type: betType,
    });

    if (error || !data) {
      setPlaying(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    const result = data as PlayResult;

    // pequena pausa pra "revelar" as cartas com suspense
    await new Promise((r) => setTimeout(r, 500));

    setDragonCard(result.dragon_card);
    setTigerCard(result.tiger_card);
    setWinner(result.winner);
    setPlaying(false);
    onBalanceChange(result.new_balance);

    try {
      soundEngine.reelStop();
    } catch {
      // ignora falha de áudio
    }

    if (result.payout > 0) {
      setLastPayout(result.payout);
      onWin(result.payout);
      try {
        soundEngine.win(result.payout / betAmount);
      } catch {
        // ignora falha de áudio
      }
    }
  }, [betAmount, betType, credits, onBalanceChange, onWin, playing]);

  const canDecreaseBet = betIndex > 0 && !playing;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !playing;
  const canPlay = !playing && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🐉 Dragão vs Tigre 🐯</h2>

      <div className="dragon-tiger-table">
        <div
          className={`dragon-tiger-card ${winner === 'dragon' ? 'dragon-tiger-card--win' : ''} ${winner && winner !== 'dragon' ? 'dragon-tiger-card--lose' : ''}`}
        >
          <span className="dragon-tiger-card__label">Dragão</span>
          <div className="dragon-tiger-card__face">{dragonCard ? cardLabel(dragonCard) : '?'}</div>
        </div>

        <img src={mascoteTigre} alt="" className="dragon-tiger-table__mascot" />

        <div
          className={`dragon-tiger-card ${winner === 'tiger' ? 'dragon-tiger-card--win' : ''} ${winner && winner !== 'tiger' ? 'dragon-tiger-card--lose' : ''}`}
        >
          <span className="dragon-tiger-card__label">Tigre</span>
          <div className="dragon-tiger-card__face">{tigerCard ? cardLabel(tigerCard) : '?'}</div>
        </div>
      </div>

      <div className="payout-line" aria-live="polite">
        {playError ? playError : lastPayout ? `+${lastPayout} créditos!` : winner === 'tie' ? 'Empate!' : ' '}
      </div>

      <div className="dragon-tiger-bets">
        {BET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`dragon-tiger-bet ${betType === opt.id ? 'dragon-tiger-bet--active' : ''}`}
            onClick={() => setBetType(opt.id)}
            disabled={playing}
          >
            {betType === opt.id && <span className="dragon-tiger-bet__check">✓</span>}
            <span className="dragon-tiger-bet__name">{opt.label}</span>
            <span className="dragon-tiger-bet__payout">{opt.payout}</span>
          </button>
        ))}
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

        <button className="spin-btn" onClick={handlePlay} disabled={!canPlay}>
          {playing ? 'Revelando…' : 'Jogar'}
        </button>
      </div>
    </div>
  );
}
