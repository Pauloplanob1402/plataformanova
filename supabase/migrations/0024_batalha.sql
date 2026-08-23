-- =============================================================================
-- Tigrinho da Sorte — 0024: Batalha do Tigre (baccarat simplificado)
-- =============================================================================
-- Mesma família visual do Dragão x Tigre, mas com 2 cartas por lado em vez
-- de 1: Jogador e Banca recebem 2 cartas cada (sem a regra da 3ª carta do
-- baccarat oficial, pra manter simples e auditável), valor = soma das 2
-- cartas módulo 10 (cartas 10/J/Q/K valem 0, A vale 1, resto vale o número
-- de face — igual ao baccarat real). Quem tiver o valor mais alto ganha.
--
-- Calibrado por simulação de 3 milhões de mãos (sim_etapa4.js):
--   Jogador ganha ~44,8% | Banca ganha ~44,9% | Empate ~10,3%
--   Aposta em Jogador ou Banca: paga 2.12x, RTP = 95%
--   Aposta em Empate: paga 8x, RTP = 82,3% (margem maior, esperado — mesmo
--   padrão do Dragão x Tigre, é assim em qualquer mesa real também)
--
-- Rode DEPOIS de 0001-0023 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.baccarat_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  bet_amount    int not null,
  bet_type      text not null check (bet_type in ('player', 'banker', 'tie')),
  player_hand   int not null,
  banker_hand   int not null,
  winner        text not null check (winner in ('player', 'banker', 'tie')),
  payout        int not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_baccarat_history_user on public.baccarat_history(user_id);

alter table public.baccarat_history enable row level security;

drop policy if exists "baccarat_history_select_own" on public.baccarat_history;
create policy "baccarat_history_select_own"
  on public.baccarat_history for select
  using (auth.uid() = user_id);

create or replace function public.baccarat_draw_card_value()
returns int
language plpgsql
as $$
declare
  roll numeric := random() * 13;
begin
  if roll < 4 then
    return 0; -- 10, J, Q, K (4 de 13 cartas)
  end if;
  return floor(roll - 4)::int + 1; -- 1 a 9
end;
$$;

create or replace function public.play_baccarat(bet_amount int, bet_type text)
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
  v_player_hand int;
  v_banker_hand int;
  v_winner text;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if bet_type not in ('player', 'banker', 'tie') then raise exception 'Aposta inválida.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_player_hand := (public.baccarat_draw_card_value() + public.baccarat_draw_card_value()) % 10;
  v_banker_hand := (public.baccarat_draw_card_value() + public.baccarat_draw_card_value()) % 10;

  v_winner := case
    when v_player_hand > v_banker_hand then 'player'
    when v_banker_hand > v_player_hand then 'banker'
    else 'tie'
  end;

  if bet_type = 'tie' then
    if v_winner = 'tie' then
      v_payout := bet_amount * 8;
    end if;
  else
    if v_winner = bet_type then
      v_payout := round(bet_amount * 2.12);
    end if;
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.baccarat_history (user_id, bet_amount, bet_type, player_hand, banker_hand, winner, payout)
  values (v_user_id, bet_amount, bet_type, v_player_hand, v_banker_hand, v_winner, v_payout);

  return json_build_object(
    'player_hand', v_player_hand, 'banker_hand', v_banker_hand, 'winner', v_winner,
    'payout', v_payout, 'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_baccarat(int, text) from public;
grant execute on function public.play_baccarat(int, text) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
