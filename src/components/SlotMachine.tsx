import { useCallback, useEffect, useRef, useState } from 'react';
import { Reel } from './Reel';
import { SYMBOL_TABLE } from '../core/symbols';
import { SYMBOL_IMAGES } from '../symbols/images';
import { soundEngine } from '../sound/soundEngine';
import type { RandomProvider } from '../core/random';

interface SlotMachineProps {
  credits: number;
  placeBet: (amount: number) => boolean;
  addWinnings: (amount: number) => void;
  rng: RandomProvider;
  onWin: (amount: number) => void;
}

const REEL_COUNT = 3;
const BET_STEPS = [5, 10, 25, 50, 100];
const TICK_MS = 65;
const REEL_STOP_DELAYS = [600, 820, 1040]; // ms — cada rolo para em sequência

// Durante a ROLAGEM (só efeito visual, antes de cada rolo travar), o tigre
// aparece bem mais no "embaralhado" pra criar expectativa — o resultado final
// de cada rolo continua sendo sorteado com os pesos reais da tabela (RTP
// inalterado). Esse multiplicador só afeta o que passa na tela enquanto gira.
const TIGER_TEASE_MULTIPLIER = 9;

export function SlotMachine({ credits, placeBet, addWinnings, rng, onWin }: SlotMachineProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [displayIndices, setDisplayIndices] = useState<number[]>([0, 1, 2]);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const betAmount = BET_STEPS[betIndex];

  const weights = SYMBOL_TABLE.map((s) => s.weight);
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

  const evaluateResult = useCallback(
    (results: number[]) => {
      const allEqual = results.every((v) => v === results[0]);
      if (!allEqual) return;

      const symbol = SYMBOL_TABLE[results[0]];
      const payout = Math.round(betAmount * symbol.payoutMultiplier);
      if (payout <= 0) return;

      addWinnings(payout);
      setLastPayout(payout);
      setFlash(true);
      onWin(payout);
      try {
        symbol.payoutMultiplier >= 15 ? soundEngine.win(symbol.payoutMultiplier) : soundEngine.coin();
      } catch {
        // som nunca deve travar o jogo
      }
      window.setTimeout(() => setFlash(false), 900);
    },
    [betAmount, addWinnings, onWin]
  );

  const handleSpin = useCallback(() => {
    if (spinning) return;
    if (!placeBet(betAmount)) return;

    try {
      soundEngine.click();
      soundEngine.startSpinLoop();
    } catch {
      // som nunca deve travar o jogo
    }

    // garante que não sobrou nenhum timer de um giro anterior
    clearAllTimers();

    setLastPayout(null);
    setFlash(false);

    const results: number[] = [];
    for (let i = 0; i < REEL_COUNT; i++) {
      results.push(rng.weightedIndex(weights));
    }
    finalResultsRef.current = results;
    reelStoppedRef.current = [false, false, false];

    setSpinning(true);

    intervalIdRef.current = window.setInterval(() => {
      setDisplayIndices((prev) =>
        prev.map((idx, i) => (reelStoppedRef.current[i] ? idx : rng.weightedIndex(teaseWeights)))
      );
    }, TICK_MS);

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
          evaluateResult(finalResultsRef.current);
        }
      }, REEL_STOP_DELAYS[i]);
      timeoutIdsRef.current.push(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, placeBet, betAmount, rng, clearAllTimers, evaluateResult]);

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
        {lastPayout ? `+${lastPayout} créditos!` : 'Alinhe 3 símbolos iguais para ganhar'}
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
