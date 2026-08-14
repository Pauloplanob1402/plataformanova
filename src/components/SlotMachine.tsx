import { useCallback, useEffect, useRef, useState } from 'react';
import { Reel } from './Reel';
import { SYMBOL_TABLE } from '../core/symbols';
import { SYMBOL_IMAGES } from '../symbols/images';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';

interface SlotMachineProps {
  credits: number;
  /** Chamado com o novo saldo assim que o servidor responde (fonte da verdade). */
  onBalanceChange: (newBalance: number) => void;
  /** Chamado depois de cada giro resolvido, pra estatística de sessão (cosmético). */
  onSpinResolved: (betAmount: number, payout: number) => void;
  onWin: (amount: number) => void;
}

const REEL_COUNT = 3;
const BET_STEPS = [5, 10, 25, 50, 100];
const TICK_MS = 65;
const REEL_STOP_DELAYS = [600, 820, 1040]; // ms — cada rolo para em sequência

// Durante a ROLAGEM (só efeito visual, antes de cada rolo travar), o tigre
// aparece bem mais no "embaralhado" pra criar expectativa. Isso é só estética
// do rolo girando — o resultado final vem do servidor (spin_slot RPC).
const TIGER_TEASE_MULTIPLIER = 9;

const SYMBOL_ID_TO_INDEX = new Map(SYMBOL_TABLE.map((s, i) => [s.id, i]));

interface SpinRpcResult {
  symbols: string[];
  payout: number;
  new_balance: number;
}

export function SlotMachine({ credits, onBalanceChange, onSpinResolved, onWin }: SlotMachineProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [displayIndices, setDisplayIndices] = useState<number[]>([0, 1, 2]);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const teaseWeights = SYMBOL_TABLE.map((s) =>
    s.id === 'tiger' ? s.weight * TIGER_TEASE_MULTIPLIER : s.weight
  );

  const intervalIdRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const reelStoppedRef = useRef<boolean[]>([false, false, false]);
  const finalResultsRef = useRef<number[]>([0, 1, 2]);

  const clearAllTimers = useCallback(() => {
    if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
    timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutIdsRef.current = [];
    intervalIdRef.current = null;
  }, []);

  // Limpa timers pendentes se o componente desmontar no meio de um giro.
  useEffect(() => clearAllTimers, [clearAllTimers]);

  /** Sorteio "de mentira" só pra animação de embaralhar enquanto esperamos o servidor. */
  const teaseIndex = useCallback(() => {
    const total = teaseWeights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < teaseWeights.length; i++) {
      roll -= teaseWeights[i];
      if (roll < 0) return i;
    }
    return teaseWeights.length - 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revealFinalResult = useCallback(
    (payout: number, newBalance: number) => {
      reelStoppedRef.current = [false, false, false];

      for (let i = 0; i < REEL_COUNT; i++) {
        const timeoutId = window.setTimeout(() => {
          reelStoppedRef.current[i] = true;
          setDisplayIndices((prev) => {
            const next = [...prev];
            next[i] = finalResultsRef.current[i];
            return next;
          });
          try {
            soundEngine.reelStop();
          } catch {
            // ignora falha de áudio
          }

          if (reelStoppedRef.current.every(Boolean)) {
            if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
            setSpinning(false);
            try {
              soundEngine.stopSpinLoop();
            } catch {
              // ignora falha de áudio
            }

            onBalanceChange(newBalance);
            onSpinResolved(betAmount, payout);

            if (payout > 0) {
              setLastPayout(payout);
              setFlash(true);
              onWin(payout);
              try {
                const symbol = SYMBOL_TABLE[finalResultsRef.current[0]];
                symbol.payoutMultiplier >= 15 ? soundEngine.win(symbol.payoutMultiplier) : soundEngine.coin();
              } catch {
                // som nunca deve travar o jogo
              }
              window.setTimeout(() => setFlash(false), 900);
            }
          }
        }, REEL_STOP_DELAYS[i]);
        timeoutIdsRef.current.push(timeoutId);
      }
    },
    [betAmount, onBalanceChange, onSpinResolved, onWin]
  );

  const handleSpin = useCallback(async () => {
    if (spinning) return;
    if (credits < betAmount) return;

    setSpinError(null);
    setLastPayout(null);
    setFlash(false);
    clearAllTimers();
    setSpinning(true);

    try {
      soundEngine.click();
      soundEngine.startSpinLoop();
    } catch {
      // som nunca deve travar o jogo
    }

    // Animação de "embaralhando" começa já, enquanto esperamos a resposta do servidor.
    intervalIdRef.current = window.setInterval(() => {
      setDisplayIndices((prev) => prev.map((idx, i) => (reelStoppedRef.current[i] ? idx : teaseIndex())));
    }, TICK_MS);

    const { data, error } = await supabase.rpc('spin_slot', { bet_amount: betAmount });

    if (error || !data) {
      clearAllTimers();
      setSpinning(false);
      try {
        soundEngine.stopSpinLoop();
      } catch {
        // ignora falha de áudio
      }
      setSpinError(
        error?.message?.toLowerCase().includes('insuficiente')
          ? 'Créditos insuficientes para essa aposta.'
          : 'Não foi possível girar agora. Tente novamente.',
      );
      return;
    }

    const result = data as SpinRpcResult;
    finalResultsRef.current = result.symbols.map((id) => SYMBOL_ID_TO_INDEX.get(id) ?? 0);
    revealFinalResult(result.payout, result.new_balance);
  }, [spinning, credits, betAmount, clearAllTimers, teaseIndex, revealFinalResult]);

  const canDecreaseBet = betIndex > 0 && !spinning;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !spinning;
  const canSpin = !spinning && credits >= betAmount;

  return (
    <div className="slot-card">
      <div className={`reel-frame ${flash ? 'reel-frame--win' : ''}`}>
        {displayIndices.map((symbolIndex, i) => (
          <Reel key={i} symbolIndex={symbolIndex} spinning={spinning} />
        ))}
      </div>

      <div className="payout-line" aria-live="polite">
        {spinError
          ? spinError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : 'Alinhe 3 símbolos iguais para ganhar'}
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

        <button className="spin-btn" onClick={handleSpin} disabled={!canSpin}>
          {spinning ? 'Girando…' : 'Girar'}
        </button>
      </div>

      <div className="paytable">
        {SYMBOL_TABLE.map((s) => (
          <div className="paytable__item" key={s.id}>
            <div className="paytable__icon">
              <img src={SYMBOL_IMAGES[s.id]} alt={s.name} />
            </div>
            <span>{s.payoutMultiplier}x</span>
          </div>
        ))}
      </div>
    </div>
  );
}
