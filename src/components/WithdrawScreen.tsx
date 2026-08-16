import { useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface WithdrawScreenProps {
  user: User;
  credits: number;
  kycDone: boolean;
  onWithdrawn: (newBalance: number) => void;
}

type Step = 'kyc' | 'choose' | 'confirm' | 'processing' | 'success' | 'error';

const QUICK_AMOUNTS = [20, 50, 100, 200];
const MIN_WITHDRAWAL = 20;
const MAX_WITHDRAWAL = 2000;

const PIX_KEY_TYPES = [
  { id: 'cpf', label: 'CPF' },
  { id: 'email', label: 'E-mail' },
  { id: 'telefone', label: 'Telefone' },
  { id: 'aleatoria', label: 'Aleatória' },
];

const DOCUMENT_TYPES = [
  { id: 'CPF', label: 'CPF' },
  { id: 'CNPJ', label: 'CNPJ' },
];

const REASONS: Record<string, string> = {
  below_minimum: `Valor mínimo: R$ ${MIN_WITHDRAWAL}`,
  above_maximum: `Valor máximo: R$ ${MAX_WITHDRAWAL}`,
  insufficient_balance: 'Créditos insuficientes.',
  invalid_pix_key: 'Chave PIX inválida.',
  pending_withdrawal_exists: 'Você já tem um saque pendente. Aguarde o processamento.',
  invalid_name: 'Nome completo inválido.',
  invalid_document_type: 'Tipo de documento inválido.',
};

export function WithdrawScreen({ user, credits, kycDone, onWithdrawn }: WithdrawScreenProps) {
  const [step, setStep] = useState<Step>(kycDone ? 'choose' : 'kyc');
  const [amount, setAmount] = useState(50);
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [pixKey, setPixKey] = useState('');
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CPF');
  const [documentNumber, setDocumentNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const handleDocumentNumberChange = (v: string) => {
    const maxLen = documentType === 'CNPJ' ? 14 : 11;
    setDocumentNumber(v.replace(/\D/g, '').slice(0, maxLen));
    setErrorMsg('');
  };

  const saveKycAndContinue = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const expectedLen = documentType === 'CNPJ' ? 14 : 11;
    if (fullName.trim().length < 5) {
      setErrorMsg('Informe seu nome completo.');
      return;
    }
    if (documentNumber.length !== expectedLen) {
      setErrorMsg(`${documentType} deve ter ${expectedLen} dígitos.`);
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('update_kyc_data', {
        p_user_id: user.id,
        p_full_name: fullName.trim(),
        p_document_type: documentType,
        p_document_number: documentNumber,
      });

      if (error) {
        setErrorMsg('Erro ao salvar seus dados. Tente novamente.');
        return;
      }
      if (!data.ok) {
        setErrorMsg(REASONS[data.reason] || 'Não foi possível salvar seus dados.');
        return;
      }

      setStep('choose');
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const validateAndGoToConfirm = () => {
    setErrorMsg('');
    if (amount < MIN_WITHDRAWAL) {
      setErrorMsg(`Valor mínimo: R$ ${MIN_WITHDRAWAL}`);
      return;
    }
    if (amount > MAX_WITHDRAWAL) {
      setErrorMsg(`Valor máximo: R$ ${MAX_WITHDRAWAL}`);
      return;
    }
    if (amount > credits) {
      setErrorMsg('Créditos insuficientes para esse saque.');
      return;
    }
    if (pixKey.trim().length < 3) {
      setErrorMsg('Informe uma chave PIX válida.');
      return;
    }
    setStep('confirm');
  };

  const confirmWithdrawal = async () => {
    setStep('processing');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.rpc('request_withdrawal', {
        p_user_id: user.id,
        p_amount: amount,
        p_pix_key: pixKey.trim(),
        p_pix_key_type: pixKeyType,
      });

      if (error) {
        setErrorMsg('Erro ao processar saque. Tente novamente.');
        setStep('confirm');
        return;
      }

      if (!data.ok) {
        if (data.reason === 'kyc_incomplete') {
          setErrorMsg('Confirme seus dados antes de sacar.');
          setStep('kyc');
          return;
        }
        setErrorMsg(REASONS[data.reason] || 'Não foi possível processar o saque.');
        setStep('confirm');
        return;
      }

      onWithdrawn(data.new_balance);
      setStep('success');

      // Dispara o processamento automático (se dentro do limite, paga na
      // hora; senão fica pendente pra aprovação manual).
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (accessToken) {
        fetch('/api/auto-process-withdrawal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ withdrawalId: data.withdrawal_id }),
        }).catch(() => {});
      }
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.');
      setStep('confirm');
    }
  };

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">Sacar via PIX</h2>

      {step !== 'kyc' && step !== 'success' && (
        <p className="panel-card__subtitle">Créditos disponíveis: {credits}</p>
      )}

      {errorMsg && <p className="auth-feedback auth-feedback--error">{errorMsg}</p>}

      {step === 'kyc' && (
        <form className="auth-form" onSubmit={saveKycAndContinue}>
          <p className="panel-card__subtitle">
            Confirme seu nome e CPF/CNPJ. O PIX só pode ser enviado pra uma chave em seu próprio nome.
          </p>

          <label className="auth-field">
            <span>Nome completo</span>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setErrorMsg('');
              }}
              placeholder="Seu nome completo"
            />
          </label>

          <div className="deposit-quick-amounts">
            {DOCUMENT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`bet-btn deposit-quick-amounts__btn ${documentType === t.id ? 'tab--active' : ''}`}
                onClick={() => {
                  setDocumentType(t.id as 'CPF' | 'CNPJ');
                  setDocumentNumber('');
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="auth-field">
            <span>{documentType} (somente números)</span>
            <input
              type="text"
              inputMode="numeric"
              required
              value={documentNumber}
              onChange={(e) => handleDocumentNumberChange(e.target.value)}
              placeholder={documentType === 'CNPJ' ? '14 dígitos' : '11 dígitos'}
            />
          </label>

          <button type="submit" className="spin-btn" disabled={busy}>
            {busy ? 'Salvando...' : 'Continuar'}
          </button>
        </form>
      )}

      {step === 'choose' && (
        <>
          <div className="deposit-quick-amounts">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                className={`bet-btn deposit-quick-amounts__btn ${amount === v ? 'tab--active' : ''}`}
                onClick={() => {
                  setAmount(v);
                  setErrorMsg('');
                }}
              >
                R$ {v}
              </button>
            ))}
          </div>

          <label className="auth-field">
            <span>Valor (R$)</span>
            <input
              type="number"
              min={MIN_WITHDRAWAL}
              max={MAX_WITHDRAWAL}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
          </label>

          <div className="deposit-quick-amounts">
            {PIX_KEY_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`bet-btn deposit-quick-amounts__btn ${pixKeyType === t.id ? 'tab--active' : ''}`}
                onClick={() => setPixKeyType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="auth-field">
            <span>Chave PIX</span>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => {
                setPixKey(e.target.value);
                setErrorMsg('');
              }}
              placeholder={`Digite sua chave (${PIX_KEY_TYPES.find((t) => t.id === pixKeyType)?.label})`}
            />
          </label>

          <button type="button" className="spin-btn" onClick={validateAndGoToConfirm}>
            Continuar — R$ {amount}
          </button>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="deposit-charge">
            <p className="panel-card__subtitle">Valor do saque</p>
            <p className="hud__pill-value" style={{ fontSize: 28 }}>
              R$ {amount}
            </p>
            <p className="panel-card__subtitle">
              Chave PIX ({PIX_KEY_TYPES.find((t) => t.id === pixKeyType)?.label}): {pixKey}
            </p>
            <p className="panel-card__subtitle">
              O valor será debitado do seu saldo agora. O PIX é processado em até 24h úteis.
            </p>
          </div>
          <button type="button" className="hud__reset" onClick={() => setStep('choose')}>
            Voltar
          </button>
          <button type="button" className="spin-btn" onClick={confirmWithdrawal}>
            Confirmar saque
          </button>
        </>
      )}

      {step === 'processing' && <p className="panel-card__subtitle">Processando solicitação...</p>}

      {step === 'success' && (
        <>
          <p className="auth-feedback auth-feedback--ok">
            Saque solicitado! R$ {amount} já foi debitado do seu saldo. Seu PIX será processado em até 24h úteis.
          </p>
        </>
      )}
    </div>
  );
}
