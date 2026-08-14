-- =============================================================================
-- Tigrinho da Sorte — Fase 2: schema + Row Level Security
-- =============================================================================
-- Regra de ouro: RLS ativado em TODAS as tabelas desde o início. Nenhuma
-- tabela sensível recebe policy de INSERT/UPDATE para o client autenticado —
-- essas operações só acontecem dentro das funções RPC (SECURITY DEFINER) da
-- Fase 3, que rodam com privilégios de dono da tabela e por isso ignoram RLS
-- de propósito (é o único "portão" autorizado a mexer em créditos).
-- =============================================================================

-- Garante gen_random_uuid() (normalmente já vem ativado por padrão no Supabase).
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. profiles
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email text,
  credits integer not null default 1000,
  vip_level integer not null default 0,
  referral_code text not null unique,
  referred_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de jogo (créditos DEMO, sem valor monetário real).';
comment on column public.profiles.credits is 'Saldo de créditos DEMO. Só é alterado por funções RPC SECURITY DEFINER.';

alter table public.profiles enable row level security;

-- Usuário só enxerga a própria linha.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Nenhuma policy de UPDATE é criada aqui de propósito: não há, por enquanto,
-- nenhuma coluna "segura" para o usuário editar diretamente (credits,
-- vip_level, referral_code e referred_by são todos controlados pelo
-- servidor). Se no futuro você adicionar um campo como "display_name",
-- crie uma policy de UPDATE com WITH CHECK restringindo exatamente esse caso.

-- Nenhuma policy de INSERT/DELETE para authenticated: a linha de profiles é
-- criada automaticamente pelo trigger abaixo quando o usuário se cadastra.

-- --- Criação automática de perfil ao cadastrar (auth.users -> profiles) -----

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
  exists_already boolean;
begin
  loop
    -- 8 caracteres em base36 maiúsculo, ex: "K3F9QZ2A".
    candidate := upper(substring(md5(gen_random_uuid()::text) from 1 for 8));
    select exists(select 1 from public.profiles where referral_code = candidate) into exists_already;
    exit when not exists_already;
  end loop;
  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, phone, referral_code)
  values (new.id, new.email, new.phone, public.generate_referral_code());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. spin_history
-- -----------------------------------------------------------------------------

create table public.spin_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  bet_amount integer not null,
  payout integer not null default 0,
  symbols jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.spin_history enable row level security;

create policy "spin_history_select_own"
  on public.spin_history for select
  using (auth.uid() = user_id);

-- Sem policy de INSERT: só a função spin_slot() (Fase 3, SECURITY DEFINER)
-- pode gravar aqui. Isso impede que alguém insira uma "vitória" falsa
-- chamando a API do Supabase diretamente pelo DevTools.

create index spin_history_user_id_idx on public.spin_history (user_id);

-- -----------------------------------------------------------------------------
-- 3. daily_checkins
-- -----------------------------------------------------------------------------

create table public.daily_checkins (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkin_date date not null,
  reward integer not null,
  unique (user_id, checkin_date)
);

alter table public.daily_checkins enable row level security;

create policy "daily_checkins_select_own"
  on public.daily_checkins for select
  using (auth.uid() = user_id);

-- Sem policy de INSERT: só a função daily_checkin() (Fase 3) grava aqui.

-- -----------------------------------------------------------------------------
-- 4. redeem_codes
-- -----------------------------------------------------------------------------

create table public.redeem_codes (
  code text primary key,
  reward integer not null,
  max_uses integer not null,
  uses_count integer not null default 0,
  expires_at timestamptz
);

alter table public.redeem_codes enable row level security;

-- Nenhuma policy é criada para authenticated nesta tabela: não queremos
-- expor uses_count/max_uses (isso vazaria quantos resgates ainda restam,
-- útil para quem quiser "correr" pra usar um código antes que esgote).
-- Em vez disso, o client consulta a view pública abaixo, que só mostra o
-- necessário para validar/exibir o código. INSERT/UPDATE/DELETE continuam
-- só pelo painel do Supabase (usando a service_role, que ignora RLS).
--
-- IMPORTANTE: esta view é criada SEM security_invoker, de propósito. Isso
-- faz ela rodar com o privilégio de quem a criou (dono da tabela), que
-- ignora RLS — é assim que ela consegue mostrar code/reward/expires_at para
-- authenticated mesmo sem existir nenhuma policy de SELECT na tabela base.
-- Se algum dia você marcar "security_invoker = true" aqui, a view passa a
-- rodar com o privilégio de quem consulta e, como não há policy de SELECT
-- na tabela base, vai simplesmente devolver zero linhas.

create view public.redeem_codes_public as
  select code, reward, expires_at
  from public.redeem_codes
  where expires_at is null or expires_at > now();

grant select on public.redeem_codes_public to authenticated;

-- -----------------------------------------------------------------------------
-- 5. redeem_code_uses
-- -----------------------------------------------------------------------------

create table public.redeem_code_uses (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null references public.redeem_codes (code),
  used_at timestamptz not null default now(),
  unique (user_id, code)
);

alter table public.redeem_code_uses enable row level security;

create policy "redeem_code_uses_select_own"
  on public.redeem_code_uses for select
  using (auth.uid() = user_id);

-- Sem policy de INSERT: só a função redeem_code() (Fase 3) grava aqui.

-- =============================================================================
-- Como rodar esta migration
-- =============================================================================
-- Opção A (recomendada, via Supabase CLI):
--   1. npx supabase login
--   2. npx supabase link --project-ref SEU-PROJECT-REF   (está em Project Settings -> General)
--   3. npx supabase db push
--
-- Opção B (manual, via painel):
--   1. Abra seu projeto em supabase.com -> SQL Editor -> New query
--   2. Cole o conteúdo inteiro deste arquivo e clique em "Run"
--
-- Depois de rodar, confira em Table Editor se as 5 tabelas apareceram e em
-- Authentication -> Policies se cada uma mostra "RLS enabled".
-- =============================================================================
