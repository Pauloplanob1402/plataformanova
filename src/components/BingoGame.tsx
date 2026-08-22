import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface BingoGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];

export function BingoGame({ credits, onBalanceChange, onWin }: BingoGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [card, setCard] = useState<number[] | null>(null);
  const [drawn, setDrawn] = useState<number[]>([]);
  const [won, setWon] = useState<boolean | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setCard(null);
    setDrawn([]);
    setWon(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_bingo', { bet_amount: betAmount });

    if (error || !data) {
      setPlaying(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    setCard(data.card);
    await new Promise((r) => setTimeout(r, 700));

    setDrawn(data.drawn);
    setWon(data.won);
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
  }, [betAmount, credits, onBalanceChange, onWin, playing]);

  const canDecreaseBet = betIndex > 0 && !playing;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !playing;
  const canPlay = !playing && credits >= betAmount;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🎴 Bingo do Tigre</h2>

      <div className="bingo-card">
        {(card ?? Array(25).fill(null)).map((n, i) => {
          const isFree = i === 12;
          const isMarked = isFree || (n !== null && drawn.includes(n));
          return (
            <div key={i} className={`bingo-cell ${isMarked ? 'bingo-cell--marked' : ''}`}>
              {isFree ? '🐯' : n ?? ''}
            </div>
          );
        })}
      </div>

      <div className="payout-line" aria-live="polite">
        {playError
          ? playError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : won === false
              ? 'Sem linha dessa vez'
              : 'Feche uma linha, coluna ou diagonal pra ganhar'}
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
          {playing ? 'Sorteando…' : 'Comprar cartela'}
        </button>
      </div>
    </div>
  );
}
