import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface RaceGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];

const ANIMALS: { id: string; label: string; emoji: string; payout: string }[] = [
  { id: 'tigre', label: 'Tigre', emoji: '🐯', payout: '4.7x' },
  { id: 'dragao', label: 'Dragão', emoji: '🐉', payout: '7.8x' },
  { id: 'cavalo', label: 'Cavalo', emoji: '🐴', payout: '9.4x' },
  { id: 'coelho', label: 'Coelho', emoji: '🐰', payout: '10.4x' },
  { id: 'boi', label: 'Boi', emoji: '🐂', payout: '11.8x' },
  { id: 'macaco', label: 'Macaco', emoji: '🐵', payout: '13.4x' },
  { id: 'galo', label: 'Galo', emoji: '🐓', payout: '13.4x' },
  { id: 'cachorro', label: 'Cachorro', emoji: '🐶', payout: '15.7x' },
  { id: 'porco', label: 'Porco', emoji: '🐷', payout: '15.7x' },
  { id: 'rato', label: 'Rato', emoji: '🐭', payout: '15.7x' },
  { id: 'cobra', label: 'Cobra', emoji: '🐍', payout: '18.8x' },
  { id: 'cabra', label: 'Cabra', emoji: '🐐', payout: '23.5x' },
];

export function RaceGame({ credits, onBalanceChange, onWin }: RaceGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [choice, setChoice] = useState('tigre');
  const [playing, setPlaying] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const handlePlay = useCallback(async () => {
    if (playing || credits < betAmount) return;

    setPlaying(true);
    setPlayError(null);
    setLastPayout(null);
    setWinner(null);

    try {
      soundEngine.click();
    } catch {
      // som nunca deve travar o jogo
    }

    const { data, error } = await supabase.rpc('play_race', { bet_amount: betAmount, choice });

    if (error || !data) {
      setPlaying(false);
      setPlayError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível jogar agora. Tente novamente.',
      );
      return;
    }

    await new Promise((r) => setTimeout(r, 1200));

    setWinner(data.winner);
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
      <h2 className="panel-card__title">🏁 Turfe do Tigre</h2>

      <div className="payout-line" aria-live="polite">
        {playError
          ? playError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : winner
              ? `Vencedor: ${ANIMALS.find((a) => a.id === winner)?.label}`
              : ' '}
      </div>

      <div className="race-grid">
        {ANIMALS.map((a) => {
          const isChoice = choice === a.id;
          const isWinner = winner === a.id;
          return (
            <button
              key={a.id}
              type="button"
              className={`race-animal ${isChoice ? 'race-animal--chosen' : ''} ${isWinner ? 'race-animal--winner' : ''}`}
              onClick={() => setChoice(a.id)}
              disabled={playing}
            >
              {isChoice && <span className="dragon-tiger-bet__check">✓</span>}
              <span className="race-animal__emoji">{a.emoji}</span>
              <span className="race-animal__name">{a.label}</span>
              <span className="race-animal__payout">{a.payout}</span>
            </button>
          );
        })}
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
          {playing ? 'Correndo…' : 'Apostar'}
        </button>
      </div>
    </div>
  );
}
