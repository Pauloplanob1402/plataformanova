-- =============================================================================
-- Tigrinho da Sorte — 0012: Moeda do Tigre + Número da Sorte
-- =============================================================================
-- Dois jogos de sorteio único, os mais simples do catálogo — mesmo padrão
-- de segurança de sempre (RPC SECURITY DEFINER, nada decidido no client).
--
-- Moeda do Tigre: cara ou coroa, 50% de chance, paga 1.9x no acerto.
--   RTP = 0.5 * 1.9 = 95%.
-- Número da Sorte: escolhe um número de 1 a 10, paga 9.4x no acerto.
--   RTP = 0.1 * 9.4 = 94%.
--
-- Rode DEPOIS de 0001-0011 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.simple_game_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  game        text not null check (game in ('coin', 'lucky_number', 'dice', 'wheel', 'chest', 'scratch')),
  bet_amount  int not null,
  choice      text,        -- o que o jogador escolheu (ex: 'heads', '7', 'low')
  result      text,        -- o resultado sorteado (ex: 'tails', '3', '9')
  payout      int not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_simple_game_history_user on public.simple_game_history(user_id, game);

alter table public.simple_game_history enable row level security;

drop policy if exists "simple_game_history_select_own" on public.simple_game_history;
create policy "simple_game_history_select_own"
  on public.simple_game_history for select
  using (auth.uid() = user_id);

-- ── Moeda do Tigre ────────────────────────────────────────────
create or replace function public.play_coin_flip(bet_amount int, choice text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_new_balance int;
  v_payout int := 0;
  v_result text;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if choice not in ('heads', 'tails') then raise exception 'Escolha inválida.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_result := case when random() < 0.5 then 'heads' else 'tails' end;
  if v_result = choice then
    v_payout := round(bet_amount * 1.9);
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'coin', bet_amount, choice, v_result, v_payout);

  return json_build_object('result', v_result, 'payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.play_coin_flip(int, text) from public;
grant execute on function public.play_coin_flip(int, text) to authenticated;

-- ── Número da Sorte ──────────────────────────────────────────
create or replace function public.play_lucky_number(bet_amount int, choice int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_new_balance int;
  v_payout int := 0;
  v_result int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if choice is null or choice < 1 or choice > 10 then raise exception 'Escolha inválida.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_result := 1 + floor(random() * 10)::int;
  if v_result = choice then
    v_payout := round(bet_amount * 9.4);
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'lucky_number', bet_amount, choice::text, v_result::text, v_payout);

  return json_build_object('result', v_result, 'payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.play_lucky_number(int, int) from public;
grant execute on function public.play_lucky_number(int, int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
