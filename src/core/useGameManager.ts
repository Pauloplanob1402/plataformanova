import { useCallback, useMemo, useRef, useState } from 'react';
import { RandomProvider } from './random';

const STARTING_CREDITS = 1000;

export interface SessionStats {
  totalWagered: number;
  totalWon: number;
}

export function useGameManager() {
  const [credits, setCredits] = useState(STARTING_CREDITS);
  const [stats, setStats] = useState<SessionStats>({ totalWagered: 0, totalWon: 0 });
  // Uma instância estável do RNG por sessão de jogo (não recriada a cada render).
  const rngRef = useRef<RandomProvider>(new RandomProvider());

  const placeBet = useCallback((amount: number): boolean => {
    let accepted = false;
    setCredits((current) => {
      if (amount <= 0 || amount > current) {
        accepted = false;
        return current;
      }
      accepted = true;
      return current - amount;
    });
    if (accepted) {
      setStats((s) => ({ ...s, totalWagered: s.totalWagered + amount }));
    }
    return accepted;
  }, []);

  const addWinnings = useCallback((amount: number) => {
    if (amount <= 0) return;
    setCredits((current) => current + amount);
    setStats((s) => ({ ...s, totalWon: s.totalWon + amount }));
  }, []);

  const resetCredits = useCallback(() => {
    setCredits(STARTING_CREDITS);
    setStats({ totalWagered: 0, totalWon: 0 });
  }, []);

  const sessionRtp = useMemo(() => {
    if (stats.totalWagered <= 0) return 0;
    return stats.totalWon / stats.totalWagered;
  }, [stats]);

  return {
    credits,
    stats,
    sessionRtp,
    placeBet,
    addWinnings,
    resetCredits,
    rng: rngRef.current,
  };
}
