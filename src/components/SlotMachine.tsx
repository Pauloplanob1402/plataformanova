import { useCallback, useEffect, useRef, useState } from 'react';
import { Reel } from './Reel';
import { REELS, ROWS, SYMBOL_TABLE } from '../core/symbols';
import { SYMBOL_IMAGES } from '../symbols/images';
import { soundEngine } from '../sound/soundEngine';
import { supabase } from '../core/supabaseClient';
import type { SlotGrid } from '../core/waysToWin';

interface SlotMachineProps {
  credits: number;
  /** Chamado com o novo saldo assim que o servidor responde (fonte da verdade). */
  onBalanceChange: (newBalance: number) => void;
  /** Chamado depois de cada giro resolvido, pra estatística de sessão (cosmético). */
  onSpinResolved: (betAmount: number, payout: number) => void;
  onWin: (amount: number) => void;
}

const BET_STEPS = [5, 10, 25, 50, 100];
const TICK_MS = 65;
const REEL_STOP_DELAYS = [650, 900, 1150]; // ms — cada COLUNA para em sequência

// Durante a ROLAGEM (só efeito visual, antes de cada coluna travar), o tigre
// aparece bem mais no "embaralhado" pra criar expectativa. Isso é só estética
// — o resultado final vem do servidor (spin_slot RPC).
const TIGER_TEASE_MULTIPLIER = 9;

const SYMBOL_ID_TO_INDEX = new Map(SYMBOL_TABLE.map((s, i) => [s.id, i]));

function emptyGrid(): SlotGrid {
  return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => 0));
}

interface SpinFeatureFrame {
  grid: string[];
  locked: string;
}

interface SpinFeatureResult {
  frames: SpinFeatureFrame[];
  full_grid: boolean;
  bonus_multiplier: number | null;
}

interface SpinRpcResult {
  /** 9 ids de símbolo, em ordem reel-major: [rolo0-linha0,1,2, rolo1-linha0,1,2, rolo2-linha0,1,2]. */
  grid: string[];
  payout: number;
  new_balance: number;
  winning_symbols: string[];
  /** linhas que pagaram nesta rodada: 1=topo, 2=meio, 3=base. */
  winning_rows: number[];
  /** presente só quando o Respin Dourado disparou nesta rodada. */
  feature: SpinFeatureResult | null;
}

const FEATURE_FRAME_DELAY_MS = 700;

