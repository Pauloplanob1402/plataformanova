-- =============================================================================
-- Tigrinho da Sorte — 0021: Torre do Tigre + Torre Mini
-- =============================================================================
-- Torre: 8 andares, cada um com 3 células (1 é armadilha). Sobe um andar por
-- vez, escolhendo 1 célula. Torre Mini: mesma mecânica, só 4 andares (sessão
-- rápida). Mesma fórmula de "odds justas" escalada a 95% de RTP das outras.
--
-- Rode DEPOIS de 0001-0020 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.start_tower(bet_amount int, mini boolean default false)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_round_id uuid;
  v_levels int := case when mini then 4 else 8 end;
  cells_per_level constant int := 3;
  v_trap_positions int[];
  i int;
  v_game text := case when mini then 'tower_mini' else 'tower' end;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  if exists (select 1 from public.game_rounds where user_id = v_user_id and status = 'active') then
    raise exception 'Você já tem uma rodada em andamento. Finalize antes de começar outra.';
  end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- 1 armadilha por andar, posição sorteada independente em cada um
  v_trap_positions := array(select floor(random() * cells_per_level)::int from generate_series(1, v_levels));

  insert into public.game_rounds (user_id, game, bet_amount, state)
  values (
    v_user_id, v_game, bet_amount,
    jsonb_build_object(
      'levels', v_levels,
      'cells_per_level', cells_per_level,
      'trap_positions', to_jsonb(v_trap_positions),
      'current_level', 0,
      'multiplier', 1
    )
  )
  returning id into v_round_id;

  return json_build_object('round_id', v_round_id, 'levels', v_levels, 'cells_per_level', cells_per_level, 'game', v_game);
end;
$$;

revoke all on function public.start_tower(int, boolean) from public;
grant execute on function public.start_tower(int, boolean) to authenticated;

create or replace function public.climb_tower(round_id uuid, cell_index int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.game_rounds;
  v_levels int;
  v_cells_per_level int;
  v_trap_positions int[];
  v_current_level int;
  v_trap_this_level int;
  v_multiplier numeric;
  v_payout int := 0;
  v_new_balance int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;

  select * into v_round from public.game_rounds
  where id = round_id and user_id = v_user_id and status = 'active' and game in ('tower', 'tower_mini')
  for update;

  if not found then raise exception 'Rodada não encontrada ou já finalizada.'; end if;

  v_levels := (v_round.state->>'levels')::int;
  v_cells_per_level := (v_round.state->>'cells_per_level')::int;
  select array(select jsonb_array_elements_text(v_round.state->'trap_positions')::int) into v_trap_positions;
  v_current_level := (v_round.state->>'current_level')::int;

  if cell_index < 0 or cell_index >= v_cells_per_level then raise exception 'Célula inválida.'; end if;

  v_trap_this_level := v_trap_positions[v_current_level + 1]; -- array 1-based, nível 0 = 1º andar

  if cell_index = v_trap_this_level then
    update public.game_rounds set status = 'busted', payout = 0 where id = round_id;
    return json_build_object(
      'busted', true, 'trap_positions', v_trap_positions,
      'payout', 0, 'new_balance', (select credits from public.profiles where id = v_user_id)
    );
  end if;

  v_current_level := v_current_level + 1;
  v_multiplier := 0.95 * power(v_cells_per_level::numeric / (v_cells_per_level - 1)::numeric, v_current_level);

  update public.game_rounds
  set state = v_round.state || jsonb_build_object('current_level', v_current_level, 'multiplier', v_multiplier)
  where id = round_id;

  -- chegou no topo => saca automático
  if v_current_level = v_levels then
    v_payout := round(v_round.bet_amount * v_multiplier);
    update public.profiles set credits = credits + v_payout where id = v_user_id;
    update public.game_rounds set status = 'cashed_out', payout = v_payout where id = round_id;
    select credits into v_new_balance from public.profiles where id = v_user_id;

    return json_build_object(
      'busted', false, 'topped_out', true, 'multiplier', v_multiplier,
      'current_level', v_current_level, 'payout', v_payout, 'new_balance', v_new_balance
    );
  end if;

  return json_build_object('busted', false, 'topped_out', false, 'multiplier', v_multiplier, 'current_level', v_current_level);
end;
$$;

revoke all on function public.climb_tower(uuid, int) from public;
grant execute on function public.climb_tower(uuid, int) to authenticated;

create or replace function public.cashout_tower(round_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.game_rounds;
  v_multiplier numeric;
  v_payout int;
  v_new_balance int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;

  select * into v_round from public.game_rounds
  where id = round_id and user_id = v_user_id and status = 'active' and game in ('tower', 'tower_mini')
  for update;

  if not found then raise exception 'Rodada não encontrada ou já finalizada.'; end if;

  if (v_round.state->>'current_level')::int < 1 then
    raise exception 'Suba ao menos 1 andar antes de sacar.';
  end if;

  v_multiplier := (v_round.state->>'multiplier')::numeric;
  v_payout := round(v_round.bet_amount * v_multiplier);
  update public.profiles set credits = credits + v_payout where id = v_user_id;
  update public.game_rounds set status = 'cashed_out', payout = v_payout where id = round_id;
  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object(
    'payout', v_payout, 'new_balance', v_new_balance,
    'trap_positions', array(select jsonb_array_elements_text(v_round.state->'trap_positions')::int)
  );
end;
$$;

revoke all on function public.cashout_tower(uuid) from public;
grant execute on function public.cashout_tower(uuid) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
