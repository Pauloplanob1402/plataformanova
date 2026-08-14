import { useMemo } from 'react';
import { SYMBOL_IMAGES } from '../symbols/images';

export interface CelebrationData {
  key: number;
  amount: number;
  big: boolean;
}

interface WinCelebrationProps {
  data: CelebrationData | null;
}

interface CoinParticle {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  rotations: number;
}

function buildCoins(count: number): CoinParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 20 + Math.random() * 30,
    delay: Math.random() * 1.7,
    duration: 1.5 + Math.random() * 1.1,
    drift: (Math.random() - 0.5) * 160,
    rotations: 3 + Math.round(Math.random() * 3),
  }));
}

export function WinCelebration({ data }: WinCelebrationProps) {
  const coins = useMemo(() => (data ? buildCoins(data.big ? 160 : 90) : []), [data?.key]);

  if (!data) return null;

  return (
    <div className="win-celebration" aria-hidden="true">
      <div className="win-celebration__flash" />

      {coins.map((c) => (
        <span
          key={c.id}
          className="win-celebration__coin"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`,
            // @ts-expect-error CSS custom properties
            '--drift': `${c.drift}px`,
            '--rot': `${c.rotations * 360}deg`,
          }}
        >
          <img src={SYMBOL_IMAGES.coin} alt="" />
        </span>
      ))}

      <div className={`win-celebration__banner ${data.big ? 'win-celebration__banner--big' : ''}`}>
        <span className="win-celebration__title">{data.big ? 'GRANDE VITÓRIA!' : 'VOCÊ GANHOU!'}</span>
        <span className="win-celebration__amount">+{data.amount} créditos</span>
      </div>
    </div>
  );
}
