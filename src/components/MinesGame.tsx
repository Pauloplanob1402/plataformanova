import { useCallback, useState } from 'react';
import thumbMina from '../assets/thumb-mina.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';
import { safeRpc } from '../core/withTimeout';

interface MinesGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
  onRequestDeposit: () => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const MINE_OPTIONS = [3, 5, 8];
const TOTAL_CELLS = 25;

export function MinesGame({ credits, onBalanceChange, onWin, onRequestDeposit }: MinesGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [mineCount, setMineCount] = useState(3);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, 'safe' | 'mine'>>({});
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [stuckRound, setStuckRound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];
  const active = roundId !== null;
  const picks = Object.values(revealed).filter((v) => v === 'safe').length;

  const handleStart = useCallback(async () => {
    if (busy) return;
    if (credits < betAmount) {
      onRequestDeposit();
      return;
    }
    setBusy(true);
    setGameError(null);
    setMessage(null);
    setRevealed({});
    setMultiplier(1);

    const { data, error } = await safeRpc(supabase.rpc('start_mines', { bet_amount: betAmount, mine_count: mineCount }));

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

    onBalanceChange(data.new_balance);
    setRoundId(data.round_id);
    setBusy(false);
    try {
      soundEngine.click();
    } catch {
      // ignora falha de áudio
    }
  }, [betAmount, credits, mineCount, onBalanceChange, busy]);

  const handleCancelStuck = useCallback(async () => {
    setBusy(true);
    const { error } = await safeRpc(supabase.rpc('cancel_stuck_round'));
    setBusy(false);
    if (!error) {
      setStuckRound(false);
      setGameError(null);
    }
  }, []);

  const handleReveal = useCallback(
    async (cellIndex: number) => {
      if (busy || !roundId || revealed[cellIndex]) return;
      setBusy(true);
      setGameError(null);

      const { data, error } = await safeRpc(supabase.rpc('reveal_mines_cell', { round_id: roundId, cell_index: cellIndex }));

      if (error || !data) {
        setBusy(false);
        setGameError('Não foi possível revelar essa célula. Tente de novo.');
        return;
      }

      if (data.busted) {
        const mineSet: Record<number, 'safe' | 'mine'> = { ...revealed, [cellIndex]: 'mine' };
        for (const m of data.mine_positions as number[]) mineSet[m] = 'mine';
        setRevealed(mineSet);
        setMessage('💥 Explodiu! Rodada perdida.');
        setRoundId(null);
        onBalanceChange(data.new_balance);
        try {
          soundEngine.reelStop();
        } catch {
          // ignora falha de áudio
        }
      } else {
        setRevealed((prev) => ({ ...prev, [cellIndex]: 'safe' }));
        setMultiplier(data.multiplier);
        try {
          soundEngine.coin();
        } catch {
          // ignora falha de áudio
        }
        if (data.cleared) {
          setMessage(`🐯 Grade limpa! +${data.payout} créditos!`);
          setRoundId(null);
          onBalanceChange(data.new_balance);
          onWin(data.payout);
          try {
            soundEngine.win(data.multiplier);
          } catch {
            // ignora falha de áudio
          }
        }
      }
      setBusy(false);
    },
    [busy, revealed, roundId, onBalanceChange, onWin],
  );

  const handleCashout = useCallback(async () => {
    if (busy || !roundId || picks < 1) return;
    setBusy(true);
    setGameError(null);

    const { data, error } = await safeRpc(supabase.rpc('cashout_mines', { round_id: roundId }));

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
  }, [busy, roundId, picks, onBalanceChange, onWin, multiplier]);

  const cells = Array.from({ length: TOTAL_CELLS }, (_, i) => i);

  return (
    <div className="panel-card">
      <h2 className="panel-card__title panel-card__title--icon"><img src={thumbMina} alt="" className="panel-card__title-icon" /> Mina do Tigre</h2>

      {!active && (
        <div className="deposit-quick-amounts">
          {MINE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              className={`bet-btn deposit-quick-amounts__btn ${mineCount === m ? 'tab--active' : ''}`}
              onClick={() => setMineCount(m)}
              disabled={busy}
            >
              {m} minas
            </button>
          ))}
        </div>
      )}

      <div className="mines-grid">
        {cells.map((i) => {
          const state = revealed[i];
          return (
            <button
              key={i}
              type="button"
              className={`mines-cell ${state === 'safe' ? 'mines-cell--safe' : ''} ${state === 'mine' ? 'mines-cell--mine' : ''}`}
              onClick={() => handleReveal(i)}
              disabled={!active || busy || Boolean(state)}
            >
              {state === 'safe' ? '🐯' : state === 'mine' ? '💣' : ''}
            </button>
          );
        })}
      </div>

      <div className="payout-line" aria-live="polite">
        {gameError ? gameError : message ? message : active ? `Multiplicador atual: ${multiplier.toFixed(2)}x` : 'Escolha as minas e comece'}
      </div>

      {stuckRound && (
        <button className="spin-btn spin-btn--secondary" onClick={handleCancelStuck} disabled={busy}>
          Cancelar rodada travada e recomeçar
        </button>
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
          <button className="spin-btn spin-btn--secondary" onClick={handleCashout} disabled={busy || picks < 1}>
            Sacar {picks >= 1 ? `(${multiplier.toFixed(2)}x)` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
