import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface DepositScreenProps {
  user: User;
  onDeposited: () => void; // chamado quando o pagamento é confirmado, pra recarregar o saldo
}

interface PixCharge {
  pixRecordId: string;
  qrCode: string;
  qrCodeBase64: string;
  amount: number;
  expiresAt: string;
}

const QUICK_AMOUNTS = [10, 25, 50, 100];
const POLL_INTERVAL_MS = 3000;

export function DepositScreen({ user, onDeposited }: DepositScreenProps) {
  const [amount, setAmount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [status, setStatus] = useState<'pending' | 'approved' | 'expired' | 'rejected'>('pending');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (pixRecordId: string) => {
      stopPolling();
      pollRef.current = window.setInterval(async () => {
        const { data, error: pollError } = await supabase
          .from('pix_payments')
          .select('status, credited')
          .eq('id', pixRecordId)
          .single();

        if (pollError || !data) return;

        if (data.credited) {
          setStatus('approved');
          stopPolling();
          onDeposited();
        } else if (data.status === 'rejected' || data.status === 'cancelled') {
          setStatus('rejected');
          stopPolling();
        } else if (data.status === 'expired') {
          setStatus('expired');
          stopPolling();
        }
      }, POLL_INTERVAL_MS);
    },
    [onDeposited, stopPolling],
  );

  const handleCreateCharge = useCallback(async () => {
    if (!user.email) {
      setError('Sua conta não tem e-mail cadastrado — não é possível gerar PIX.');
      return;
    }

    setLoading(true);
    setError(null);
    setCharge(null);
    setStatus('pending');

    try {
      const response = await fetch('/api/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, userId: user.id, userEmail: user.email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Não foi possível gerar o PIX agora. Tente novamente.');
        setLoading(false);
        return;
      }

      setCharge(data);
      startPolling(data.pixRecordId);
    } catch {
      setError('Falha de conexão. Verifique sua internet e tente de novo.');
    } finally {
      setLoading(false);
    }
  }, [amount, startPolling, user.email, user.id]);

  const handleCopy = useCallback(async () => {
    if (!charge?.qrCode) return;
    try {
      await navigator.clipboard.writeText(charge.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard pode falhar em contexto não-seguro (http) — sem problema,
      // o usuário ainda pode selecionar e copiar o texto manualmente.
    }
  }, [charge]);

  const handleNewCharge = useCallback(() => {
    stopPolling();
    setCharge(null);
    setStatus('pending');
    setError(null);
  }, [stopPolling]);

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">Depositar via PIX</h2>
      <p className="panel-card__subtitle">
        Créditos entram automaticamente assim que o pagamento é confirmado.
      </p>

      {!charge && (
        <>
          <div className="deposit-quick-amounts">
            {QUICK_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                className={`bet-btn deposit-quick-amounts__btn ${amount === v ? 'tab--active' : ''}`}
                onClick={() => setAmount(v)}
              >
                R$ {v}
              </button>
            ))}
          </div>

          <label className="auth-field">
            <span>Valor (R$)</span>
            <input
              type="number"
              min={5}
              max={5000}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(5, Math.min(5000, Number(e.target.value) || 0)))}
            />
          </label>

          {error && <p className="auth-feedback auth-feedback--error">{error}</p>}

          <button type="button" className="spin-btn" onClick={handleCreateCharge} disabled={loading}>
            {loading ? 'Gerando PIX...' : `Gerar PIX de R$ ${amount}`}
          </button>
        </>
      )}

      {charge && status === 'pending' && (
        <div className="deposit-charge">
          <img
            src={`data:image/png;base64,${charge.qrCodeBase64}`}
            alt="QR Code PIX"
            className="deposit-charge__qr"
          />
          <p className="panel-card__subtitle">Escaneie o QR Code ou copie o código abaixo no app do seu banco.</p>
          <div className="deposit-charge__code">
            <code>{charge.qrCode}</code>
          </div>
          <button type="button" className="spin-btn spin-btn--secondary" onClick={handleCopy}>
            {copied ? 'Copiado!' : 'Copiar código PIX'}
          </button>
          <p className="panel-card__subtitle">
            Aguardando pagamento... assim que cair, seus créditos aparecem sozinhos aqui.
          </p>
          <button type="button" className="hud__reset" onClick={handleNewCharge}>
            Cancelar e gerar outro valor
          </button>
        </div>
      )}

      {status === 'approved' && (
        <p className="auth-feedback auth-feedback--ok">Pagamento confirmado! Créditos já estão na sua conta. 🎉</p>
      )}
      {status === 'expired' && (
        <>
          <p className="auth-feedback auth-feedback--error">Esse PIX expirou.</p>
          <button type="button" className="spin-btn" onClick={handleNewCharge}>
            Gerar novo PIX
          </button>
        </>
      )}
      {status === 'rejected' && (
        <>
          <p className="auth-feedback auth-feedback--error">Esse pagamento não foi aprovado.</p>
          <button type="button" className="spin-btn" onClick={handleNewCharge}>
            Tentar de novo
          </button>
        </>
      )}
    </div>
  );
}
