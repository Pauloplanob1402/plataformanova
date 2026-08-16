-- =============================================================================
-- Tigrinho da Sorte — 0007: Saque via PIX (com KYC) + Login/cadastro por
-- telefone via e-mail interno fake (sem custo de SMS)
-- =============================================================================
-- Migrado do Rodadafortuna (supabase_saque.sql + supabase_kyc_patch.sql +
-- supabase_patch_saque.sql + supabase_login_telefone.sql), adaptado pro
-- schema deste projeto: profiles.credits em vez de profiles.balance, tipo
-- integer em vez de decimal (aqui 1 crédito = R$ 1, igual à migration de
-- depósito 0006).
--
-- Mesma lógica de segurança do original:
--   - Toda escrita em withdrawal_requests e nos dados de KYC passa por RPC
--     SECURITY DEFINER — o client nunca escreve direto nessas tabelas.
--   - O saldo é debitado IMEDIATAMENTE ao solicitar o saque (evita que o
--     jogador continue apostando o valor que já pediu pra sacar).
--   - Saque exige KYC completo (nome + CPF/CNPJ) antes de liberar, porque a
--     API de transferência do Mercado Pago exige o destinatário identificado
--     e isso trava o Pix pro próprio dono da conta (evita saque pra chave
--     de terceiro).
--   - claim_withdrawal_for_processing só pode ser chamada pelo backend
--     (service_role) — trava contra clique duplo/chamada duplicada.
--
-- Rode DEPOIS de 0001-0006 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. KYC — nome completo + CPF/CNPJ do titular, coletado uma vez no perfil
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists full_name       text,
  add column if not exists document_type   text check (document_type in ('CPF','CNPJ')),
  add column if not exists document_number text;

