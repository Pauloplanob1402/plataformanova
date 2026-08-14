import { useCallback, useMemo, useState } from 'react';

export interface SessionStats {
  totalWagered: number;
  totalWon: number;
}

/**
 * Estatística só de exibição (RTP da sessão atual na tela). O saldo de
 * créditos de verdade vive no Supabase (profiles.credits) — isto aqui não
 * afeta créditos, é só um contador local que reseta ao recarregar a página.
 */
export function useSessionStats() {
  const [stats, setStats] = useState<SessionStats>({ totalWagered: 0, totalWon: 0 });

  const recordSpin = useCallback((betAmount: number, payout: number) => {
    setStats((s) => ({ totalWagered: s.totalWagered + betAmount, totalWon: s.totalWon + payout }));
  }, []);

  const resetStats = useCallback(() => setStats({ totalWagered: 0, totalWon: 0 }), []);

  const sessionRtp = useMemo(() => {
    if (stats.totalWagered <= 0) return 0;
    return stats.totalWon / stats.totalWagered;
  }, [stats]);

  return { stats, sessionRtp, recordSpin, resetStats };
}
