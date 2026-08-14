import { useCallback, useState } from 'react';
import { soundEngine } from '../sound/soundEngine';
import type { RandomProvider } from '../core/random';

interface ProgressionTowerProps {
  credits: number;
  placeBet: (amount: number) => boolean;
  addWinnings: (amount: number) => void;
  rng: RandomProvider;
  onWin: (amount: number) => void;
}

interface LevelConfig {
  survivalChance: number;
  multiplier: number;
}

// Chance de sobrevivência cai a cada nível, multiplicador sobe — calibrado para RTP ~95%.
const LEVELS: LevelConfig[] = [
  { survivalChance: 0.92, multiplier: 1.2 },
  { survivalChance: 0.85, multiplier: 1.5 },
  { survivalChance: 0.78, multiplier: 2.0 },
  { survivalChance: 0.7, multiplier: 2.8 },
  { survivalChance: 0.6, multiplier: 4.0 },
  { survivalChance: 0.5, multiplier: 6.0 },
  { survivalChance: 0.4, multiplier: 9.5 },
  { survivalChance: 0.3, multiplier: 16.0 },
];

const BET_STEPS = [5, 10, 25, 50, 100];

export function ProgressionTower({ credits, placeBet, addWinnings, rng, onWin }: ProgressionTowerProps) {
  const [betIndex, setBetIndex] = useState(1);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [roundActive, setRoundActive] = useState(false);
  const [message, setMessage] = useState('Aposte para começar a subir a torre');
  const [busted, setBusted] = useState(false);

  const betAmount = BET_STEPS[betIndex];

  const startRound = useCallback(() => {
    if (roundActive) return;
    if (!placeBet(betAmount)) return;
    soundEngine.click();
    setCurrentLevel(-1);
    setRoundActive(true);
    setBusted(false);
    setMessage('Suba um nível ou saque a qualquer momento');
  }, [roundActive, placeBet, betAmount]);

  const advance = useCallback(() => {
    if (!roundActive) return;
    const nextLevel = currentLevel + 1;
    if (nextLevel >= LEVELS.length) return;

    const config = LEVELS[nextLevel];
    const roll = rng.nextDouble();
    const survived = roll < config.survivalChance;

    if (survived) {
      setCurrentLevel(nextLevel);
      soundEngine.advance();
      setMessage(`Nível ${nextLevel + 1} — multiplicador ${config.multiplier.toFixed(1)}x`);
    } else {
      setRoundActive(false);
      setBusted(true);
      soundEngine.bust();
      setMessage('A torre desabou — aposta perdida. Tente de novo!');
      setCurrentLevel(-1);
    }
  }, [roundActive, currentLevel, rng]);

  const cashOut = useCallback(() => {
    if (!roundActive || currentLevel < 0) return;
    const multiplier = LEVELS[currentLevel].multiplier;
    const payout = Math.round(betAmount * multiplier);
    addWinnings(payout);
    onWin(payout);
    soundEngine.coin();
    setMessage(`Saque de ${payout} créditos no nível ${currentLevel + 1}!`);
    setRoundActive(false);
    setCurrentLevel(-1);
  }, [roundActive, currentLevel, betAmount, addWinnings, onWin]);

  const canDecreaseBet = betIndex > 0 && !roundActive;
  const canIncreaseBet = betIndex < BET_STEPS.length - 1 && !roundActive;
  const canStart = !roundActive && credits >= betAmount;

  return (
    <div className="slot-card">
      <div className="tower">
        {LEVELS.slice().reverse().map((level, revIdx) => {
          const levelIdx = LEVELS.length - 1 - revIdx;
          const isCurrent = levelIdx === currentLevel;
          const isCleared = levelIdx < currentLevel;
          return (
            <div
              key={levelIdx}
              className={`tower__step ${isCurrent ? 'tower__step--current' : ''} ${isCleared ? 'tower__step--cleared' : ''}`}
            >
              <span className="tower__step-label">Nível {levelIdx + 1}</span>
              <span className="tower__step-mult">{level.multiplier.toFixed(1)}x</span>
            </div>
          );
        })}
      </div>

      <div className={`payout-line ${busted ? 'payout-line--bust' : ''}`} aria-live="polite">
        {message}
      </div>

      <div className="controls">
        <div className="bet-control">
          <button className="bet-btn" onClick={() => setBetIndex((i) => Math.max(0, i - 1))} disabled={!canDecreaseBet} aria-label="Diminuir aposta">−</button>
          <div className="bet-amount">
            <span className="bet-amount__label">Aposta</span>
            <span className="bet-amount__value">{betAmount}</span>
          </div>
          <button className="bet-btn" onClick={() => setBetIndex((i) => Math.min(BET_STEPS.length - 1, i + 1))} disabled={!canIncreaseBet} aria-label="Aumentar aposta">+</button>
        </div>

        {!roundActive ? (
          <button className="spin-btn" onClick={startRound} disabled={!canStart}>
            Apostar
          </button>
        ) : (
          <div className="tower-actions">
            <button className="spin-btn spin-btn--secondary" onClick={cashOut} disabled={currentLevel < 0}>
              Sacar
            </button>
            <button className="spin-btn" onClick={advance}>
              Subir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
