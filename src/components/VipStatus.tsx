import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface VipStatusProps {
  user: User;
}

interface VipRow {
  total_wagered: number;
  vip_tier: 'Bronze' | 'Prata' | 'Ouro';
  vip_level: number;
  next_threshold: number | null;
}

const TIER_BADGE: Record<VipRow['vip_tier'], string> = {
  Bronze: '🥉',
  Prata: '🥈',
  Ouro: '🥇',
};

const TIER_FLOOR: Record<VipRow['vip_tier'], number> = {
  Bronze: 0,
  Prata: 1000,
  Ouro: 5000,
};

export function VipStatus({ user }: VipStatusProps) {
  const [status, setStatus] = useState<VipRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('user_vip_status').select('*').single();
    if (!error && data) setStatus(data as VipRow);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="panel-card">
        <h2 className="panel-card__title">Status VIP</h2>
        <p className="panel-card__subtitle">Carregando...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="panel-card">
        <h2 className="panel-card__title">Status VIP</h2>
        <p className="panel-card__subtitle">Não foi possível carregar seu status agora.</p>
      </div>
    );
  }

  const floor = TIER_FLOOR[status.vip_tier];
  const progressPct = status.next_threshold
    ? Math.min(100, Math.round(((status.total_wagered - floor) / (status.next_threshold - floor)) * 100))
    : 100;

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">Status VIP</h2>
      <p className="panel-card__subtitle">Seu nível sobe conforme você joga.</p>

      <div className="vip-card__tier">
        <span className="vip-card__badge">{TIER_BADGE[status.vip_tier]}</span>
        <div>
          <p className="vip-card__tier-name">{status.vip_tier}</p>
          <p className="vip-card__tier-sub">{status.total_wagered} créditos apostados no total</p>
        </div>
      </div>

      <div className="vip-progress">
        <div className="vip-progress__fill" style={{ width: `${progressPct}%` }} />
      </div>
      <p className="vip-progress__label">
        {status.next_threshold
          ? `Faltam ${status.next_threshold - status.total_wagered} créditos apostados para o próximo nível`
          : 'Nível máximo alcançado!'}
      </p>
    </div>
  );
}
