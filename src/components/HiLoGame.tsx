import { useCallback, useState } from 'react';
import thumbSobeDesce from '../assets/thumb-sobedesce.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';
import { safeRpc } from '../core/withTimeout';

interface HiLoGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
  onRequestDeposit: () => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];

export function HiLoGame({ credits, onBalanceChange, onWin, onRequestDeposit }: HiLoGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [currentCard, setCurrentCard] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stuckRound, setStuckRound] = useState(false);

  const betAmount = BET_STEPS[betIndex];
  const active = roundId !== null;

  const handleStart = useCallback(async () => {
    if (busy) return;
    if (credits < betAmount) {
      onRequestDeposit();
      return;
    }
    setBusy(true);
    setGameError(null);
    setMessage(null);
    setStreak(0);
    setMultiplier(1);

    const { data, error } = await safeRpc(supabase.rpc('start_hilo', { bet_amount: betAmount }));

    if (error || !data) {
      setBusy(false);
      if (error?.message?.toLowerCase().includes('rodada em andamento')) {
        setStuckRound(true);
        setGameError('Você tem uma rodada travada de uma sessão anterior.');
      } else {
        setGameError(error?.message?.toLowerCase().includes('insuficiente') ? 'Créditos insuficientes.' : 'Não foi possível começar. Tente de novo.');
      }
      return;
    }

    onBalanceChange(credits - betAmount);
    setRoundId(data.round_id);
    setCurrentCard(data.current_card);
    setBusy(false);
    try {
      soundEngine.click();
    } catch {
      // ignora falha de áudio
    }
  }, [betAmount, credits, onBalanceChange, busy]);

  const handleCancelStuck = useCallback(async () => {
    setBusy(true);
    const { error } = await safeRpc(supabase.rpc('cancel_stuck_round'));
    setBusy(false);
    if (!error) {
      setStuckRound(false);
      setGameError(null);
    }
  }, []);

  const handleGuess = useCallback(
    async (direction: 'higher' | 'lower') => {
      if (busy || !roundId) return;
      setBusy(true);
      setGameError(null);

      const { data, error } = await safeRpc(supabase.rpc('guess_hilo', { round_id: roundId, direction }));

      if (error || !data) {
        setBusy(false);
        setGameError('Não foi possível jogar. Tente de novo.');
        return;
      }

      if (!data.correct) {
        setCurrentCard(data.next_card);
        setMessage('❌ Errou! Rodada perdida.');
        setRoundId(null);
        onBalanceChange(data.new_balance);
        try {
          soundEngine.reelStop();
        } catch {
          // ignora falha de áudio
        }
      } else {
        setCurrentCard(data.next_card);
        setMultiplier(data.multiplier);
        setStreak(data.streak);
        try {
          soundEngine.coin();
        } catch {
          // ignora falha de áudio
        }
      }
      setBusy(false);
    },
    [busy, roundId, onBalanceChange],
  );

  const handleCashout = useCallback(async () => {
    if (busy || !roundId || streak < 1) return;
    setBusy(true);
    setGameError(null);

    const { data, error } = await safeRpc(supabase.rpc('cashout_hilo', { round_id: roundId }));

    if (error || !data) {
      setBusy(false);
      setGameError('Não foi possível sacar agora. Tente de novo.');
      return;
    }

    setMessage(`+${data.payout} créditos!`);
    setRoundId(null);
    onBalanceChange(data.new_balance);
    onWin(data.payout);
    try {
      soundEngine.win(multiplier);
    } catch {
      // ignora falha de áudio
    }
    setBusy(false);
  }, [busy, roundId, streak, onBalanceChange, onWin, multiplier]);

  const canHigher = active && currentCard !== null && currentCard < 13;
  const canLower = active && currentCard !== null && currentCard > 1;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title panel-card__title--icon"><img src={thumbSobeDesce} alt="" className="panel-card__title-icon" /> Sobe-Desce do Tigre</h2>

      <div className="dragon-tiger-table">
        <div className="dragon-tiger-card">
          <span className="dragon-tiger-card__label">Carta atual</span>
          <div className="dragon-tiger-card__face">{currentCard ?? '?'}</div>
        </div>
      </div>

      <div className="payout-line" aria-live="polite">
        {gameError ? gameError : message ? message : active ? `Sequência: ${streak} · ${multiplier.toFixed(2)}x` : 'A próxima carta vai ser maior ou menor?'}
      </div>

      {stuckRound && (
        <button className="spin-btn spin-btn--secondary" onClick={handleCancelStuck} disabled={busy}>
          Cancelar rodada travada e recomeçar
        </button>
      )}

      {active && (
        <div className="dragon-tiger-bets" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <button type="button" className="dragon-tiger-bet" onClick={() => handleGuess('lower')} disabled={!canLower || busy}>
            <span className="dragon-tiger-bet__name">⬇️ Menor</span>
          </button>
          <button type="button" className="dragon-tiger-bet" onClick={() => handleGuess('higher')} disabled={!canHigher || busy}>
            <span className="dragon-tiger-bet__name">⬆️ Maior</span>
          </button>
        </div>
      )}

      <div className="controls">
        <div className="bet-control">
          <button className="bet-btn" onClick={() => setBetIndex((i) => Math.max(0, i - 1))} disabled={active || busy || betIndex === 0} aria-label="Diminuir aposta">
            −
          </button>
          <div className="bet-amount">
            <span className="bet-amount__label">Aposta</span>
            <span className="bet-amount__value">{betAmount}</span>
          </div>
          <button className="bet-btn" onClick={() => setBetIndex((i) => Math.min(BET_STEPS.length - 1, i + 1))} disabled={active || busy || betIndex === BET_STEPS.length - 1} aria-label="Aumentar aposta">
            +
          </button>
        </div>

        {!active ? (
          <button className="spin-btn" onClick={handleStart} disabled={busy}>
            {busy ? 'Iniciando…' : 'Começar'}
          </button>
        ) : (
          <button className="spin-btn spin-btn--secondary" onClick={handleCashout} disabled={busy || streak < 1}>
            Sacar {streak >= 1 ? `(${multiplier.toFixed(2)}x)` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
