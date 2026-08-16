import { useState, type FormEvent } from 'react';
import bannerSorteAcordou from '../assets/banner-sorte-acordou.webp';
import { supabase } from '../core/supabaseClient';

type Mode = 'signin' | 'signup';
type Method = 'email' | 'phone';

const BANNER_DISMISS_KEY = 'tigrinho:banner-auth-dismissed';

/** Converte telefone em dígitos pro mesmo e-mail interno usado no cadastro. */
function phoneToFakeEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel${digits}@long777.phone`;
}

/** Traduz os erros mais comuns do Supabase Auth para mensagens amigáveis em PT-BR. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail/telefone ou senha incorretos.';
  if (m.includes('user already registered') || m.includes('already registered')) {
    return 'Já existe uma conta com esse e-mail. Tente entrar em vez de criar conta.';
  }
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'Esse e-mail não parece válido.';
  }
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um instante e tente de novo.';
  return 'Algo deu errado. Tente novamente em instantes.';
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [method, setMethod] = useState<Method>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_DISMISS_KEY) === '1';
    } catch {
      return false; // localStorage pode falhar em modo privado — sem problema, só não lembra a escolha
    }
  });

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(BANNER_DISMISS_KEY, '1');
    } catch {
      // sem problema se não conseguir salvar — só reaparece na próxima visita
    }
  };

  const resetFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    resetFeedback();

    if (mode === 'signup' && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        if (method === 'email') {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
        } else {
          // Telefone: converte pro mesmo e-mail interno fake usado no cadastro
          // (tel<digitos>@long777.phone) — sem SMS, sem custo.
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: phoneToFakeEmail(phone),
            password,
          });
          if (signInError) throw signInError;
        }
      } else {
        if (method === 'email') {
          const { error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) throw signUpError;
          setNotice('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
        } else {
          // Telefone: cadastro passa pelo backend (api/phone-signup), que usa
          // a service_role key pra criar a conta já confirmada, sem enviar SMS.
          const response = await fetch('/api/phone-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Não foi possível criar a conta.');
          }
          // Conta já nasce confirmada — loga automaticamente em seguida.
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: phoneToFakeEmail(phone),
            password,
          });
          if (signInError) throw signInError;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(translateAuthError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {!bannerDismissed && (
          <div className="auth-card__banner-wrap">
            <img src={bannerSorteAcordou} alt="Banner promocional do Tigrinho da Sorte" className="auth-card__banner" />
            <button
              type="button"
              className="auth-card__banner-close"
              onClick={dismissBanner}
              aria-label="Fechar banner"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        )}
        <p className="auth-card__brand">Tigrinho da Sorte</p>

        <div className="tabs" role="tablist" aria-label="Entrar ou criar conta">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            className={`tab ${mode === 'signin' ? 'tab--active' : ''}`}
            onClick={() => {
              setMode('signin');
              resetFeedback();
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={`tab ${mode === 'signup' ? 'tab--active' : ''}`}
            onClick={() => {
              setMode('signup');
              resetFeedback();
            }}
          >
            Criar conta
          </button>
        </div>

        <div className="tabs tabs--secondary" role="tablist" aria-label="Método de login">
          <button
            type="button"
            role="tab"
            aria-selected={method === 'email'}
            className={`tab tab--sm ${method === 'email' ? 'tab--active' : ''}`}
            onClick={() => {
              setMethod('email');
              resetFeedback();
            }}
          >
            E-mail
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === 'phone'}
            className={`tab tab--sm ${method === 'phone' ? 'tab--active' : ''}`}
            onClick={() => {
              setMethod('phone');
              resetFeedback();
            }}
          >
            Telefone
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {method === 'email' ? (
            <label className="auth-field">
              <span>E-mail</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </label>
          ) : (
            <label className="auth-field">
              <span>Telefone</span>
              <input
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Senha</span>
            <input
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
            />
          </label>

          {mode === 'signup' && (
            <label className="auth-field">
              <span>Confirmar senha</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </label>
          )}

          {error && <p className="auth-feedback auth-feedback--error">{error}</p>}
          {notice && <p className="auth-feedback auth-feedback--ok">{notice}</p>}

          <button type="submit" className="spin-btn" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
}
