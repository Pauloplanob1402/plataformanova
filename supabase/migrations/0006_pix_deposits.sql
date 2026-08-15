-- =============================================================================
-- Tigrinho da Sorte — 0006: Depósito real via PIX (Mercado Pago)
-- =============================================================================
-- Migrado do Rodadafortuna/Fortuna do Tigre (supabase_fase5.sql), adaptado
-- pro schema deste projeto: lá o saldo mora em profiles.balance, aqui é
-- profiles.credits. A lógica de segurança é idêntica e já foi testada em
-- produção no projeto de origem:
--   1. Todo insert/update em pix_payments passa por RPC SECURITY DEFINER —
--      o client nunca escreve direto na tabela nem em profiles.credits.
--   2. Idempotência garantida pelo campo "credited" com lock (FOR UPDATE):
--      mesmo que o webhook do Mercado Pago chegue duplicado, o saldo nunca
--      é creditado duas vezes para o mesmo pagamento.
--   3. O backend (api/webhook.js) NUNCA confia só no payload do webhook —
--      sempre confirma o status direto na API do Mercado Pago antes de
--      chamar confirm_pix_payment.
--
-- IMPORTANTE: a partir desta migration, profiles.credits deixa de ser só
-- "DEMO" — passa a representar saldo real depositado via PIX. Revise as
-- regras/avisos de créditos DEMO no restante do app (textos, telas) antes
-- de divulgar o depósito real pros usuários.
--
-- Rode DEPOIS de 0001-0005 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. tabela pix_payments
-- -----------------------------------------------------------------------------
create table if not exists public.pix_payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  mp_payment_id   text unique,              -- id retornado pelo Mercado Pago
  amount          integer not null check (amount > 0), -- em créditos (1 crédito = R$1, ajuste se usar outra proporção)
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected','cancelled','expired','refunded','charged_back')),
  qr_code         text,                     -- código copia-e-cola do PIX
  qr_code_base64  text,                     -- imagem do QR em base64
  credited        boolean not null default false, -- trava de idempotência
  credited_at     timestamptz,
  expires_at      timestamptz not null default (now() + interval '30 minutes'),
  raw_webhook     jsonb,                    -- payload completo do último webhook (auditoria)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.pix_payments is 'Cobranças PIX reais via Mercado Pago. Créditos só entram em profiles.credits depois de status=approved confirmado direto na API do MP.';

create index if not exists idx_pix_payments_user   on public.pix_payments(user_id);
create index if not exists idx_pix_payments_mp_id  on public.pix_payments(mp_payment_id);
create index if not exists idx_pix_payments_status on public.pix_payments(status);

-- -----------------------------------------------------------------------------
-- 2. RLS — usuário só enxerga os próprios pagamentos, nunca escreve direto
-- -----------------------------------------------------------------------------
alter table public.pix_payments enable row level security;

drop policy if exists "pix_payments_select_own" on public.pix_payments;
create policy "pix_payments_select_own"
  on public.pix_payments for select
  using (auth.uid() = user_id);

-- Nenhum insert/update direto pelo client: tudo passa pelas Vercel Functions
-- (api/create-pix.js e api/webhook.js) usando a service_role key, que
-- bypassa RLS de propósito — é o único "portão" autorizado.

-- -----------------------------------------------------------------------------
-- 3. trigger updated_at (reaproveita a function já criada em 0001_init.sql;
--    se você nunca criou handle_updated_at, o bloco abaixo cria agora)
-- -----------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pix_payments_updated_at on public.pix_payments;
create trigger pix_payments_updated_at
  before update on public.pix_payments
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 4. tabela transactions — histórico financeiro (depósitos, e no futuro saques)
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in ('deposit', 'withdrawal', 'adjustment')),
  amount          integer not null,
  balance_after   integer not null,
  description     text,
  pix_id          text, -- mp_payment_id, quando aplicável
  created_at      timestamptz not null default now()
);

comment on table public.transactions is 'Histórico financeiro (depósitos reais confirmados, e futuramente saques). Só é escrito pelas funções RPC SECURITY DEFINER.';

create index if not exists idx_transactions_user on public.transactions(user_id);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. RPC: criar cobrança PIX (chamada por api/create-pix.js)
-- -----------------------------------------------------------------------------
create or replace function public.create_pix_record(
  p_user_id uuid,
  p_amount  integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.pix_payments (user_id, amount, status)
  values (p_user_id, p_amount, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_pix_record(uuid, integer) from public;
-- Não é concedido "authenticated" de propósito: só a service_role (backend) chama esta função.

-- -----------------------------------------------------------------------------
-- 6. RPC: vincular mp_payment_id após criar a cobrança no Mercado Pago
-- -----------------------------------------------------------------------------
create or replace function public.attach_mp_payment_id(
  p_pix_record_id  uuid,
  p_mp_payment_id  text,
  p_qr_code        text,
  p_qr_code_base64 text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.pix_payments
  set mp_payment_id  = p_mp_payment_id,
      qr_code        = p_qr_code,
      qr_code_base64 = p_qr_code_base64
  where id = p_pix_record_id;
end;
$$;

revoke all on function public.attach_mp_payment_id(uuid, text, text, text) from public;

-- -----------------------------------------------------------------------------
-- 7. RPC: confirmar pagamento e creditar saldo (idempotente)
--    Chamada por api/webhook.js DEPOIS de confirmar o status direto na API
--    do Mercado Pago (nunca confia só no payload do webhook).
-- -----------------------------------------------------------------------------
create or replace function public.confirm_pix_payment(
  p_mp_payment_id text,
  p_status        text,
  p_raw_webhook   jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment     public.pix_payments;
  v_new_balance integer;
begin
  -- lock evita race condition entre webhooks simultâneos do mesmo pagamento
  select * into v_payment
  from public.pix_payments
  where mp_payment_id = p_mp_payment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'payment_not_found');
  end if;

  update public.pix_payments
  set status = p_status, raw_webhook = p_raw_webhook
  where id = v_payment.id;

  if v_payment.credited then
    return jsonb_build_object('ok', true, 'reason', 'already_credited', 'payment_id', v_payment.id);
  end if;

  if p_status <> 'approved' then
    return jsonb_build_object('ok', true, 'reason', 'not_approved_yet', 'status', p_status);
  end if;

  update public.profiles
  set credits = credits + v_payment.amount
  where id = v_payment.user_id
  returning credits into v_new_balance;

  update public.pix_payments
  set credited = true, credited_at = now()
  where id = v_payment.id;

  insert into public.transactions (user_id, type, amount, balance_after, description, pix_id)
  values (
    v_payment.user_id,
    'deposit',
    v_payment.amount,
    v_new_balance,
    'Depósito via PIX confirmado',
    p_mp_payment_id
  );

  return jsonb_build_object(
    'ok', true,
    'reason', 'credited',
    'payment_id', v_payment.id,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.confirm_pix_payment(text, text, jsonb) from public;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
--
-- Depois, configure as variáveis de ambiente na Vercel (Project Settings ->
-- Environment Variables) — veja .env.example atualizado para a lista
-- completa. SUPABASE_SERVICE_ROLE_KEY e MP_ACCESS_TOKEN NUNCA vão no .env
-- do front (VITE_*) — só nas envs do backend/Vercel Functions.
-- =============================================================================
