import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface DailyCheckinProps {
  user: User;
  onBalanceChange: (newBalance: number) => void;
}

// Mesmo valor fixo usado em supabase/migrations/0002_functions.sql (daily_checkin).
// Se você mudar lá, mude aqui também — isto é só o texto exibido, o valor de
// verdade quem decide é o servidor.
const DISPLAY_REWARD = 50;

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DailyCheckin({ user, onBalanceChange }: DailyCheckinProps) {
  const [loading, setLoading] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('daily_checkins')
      .select('checkin_date')
      .eq('user_id', user.id)
      .order('checkin_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.checkin_date === todayUtcIso()) {
      setAlreadyDone(true);
    } else {
      setAlreadyDone(false);
    }
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleClaim = useCallback(async () => {
    setClaiming(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('daily_checkin');

    if (error) {
      setMessage({ text: 'Você já resgatou o bônus de hoje. Volte amanhã!', kind: 'error' });
      setAlreadyDone(true);
    } else {
      const reward = (data as { reward: number; new_balance: number }).reward;
      const newBalance = (data as { reward: number; new_balance: number }).new_balance;
      onBalanceChange(newBalance);
      setMessage({ text: `+${reward} créditos resgatados!`, kind: 'ok' });
      setAlreadyDone(true);
    }
    setClaiming(false);
  }, [onBalanceChange]);

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">Bônus diário</h2>
      <p className="panel-card__subtitle">Volte todo dia e resgate créditos grátis.</p>

      <div className="daily-checkin__reward">
        <span className="daily-checkin__reward-value">+{DISPLAY_REWARD}</span>
        <span className="daily-checkin__reward-label">créditos</span>
      </div>

      {message && <p className={`auth-feedback auth-feedback--${message.kind}`}>{message.text}</p>}

      <button
        className="spin-btn"
        onClick={handleClaim}
        disabled={loading || claiming || alreadyDone}
      >
        {loading ? 'Verificando...' : alreadyDone ? 'Já resgatado hoje' : claiming ? 'Resgatando...' : 'Resgatar'}
      </button>
    </div>
  );
}
