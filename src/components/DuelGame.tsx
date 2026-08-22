import { useCallback, useState } from 'react';
import mascoteTigre from '../assets/mascote-tigre.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface DuelGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];

export function DuelGame({ credits, onBalanceChange, onWin }: DuelGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [playerDie, setPlayerDie] = useState<number | null>(null);
  const [tigerDie, setTigerDie] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<'win' | 'tie' | 'lose' | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setPlayerDie(null);
    setTigerDie(null);
    setOutcome(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_duel', { bet_amount: betAmount });

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

    setPlayerDie(data.player_die);
    setTigerDie(data.tiger_die);
    setOutcome(data.outcome);
    setPlaying(false);
    onBalanceChange(data.new_balance);

    try {
      soundEngine.reelStop();
    } catch {
      // ignora falha de áudio
    }

    if (data.payout > betAmount) {
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
      <h2 className="panel-card__title">⚔️ Duelo do Tigre</h2>

      <div className="dragon-tiger-table">
        <div className={`dragon-tiger-card ${outcome === 'win' ? 'dragon-tiger-card--win' : ''} ${outcome === 'lose' ? 'dragon-tiger-card--lose' : ''}`}>
          <span className="dragon-tiger-card__label">Você</span>
          <div className="dragon-tiger-card__face">{playerDie ?? '?'}</div>
        </div>

        <img src={mascoteTigre} alt="" className="dragon-tiger-table__mascot" />

        <div className={`dragon-tiger-card ${outcome === 'lose' ? 'dragon-tiger-card--win' : ''} ${outcome === 'win' ? 'dragon-tiger-card--lose' : ''}`}>
          <span className="dragon-tiger-card__label">Tigre</span>
          <div className="dragon-tiger-card__face">{tigerDie ?? '?'}</div>
        </div>
      </div>

      <div className="payout-line" aria-live="polite">
        {playError
          ? playError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : outcome === 'tie'
              ? 'Empate — aposta devolvida'
              : 'Role e tente vencer o tigre'}
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
          {playing ? 'Rolando…' : 'Desafiar'}
        </button>
      </div>
    </div>
  );
}
