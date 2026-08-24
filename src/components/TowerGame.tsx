import { useCallback, useState } from 'react';
import thumbTorre from '../assets/thumb-torre.webp';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface TowerGameProps {
  credits: number;
  onBalanceChange: (newBalance: number) => void;
  onWin: (amount: number) => void;
  mini?: boolean;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const CELLS_PER_LEVEL = 3;

export function TowerGame({ credits, onBalanceChange, onWin, mini = false }: TowerGameProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [levels, setLevels] = useState(mini ? 4 : 8);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [pickedByLevel, setPickedByLevel] = useState<Record<number, number>>({});
  const [trapByLevel, setTrapByLevel] = useState<Record<number, number>>({});
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  const [stuckRound, setStuckRound] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];
  const active = roundId !== null;

  const handleStart = useCallback(async () => {
    if (busy || credits < betAmount) return;
    setBusy(true);
    setGameError(null);
    setMessage(null);
    setPickedByLevel({});
    setTrapByLevel({});
    setCurrentLevel(0);
    setMultiplier(1);

    const { data, error } = await supabase.rpc('start_tower', { bet_amount: betAmount, mini });

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
    setLevels(data.levels);
    setBusy(false);
    try {
      soundEngine.click();
    } catch {
      // ignora falha de áudio
    }
  }, [betAmount, credits, mini, onBalanceChange, busy]);

  const handleCancelStuck = useCallback(async () => {
    setBusy(true);
    const { error } = await supabase.rpc('cancel_stuck_round');
    setBusy(false);
    if (!error) {
      setStuckRound(false);
      setGameError(null);
    }
  }, []);

  const handlePick = useCallback(
    async (cellIndex: number) => {
      if (busy || !roundId) return;
      setBusy(true);
      setGameError(null);

      const { data, error } = await supabase.rpc('climb_tower', { round_id: roundId, cell_index: cellIndex });

      if (error || !data) {
        setBusy(false);
        setGameError('Não foi possível subir. Tente de novo.');
        return;
      }

      if (data.busted) {
        setPickedByLevel((prev) => ({ ...prev, [currentLevel]: cellIndex }));
        const trapMap: Record<number, number> = {};
        (data.trap_positions as number[]).forEach((t, i) => (trapMap[i] = t));
        setTrapByLevel(trapMap);
        setMessage('💥 Armadilha! Rodada perdida.');
        setRoundId(null);
        onBalanceChange(data.new_balance);
        try {
          soundEngine.reelStop();
        } catch {
          // ignora falha de áudio
        }
      } else {
        setPickedByLevel((prev) => ({ ...prev, [currentLevel]: cellIndex }));
        setCurrentLevel(data.current_level);
        setMultiplier(data.multiplier);
        try {
          soundEngine.coin();
        } catch {
          // ignora falha de áudio
        }
        if (data.topped_out) {
          setMessage(`🐯 Topo da torre! +${data.payout} créditos!`);
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
    [busy, roundId, currentLevel, onBalanceChange, onWin],
  );

  const handleCashout = useCallback(async () => {
    if (busy || !roundId || currentLevel < 1) return;
    setBusy(true);
    setGameError(null);

    const { data, error } = await supabase.rpc('cashout_tower', { round_id: roundId });

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
  }, [busy, roundId, currentLevel, onBalanceChange, onWin, multiplier]);

  const levelRows = Array.from({ length: levels }, (_, i) => levels - 1 - i); // topo primeiro visualmente

  return (
    <div className="panel-card">
      <h2 className="panel-card__title panel-card__title--icon">
        <img src={thumbTorre} alt="" className="panel-card__title-icon" /> {mini ? 'Torre Mini' : 'Torre do Tigre'}
      </h2>

      <div className="tower-stack">
        {levelRows.map((levelIdx) => {
          const isCurrent = active && levelIdx === currentLevel;
          const isPast = levelIdx < currentLevel;
          const picked = pickedByLevel[levelIdx];
          const trap = trapByLevel[levelIdx];
          return (
            <div key={levelIdx} className={`tower-level ${isCurrent ? 'tower-level--current' : ''} ${isPast ? 'tower-level--cleared' : ''}`}>
              {Array.from({ length: CELLS_PER_LEVEL }, (_, c) => {
                const isPicked = picked === c;
                const isTrap = trap === c && trap !== undefined;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`tower-cell ${isPicked && isTrap ? 'tower-cell--mine' : ''} ${isPicked && !isTrap ? 'tower-cell--safe' : ''} ${isTrap && !isPicked ? 'tower-cell--reveal-mine' : ''}`}
                    onClick={() => handlePick(c)}
                    disabled={!isCurrent || busy}
                  >
                    {isPicked ? (isTrap ? '💣' : '🐯') : isTrap ? '💣' : ''}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="payout-line" aria-live="polite">
        {gameError ? gameError : message ? message : active ? `Andar ${currentLevel}/${levels} · ${multiplier.toFixed(2)}x` : 'Suba andar por andar, saque quando quiser'}
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
          <button className="spin-btn" onClick={handleStart} disabled={busy || credits < betAmount}>
            {busy ? 'Iniciando…' : 'Começar'}
          </button>
        ) : (
          <button className="spin-btn spin-btn--secondary" onClick={handleCashout} disabled={busy || currentLevel < 1}>
            Sacar {currentLevel >= 1 ? `(${multiplier.toFixed(2)}x)` : ''}
          </button>
        )}
      </div>
    </div>
  );
}