create or replace function public.update_kyc_data(
  p_user_id         uuid,
  p_full_name       text,
  p_document_type   text,
  p_document_number text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_doc text := regexp_replace(p_document_number, '\D', '', 'g');
begin
  if auth.uid() <> p_user_id then
    raise exception 'Acesso negado';
  end if;

  if p_full_name is null or length(trim(p_full_name)) < 5 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_name');
  end if;

  if p_document_type not in ('CPF','CNPJ') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_document_type');
  end if;

  if (p_document_type = 'CPF' and length(v_clean_doc) <> 11)
     or (p_document_type = 'CNPJ' and length(v_clean_doc) <> 14) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_document_number');
  end if;

  update public.profiles
  set full_name       = trim(p_full_name),
      document_type   = p_document_type,
      document_number = v_clean_doc
  where id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.update_kyc_data(uuid, text, text, text) from public;
grant execute on function public.update_kyc_data(uuid, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. tabela withdrawal_requests
-- -----------------------------------------------------------------------------
create table if not exists public.withdrawal_requests (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  amount           integer not null check (amount > 0), -- em créditos (1 crédito = R$1)
  pix_key          text not null,
  pix_key_type     text not null default 'cpf', -- cpf, email, telefone, aleatoria
  status           text not null default 'pending'
                     check (status in ('pending','processing','completed','rejected','cancelled')),
  mp_payment_id    text,
  rejection_reason text,
  processed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_withdrawal_user   on public.withdrawal_requests(user_id);
create index if not exists idx_withdrawal_status on public.withdrawal_requests(status);

alter table public.withdrawal_requests enable row level security;

drop policy if exists "withdrawal_select_own" on public.withdrawal_requests;
create policy "withdrawal_select_own"
  on public.withdrawal_requests for select
  using (auth.uid() = user_id);

-- Admin (marcado via app_metadata.role = 'admin' no Supabase Auth) vê todos,
-- útil se um dia você montar um painel admin pra aprovar saques manualmente.
drop policy if exists "withdrawal_select_admin_all" on public.withdrawal_requests;
create policy "withdrawal_select_admin_all"
  on public.withdrawal_requests for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Nenhum insert/update direto pelo frontend — tudo via RPC abaixo.

drop trigger if exists withdrawal_updated_at on public.withdrawal_requests;
create trigger withdrawal_updated_at
  before update on public.withdrawal_requests
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- 3. RPC: solicitar saque (exige KYC, debita créditos imediatamente)
-- -----------------------------------------------------------------------------
create or replace function public.request_withdrawal(
  p_user_id      uuid,
  p_amount       integer,
  p_pix_key      text,
  p_pix_key_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance integer;
  v_new_balance      integer;
  v_withdrawal_id    uuid;
  v_min_amount       integer := 20;
  v_max_amount       integer := 2000;
  v_full_name        text;
  v_document_number  text;
begin
  if auth.uid() <> p_user_id then
    raise exception 'Acesso negado';
  end if;

  select full_name, document_number into v_full_name, v_document_number
  from public.profiles
  where id = p_user_id;

  if v_full_name is null or v_document_number is null then
    return jsonb_build_object('ok', false, 'reason', 'kyc_incomplete');
  end if;

  if p_amount < v_min_amount then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum', 'min_amount', v_min_amount);
  end if;

  if p_amount > v_max_amount then
    return jsonb_build_object('ok', false, 'reason', 'above_maximum', 'max_amount', v_max_amount);
  end if;

  if p_pix_key is null or length(trim(p_pix_key)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_pix_key');
  end if;

  -- lock evita saque duplicado em requisições simultâneas
  select credits into v_current_balance
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Perfil não encontrado';
  end if;

  if v_current_balance < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_balance', 'current_balance', v_current_balance);
  end if;

  -- impede múltiplos saques pendentes simultâneos
  if exists (
    select 1 from public.withdrawal_requests
    where user_id = p_user_id and status in ('pending','processing')
  ) then
    return jsonb_build_object('ok', false, 'reason', 'pending_withdrawal_exists');
  end if;

  -- debita imediatamente (evita que o jogador aposte o valor solicitado)
  v_new_balance := v_current_balance - p_amount;

  update public.profiles set credits = v_new_balance where id = p_user_id;

  insert into public.withdrawal_requests (user_id, amount, pix_key, pix_key_type, status)
  values (p_user_id, p_amount, p_pix_key, p_pix_key_type, 'pending')
  returning id into v_withdrawal_id;

  insert into public.transactions (user_id, type, amount, balance_after, description)
  values (p_user_id, 'withdrawal', p_amount, v_new_balance, 'Saque solicitado - PIX ' || p_pix_key_type || ' (pendente de processamento)');

  return jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal_id,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.request_withdrawal(uuid, integer, text, text) from public;
grant execute on function public.request_withdrawal(uuid, integer, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. RPC: cancelar saque pendente (devolve os créditos)
-- -----------------------------------------------------------------------------
create or replace function public.cancel_withdrawal(
  p_user_id       uuid,
  p_withdrawal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal  public.withdrawal_requests;
  v_new_balance integer;
begin
  if auth.uid() <> p_user_id then
    raise exception 'Acesso negado';
  end if;

  select * into v_withdrawal
  from public.withdrawal_requests
  where id = p_withdrawal_id and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_withdrawal.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'cannot_cancel', 'status', v_withdrawal.status);
  end if;

  update public.profiles
  set credits = credits + v_withdrawal.amount
  where id = p_user_id
  returning credits into v_new_balance;

  update public.withdrawal_requests set status = 'cancelled' where id = p_withdrawal_id;

  insert into public.transactions (user_id, type, amount, balance_after, description)
  values (p_user_id, 'deposit', v_withdrawal.amount, v_new_balance, 'Saque cancelado - créditos devolvidos');

  return jsonb_build_object('ok', true, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.cancel_withdrawal(uuid, uuid) from public;
grant execute on function public.cancel_withdrawal(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. RPC (backend/admin): marca saque como processing (trava contra clique
--    duplo / chamada duplicada) — só service_role pode chamar
-- -----------------------------------------------------------------------------
create or replace function public.claim_withdrawal_for_processing(
  p_withdrawal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal public.withdrawal_requests;
  v_full_name  text;
  v_doc_type   text;
  v_doc_number text;
begin
  if not (auth.role() = 'service_role') then
    raise exception 'Acesso restrito ao backend';
  end if;

  select * into v_withdrawal
  from public.withdrawal_requests
  where id = p_withdrawal_id and status = 'pending'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_pending_or_not_found');
  end if;

  select full_name, document_type, document_number
  into v_full_name, v_doc_type, v_doc_number
  from public.profiles
  where id = v_withdrawal.user_id;

  if v_full_name is null or v_doc_number is null then
    return jsonb_build_object('ok', false, 'reason', 'kyc_incomplete');
  end if;

  update public.withdrawal_requests set status = 'processing' where id = p_withdrawal_id;

  return jsonb_build_object(
    'ok', true,
    'withdrawal_id', v_withdrawal.id,
    'user_id', v_withdrawal.user_id,
    'amount', v_withdrawal.amount,
    'pix_key', v_withdrawal.pix_key,
    'pix_key_type', v_withdrawal.pix_key_type,
    'recipient_name', v_full_name,
    'document_type', v_doc_type,
    'document_number', v_doc_number
  );
end;
$$;

revoke all on function public.claim_withdrawal_for_processing(uuid) from public;

-- -----------------------------------------------------------------------------
-- 6. RPC (backend/admin): marca saque como completed/rejected. Aceita
--    chamada do backend (service_role) OU de um usuário logado com role
--    admin — mesmo padrão do Rodadafortuna.
-- -----------------------------------------------------------------------------
create or replace function public.admin_process_withdrawal(
  p_withdrawal_id    uuid,
  p_new_status       text,
  p_mp_payment_id    text default null,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal  public.withdrawal_requests;
  v_new_balance integer;
begin
  if not (
    auth.role() = 'service_role'
    or exists (
      select 1 from auth.users
      where id = auth.uid()
      and raw_app_meta_data->>'role' = 'admin'
    )
  ) then
    raise exception 'Acesso restrito a administradores';
  end if;

  select * into v_withdrawal
  from public.withdrawal_requests
  where id = p_withdrawal_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_withdrawal.status not in ('pending', 'processing') then
    return jsonb_build_object('ok', false, 'reason', 'already_processed', 'status', v_withdrawal.status);
  end if;

  if p_new_status = 'rejected' then
    update public.profiles
    set credits = credits + v_withdrawal.amount
    where id = v_withdrawal.user_id
    returning credits into v_new_balance;

    insert into public.transactions (user_id, type, amount, balance_after, description)
    values (v_withdrawal.user_id, 'deposit', v_withdrawal.amount, v_new_balance, 'Saque rejeitado - créditos devolvidos: ' || coalesce(p_rejection_reason, 'sem motivo informado'));
  end if;

  update public.withdrawal_requests
  set status = p_new_status,
      mp_payment_id = coalesce(p_mp_payment_id, mp_payment_id),
      rejection_reason = p_rejection_reason,
      processed_at = now()
  where id = p_withdrawal_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_process_withdrawal(uuid, text, text, text) from public;

-- =============================================================================
-- 7. LOGIN/CADASTRO POR TELEFONE — telefone vira e-mail interno no Supabase
--    (tel<digitos>@long777.phone), zero custo de SMS. O cadastro roda no
--    backend (api/phone-signup.js) com service_role, usando
--    auth.admin.createUser com email_confirm=true — não existe caixa de
--    entrada real pra confirmar, então a conta já nasce confirmada.
-- =============================================================================

alter table public.profiles
  add column if not exists recovery_email    text,
  add column if not exists is_phone_account  boolean default false;

-- profiles.phone já existe desde 0001_init.sql — passa a ser preenchido a
-- partir de raw_user_meta_data->>'phone_number' quando a conta é criada
-- via /api/phone-signup, em vez do campo nativo auth.users.phone (que só
-- é preenchido pelo fluxo antigo de OTP por SMS, não usado mais).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, phone, referral_code, recovery_email, is_phone_account)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'phone_number', new.phone),
    public.generate_referral_code(),
    new.raw_user_meta_data->>'recovery_email',
    coalesce((new.raw_user_meta_data->>'is_phone_account')::boolean, false)
  );
  return new;
end;
$$;

-- (o trigger on_auth_user_created já existe desde 0001_init.sql e chama
-- esta função — create or replace acima já é suficiente, não precisa recriar)

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- Depois configure na Vercel: AUTO_WITHDRAWAL_THRESHOLD (opcional, default 50)
-- e reveja se sua conta Mercado Pago suporta a API de transferência (ver
-- aviso em lib/mercadopago-transfer.js) antes de divulgar o saque automático.
-- =============================================================================
