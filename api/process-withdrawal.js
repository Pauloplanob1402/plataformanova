// ═══════════════════════════════════════════════════════════════
//  /api/process-withdrawal
//  Pra aprovar um saque manualmente — usado pros saques ACIMA do
//  limite automático (AUTO_WITHDRAWAL_THRESHOLD).
//
//  Autenticação: Bearer token do próprio usuário admin logado (o
//  usuário precisa ter app_metadata.role = 'admin' no Supabase Auth
//  — configure isso manualmente em Authentication -> Users -> editar
//  usuário -> Raw App Meta Data -> {"role": "admin"}).
//
//  Este endpoint hoje não tem um painel visual chamando ele — dá pra
//  chamar direto (ex: via curl/Postman) até você decidir se quer um
//  painel admin dedicado no Tigrinho, igual o Rodadafortuna tem.
//
//  Migrado do Rodadafortuna — mesma lógica, sem alterações.
// ═══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js'
import { sendPixTransfer } from '../lib/mercadopago-transfer.js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' })
  }

  try {
    // ── Autentica o admin pelo próprio token de sessão ──────────
    const authHeader = req.headers['authorization'] || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user) {
      return res.status(401).json({ error: 'Token inválido' })
    }
    if (userData.user.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores' })
    }

    const { withdrawalId } = req.body
    if (!withdrawalId) {
      return res.status(400).json({ error: 'withdrawalId obrigatório' })
    }

    // ── Trava o saque pra 'processing' (evita clique duplo) ─────
    const { data: claim, error: claimError } = await supabaseAdmin
      .rpc('claim_withdrawal_for_processing', { p_withdrawal_id: withdrawalId })

    if (claimError || !claim?.ok) {
      return res.status(409).json({ error: 'Saque não está pendente ou já foi processado' })
    }

    // ── Tenta enviar o PIX de verdade ────────────────────────────
    const result = await sendPixTransfer({
      accessToken: MP_ACCESS_TOKEN,
      amount: claim.amount,
      pixKey: claim.pix_key,
      pixKeyType: claim.pix_key_type,
      recipientName: claim.recipient_name,
      documentType: claim.document_type,
      documentNumber: claim.document_number,
      idempotencyKey: `withdrawal-${withdrawalId}`,
    })

    if (result.ok) {
      await supabaseAdmin.rpc('admin_process_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_new_status: 'completed',
        p_mp_payment_id: result.mpTransferId,
      })
      return res.status(200).json({ ok: true, mpTransferId: result.mpTransferId })
    }

    // ── Falhou: devolve o saldo automaticamente ─────────────────
    await supabaseAdmin.rpc('admin_process_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_new_status: 'rejected',
      p_rejection_reason: result.message,
    })

    return res.status(502).json({
      error: result.notSupported
        ? 'API de transferência do Mercado Pago não disponível para esta conta. Saldo devolvido.'
        : `Falha ao enviar PIX: ${result.message}. Saldo devolvido.`,
    })

  } catch (err) {
    console.error('[process-withdrawal] exceção:', err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