export function SlotMachine({ credits, onBalanceChange, onSpinResolved, onWin }: SlotMachineProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [displayGrid, setDisplayGrid] = useState<SlotGrid>(emptyGrid());
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [winningRows, setWinningRows] = useState<number[]>([]);
  const [flash, setFlash] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [lockedSymbolId, setLockedSymbolId] = useState<string | null>(null);
  const [featureMessage, setFeatureMessage] = useState<string | null>(null);

  const betAmount = BET_STEPS[betIndex];

  const teaseWeights = SYMBOL_TABLE.map((s) =>
    s.id === 'tiger' ? s.weight * TIGER_TEASE_MULTIPLIER : s.weight
  );

  const intervalIdRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const reelStoppedRef = useRef<boolean[]>([false, false, false]);
  const finalGridRef = useRef<SlotGrid>(emptyGrid());

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

  const settleRound = useCallback(
    (payout: number, newBalance: number, winIds: string[], winRows: number[], bonusMultiplier: number | null) => {
      onBalanceChange(newBalance);
      onSpinResolved(betAmount, payout);

      if (payout > 0) {
        setLastPayout(payout);
        setWinningRows(winRows);
        setFlash(true);
        onWin(payout);
        if (bonusMultiplier) {
          setFeatureMessage(`🐯 GRADE CHEIA! Prêmio multiplicado por ${bonusMultiplier}x!`);
        }
        try {
          const bestSymbol = SYMBOL_TABLE.filter((s) => winIds.includes(s.id)).sort(
            (a, b) => b.payoutMultiplier - a.payoutMultiplier
          )[0];
          bestSymbol && bestSymbol.payoutMultiplier >= 15 ? soundEngine.win(bestSymbol.payoutMultiplier) : soundEngine.coin();
        } catch {
          // som nunca deve travar o jogo
        }
        window.setTimeout(() => setFlash(false), 900);
      }
    },
    [betAmount, onBalanceChange, onSpinResolved, onWin],
  );

  /** Anima a sequência de respins do Respin Dourado, quadro a quadro, usando
   *  os dados já calculados pelo servidor (nada é decidido no client). */
  const playFeatureFrames = useCallback((feature: SpinFeatureResult): Promise<void> => {
    return new Promise((resolve) => {
      const lockedSymbol = SYMBOL_TABLE.find((s) => s.id === feature.frames[0]?.locked);
      setLockedSymbolId(feature.frames[0]?.locked ?? null);
      setFeatureMessage(`🔥 Respin Dourado! ${lockedSymbol?.name ?? ''} travado — girando de novo...`);

      let frameIndex = 0;
      const playNextFrame = () => {
        const frame = feature.frames[frameIndex];
        if (!frame) {
          resolve();
          return;
        }
        const flatIndices = frame.grid.map((id) => SYMBOL_ID_TO_INDEX.get(id) ?? 0);
        const grid: SlotGrid = [];
        for (let r = 0; r < REELS; r++) {
          grid.push(flatIndices.slice(r * ROWS, r * ROWS + ROWS));
        }
        setDisplayGrid(grid);
        try {
          soundEngine.reelStop();
        } catch {
          // ignora falha de áudio
        }
        frameIndex += 1;
        const timeoutId = window.setTimeout(playNextFrame, FEATURE_FRAME_DELAY_MS);
        timeoutIdsRef.current.push(timeoutId);
      };

      // primeiro quadro já apareceu na grade normal (é o resultado do giro
      // inicial) — começa a animação a partir do 2º quadro (1º respin).
      frameIndex = 1;
      const timeoutId = window.setTimeout(playNextFrame, FEATURE_FRAME_DELAY_MS);
      timeoutIdsRef.current.push(timeoutId);
    });
  }, []);

  const revealFinalResult = useCallback(
    (
      payout: number,
      newBalance: number,
      winIds: string[],
      winRows: number[],
      feature: SpinFeatureResult | null,
    ) => {
      reelStoppedRef.current = [false, false, false];

      for (let i = 0; i < REELS; i++) {
        const timeoutId = window.setTimeout(() => {
          reelStoppedRef.current[i] = true;
          setDisplayGrid((prev) => {
            const next = prev.map((reel, r) => (r === i ? finalGridRef.current[i] : reel));
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

            if (feature) {
              // ainda tem o recurso pra animar — mantém "spinning" visualmente
              // pausado nos rolos finais do giro normal antes de entrar nos respins
              window.setTimeout(async () => {
                try {
                  soundEngine.stopSpinLoop();
                } catch {
                  // ignora falha de áudio
                }
                await playFeatureFrames(feature);
                setSpinning(false);
                setLockedSymbolId(null);
                if (!feature.full_grid) setFeatureMessage(null);
                settleRound(payout, newBalance, winIds, winRows, feature.bonus_multiplier);
              }, 300);
              return;
            }

            setSpinning(false);
            try {
              soundEngine.stopSpinLoop();
            } catch {
              // ignora falha de áudio
            }
            settleRound(payout, newBalance, winIds, winRows, null);
          }
        }, REEL_STOP_DELAYS[i]);
        timeoutIdsRef.current.push(timeoutId);
      }
    },
    [playFeatureFrames, settleRound],
  );

  const handleSpin = useCallback(async () => {
    if (spinning) return;
    if (credits < betAmount) return;

    setSpinError(null);
    setLastPayout(null);
    setWinningRows([]);
    setFlash(false);
    setLockedSymbolId(null);
    setFeatureMessage(null);
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
      setDisplayGrid((prev) =>
        prev.map((reel, i) => (reelStoppedRef.current[i] ? reel : reel.map(() => teaseIndex())))
      );
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
    const flatIndices = result.grid.map((id) => SYMBOL_ID_TO_INDEX.get(id) ?? 0);
    const grid: SlotGrid = [];
    for (let r = 0; r < REELS; r++) {
      grid.push(flatIndices.slice(r * ROWS, r * ROWS + ROWS));
    }
    finalGridRef.current = grid;
    revealFinalResult(
      result.payout,
      result.new_balance,
      result.winning_symbols ?? [],
      result.winning_rows ?? [],
      result.feature ?? null,
    );
  }, [spinning, credits, betAmount, clearAllTimers, teaseIndex, revealFinalResult]);

  const canDecreaseBet = betIndex > 0 && !spinning;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !spinning;
  const canSpin = !spinning && credits >= betAmount;

  return (
    <div className="slot-card">
      <div className={`reel-frame ${flash ? 'reel-frame--win' : ''} ${lockedSymbolId ? 'reel-frame--feature' : ''}`}>
        {displayGrid.map((reelIndices, i) => (
          <Reel
            key={i}
            symbolIndices={reelIndices}
            spinning={spinning && !lockedSymbolId}
            winningRows={winningRows}
            lockedSymbolId={lockedSymbolId}
          />
        ))}
      </div>

      {featureMessage && <div className="feature-banner">{featureMessage}</div>}

      <div className="payout-line" aria-live="polite">
        {spinError
          ? spinError
          : lastPayout
            ? `+${lastPayout} créditos!`
            : 'Alinhe 3 símbolos iguais numa mesma linha (topo, meio ou base) para ganhar'}
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

      <details className="paytable-details">
        <summary>Ver tabela de prêmios</summary>
        <p className="paytable__rule">3 iguais na mesma linha pagam o multiplicador abaixo × valor da aposta.</p>
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
      </details>
    </div>
  );
}
