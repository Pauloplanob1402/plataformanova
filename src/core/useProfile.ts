import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

export interface UseProfileResult {
  credits: number | null;
  loading: boolean;
  error: string | null;
  /** Atualiza o saldo exibido imediatamente (ex: com o new_balance devolvido por uma RPC),
   *  sem esperar um round-trip de SELECT. O valor real de verdade sempre é o do banco. */
  setCreditsLocally: (credits: number) => void;
  refetch: () => Promise<void>;
}

/**
 * Lê profiles.credits do usuário logado e mantém sincronizado via Supabase
 * Realtime — se o saldo mudar no banco (bônus diário, código resgatado,
 * indicação, ou até outra aba aberta), a tela atualiza sozinha.
 */
export function useProfile(user: User | null): UseProfileResult {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setCredits(null);
      setLoading(false);
      return;
    }
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      setError('Não foi possível carregar seu saldo agora.');
    } else {
      setError(null);
      setCredits(data.credits);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-credits-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const newCredits = (payload.new as { credits?: number }).credits;
          if (typeof newCredits === 'number') setCredits(newCredits);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const setCreditsLocally = useCallback((value: number) => {
    setCredits(value);
  }, []);

  return { credits, loading, error, setCreditsLocally, refetch: fetchProfile };
}
