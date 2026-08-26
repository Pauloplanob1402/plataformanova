import { useCallback, useState } from 'react';
import thumbBatalha from '../assets/thumb-batalha.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface BaccaratGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
  onRequestDeposit: () => void;
}

type BetType = 'player' | 'banker' | 'tie';

const BET_STEPS = [5, 10, 25, 50, 100];

const BET_OPTIONS: { id: BetType; label: string; payout: string }[] = [
  { id: 'player', label: '🧑 Jogador', payout: 'ganha 2.12x' },
  { id: 'tie', label: '🤝 Empate', payout: 'ganha 8x' },
  { id: 'banker', label: '🏦 Banca', payout: 'ganha 2.12x' },
];

export function BaccaratGame({ credits, onBalanceChange, onWin, onRequestDeposit }: BaccaratGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [betType, setBetType] = useState<BetType>('player');
  const [playing, setPlaying] = useState(false);
  const [playerHand, setPlayerHand] = useState<number | null>(null);
  const [bankerHand, setBankerHand] = useState<number | null>(null);
  const [winner, setWinner] = useState<BetType | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing) return;
    if (credits < betAmount) {
      onRequestDeposit();
      return;
    }

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setWinner(null);
    setPlayerHand(null);
    setBankerHand(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_baccarat', { bet_amount: betAmount, bet_type: betType });

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

    setPlayerHand(data.player_hand);
    setBankerHand(data.banker_hand);
    setWinner(data.winner as BetType);
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
    } else {
      try {
        soundEngine.lose();
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
      <h2 className="panel-card__title panel-card__title--icon"><img src={thumbBatalha} alt="" className="panel-card__title-icon" /> Batalha do Tigre</h2>

      <div className="dragon-tiger-table">
        <div className={`dragon-tiger-card ${winner === 'player' ? 'dragon-tiger-card--win' : ''} ${winner && winner !== 'player' ? 'dragon-tiger-card--lose' : ''}`}>
          <span className="dragon-tiger-card__label">Jogador</span>
          <div className="dragon-tiger-card__face">{playerHand ?? '?'}</div>
        </div>

        <span style={{ fontSize: 20 }}>🆚</span>

        <div className={`dragon-tiger-card ${winner === 'banker' ? 'dragon-tiger-card--win' : ''} ${winner && winner !== 'banker' ? 'dragon-tiger-card--lose' : ''}`}>
          <span className="dragon-tiger-card__label">Banca</span>
          <div className="dragon-tiger-card__face">{bankerHand ?? '?'}</div>
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
