import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface ReferralScreenProps {
  user: User;
  onBalanceChange: (newBalance: number) => void;
}

interface ReferralProfile {
  referral_code: string;
  referred_by: string | null;
}

function translateReferralError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('próprio código')) return 'Você não pode usar o seu próprio código.';
  if (m.includes('já usou um código')) return 'Você já usou um código de indicação antes.';
  if (m.includes('inválido')) return 'Código de indicação inválido.';
  if (m.includes('digite um código')) return 'Digite um código de indicação.';
  return 'Não foi possível aplicar esse código agora.';
}

export function ReferralScreen({ user, onBalanceChange }: ReferralScreenProps) {
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [inputCode, setInputCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('referral_code, referred_by')
      .eq('id', user.id)
      .single();
    if (!error && data) setProfile(data);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleCopy = useCallback(async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.referral_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard pode falhar em contexto não-seguro; sem problema, o código já está visível na tela
    }
  }, [profile]);

  const handleApply = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!inputCode.trim()) return;

      setApplying(true);
      setMessage(null);

      const { data, error } = await supabase.rpc('apply_referral', {
        p_referral_code: inputCode.trim().toUpperCase(),
      });

      if (error) {
        setMessage({ text: translateReferralError(error.message), kind: 'error' });
      } else {
        const result = data as { bonus: number; new_balance: number };
        onBalanceChange(result.new_balance);
        setMessage({ text: `Código aplicado! +${result.bonus} créditos.`, kind: 'ok' });
        loadProfile();
      }
      setApplying(false);
    },
    [inputCode, onBalanceChange, loadProfile],
  );

  if (loading) {
    return (
      <div className="panel-card">
        <h2 className="panel-card__title">Indique e ganhe</h2>
        <p className="panel-card__subtitle">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">Indique e ganhe</h2>
      <p className="panel-card__subtitle">Compartilhe seu código e ganhe créditos quando alguém usar.</p>

      <div className="referral-code">
        <span className="referral-code__value">{profile?.referral_code}</span>
        <button type="button" className="hud__icon-btn" onClick={handleCopy} aria-label="Copiar código">
          {copied ? '✅' : '📋'}
        </button>
      </div>

      {!profile?.referred_by && (
        <form className="auth-form" onSubmit={handleApply}>
          <label className="auth-field">
            <span>Foi indicado por alguém? Digite o código</span>
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Código de quem te indicou"
              autoCapitalize="characters"
              maxLength={20}
            />
          </label>

          {message && <p className={`auth-feedback auth-feedback--${message.kind}`}>{message.text}</p>}

          <button type="submit" className="spin-btn" disabled={applying || !inputCode.trim()}>
            {applying ? 'Aplicando...' : 'Aplicar código'}
          </button>
        </form>
      )}

      {profile?.referred_by && (
        <p className="auth-feedback auth-feedback--ok">Você já usou um código de indicação. Obrigado!</p>
      )}
    </div>
  );
}
