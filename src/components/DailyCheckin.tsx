import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface DailyCheckinProps {
  user: User;
  onBalanceChange: (newBalance: number) => void;
}

function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Espelha a mesma escala de public.daily_checkin() (0004_vip.sql) — Bronze
 *  50 / Prata 75 / Ouro 100 — só pra MOSTRAR o valor correto antes de
 *  resgatar. Quem decide de verdade continua sendo o servidor. */
function expectedReward(totalWagered: number): number {
  if (totalWagered >= 5000) return 100;
  if (totalWagered >= 1000) return 75;
  return 50;
}

export function DailyCheckin({ user, onBalanceChange }: DailyCheckinProps) {
  const [loading, setLoading] = useState(true);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);
  const [displayReward, setDisplayReward] = useState(50);

  const checkStatus = useCallback(async () => {
    setLoading(true);

    const [{ data: checkinData, error: checkinError }, { data: vipData }] = await Promise.all([
      supabase
        .from('daily_checkins')
        .select('checkin_date')
        .eq('user_id', user.id)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('user_vip_status').select('total_wagered').eq('user_id', user.id).maybeSingle(),
    ]);

    if (!checkinError && checkinData?.checkin_date === todayUtcIso()) {
      setAlreadyDone(true);
    } else {
      setAlreadyDone(false);
    }
    setDisplayReward(expectedReward(vipData?.total_wagered ?? 0));
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
        <span className="daily-checkin__reward-value">+{displayReward}</span>
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
