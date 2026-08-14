import { useCallback, useState, type FormEvent } from 'react';
import { supabase } from '../core/supabaseClient';

interface RedeemCodeProps {
  onBalanceChange: (newBalance: number) => void;
}

/** Traduz os erros mais comuns devolvidos pela função redeem_code(). */
function translateRedeemError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('inválido')) return 'Código inválido.';
  if (m.includes('expirou')) return 'Este código expirou.';
  if (m.includes('limite de usos')) return 'Este código já atingiu o limite de usos.';
  if (m.includes('já usou')) return 'Você já usou este código antes.';
  if (m.includes('digite um código')) return 'Digite um código.';
  return 'Não foi possível resgatar esse código agora.';
}

export function RedeemCode({ onBalanceChange }: RedeemCodeProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;

      setLoading(true);
      setMessage(null);

      const { data, error } = await supabase.rpc('redeem_code', { p_code: code.trim().toUpperCase() });

      if (error) {
        setMessage({ text: translateRedeemError(error.message), kind: 'error' });
      } else {
        const result = data as { reward: number; new_balance: number };
        onBalanceChange(result.new_balance);
        setMessage({ text: `+${result.reward} créditos resgatados!`, kind: 'ok' });
        setCode('');
      }
      setLoading(false);
    },
    [code, onBalanceChange],
  );

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">Código de resgate</h2>
      <p className="panel-card__subtitle">Tem um código promocional? Digite abaixo.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Código</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="EX: TIGRE2026"
            autoCapitalize="characters"
            maxLength={40}
          />
        </label>

        {message && <p className={`auth-feedback auth-feedback--${message.kind}`}>{message.text}</p>}

        <button type="submit" className="spin-btn" disabled={loading || !code.trim()}>
          {loading ? 'Resgatando...' : 'Resgatar'}
        </button>
      </form>
    </div>
  );
}
