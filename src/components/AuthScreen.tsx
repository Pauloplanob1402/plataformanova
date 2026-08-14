import { useState, type FormEvent } from 'react';
import mascoteTigre from '../assets/mascote-tigre.webp';
import { supabase } from '../core/supabaseClient';

type Mode = 'signin' | 'signup';
type Method = 'email' | 'phone';

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
  if (m.includes('sms')) return 'Não foi possível enviar o SMS agora. Tente entrar por e-mail.';
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
      if (method === 'phone' && mode === 'signin' && password.length === 0) {
        // Login por telefone sem senha => envia OTP por SMS.
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
        if (otpError) throw otpError;
        setNotice('Enviamos um código por SMS. Confira seu telefone.');
        return;
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword(
          method === 'email' ? { email, password } : { phone, password },
        );
        if (signInError) throw signInError;
      } else {
        const { error: signUpError } = await supabase.auth.signUp(
          method === 'email' ? { email, password } : { phone, password },
        );
        if (signUpError) throw signUpError;
        setNotice(
          method === 'email'
            ? 'Conta criada! Verifique seu e-mail para confirmar o cadastro.'
            : 'Conta criada! Verifique o SMS para confirmar o cadastro.',
        );
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
        <img src={mascoteTigre} alt="Mascote Tigrinho" className="auth-card__mascot" />
        <h1 className="auth-card__title">Tigrinho da Sorte</h1>

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
            <span>Senha {method === 'phone' && mode === 'signin' ? '(deixe em branco para receber código por SMS)' : ''}</span>
            <input
              type="password"
              required={!(method === 'phone' && mode === 'signin')}
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
