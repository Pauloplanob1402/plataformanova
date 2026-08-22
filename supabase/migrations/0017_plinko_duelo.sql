-- =============================================================================
-- Tigrinho da Sorte — 0017: Plinko do Tigre + Duelo do Tigre
-- =============================================================================
-- Plinko: a bolinha "cai" por 8 filas de pinos. Cada fila é uma decisão
-- esquerda/direita 50/50 — matematicamente idêntico a uma distribuição
-- binomial(8, 0.5), então em vez de simular fila por fila, sorteamos direto
-- a posição final (0-8) usando essa distribuição, sem perder realismo.
-- Multiplicadores simétricos (bordas pagam mais, centro paga menos, como
-- todo Plinko de verdade). RTP calculado por combinatória exata: 93,5%.
--
-- Duelo do Tigre: você e o mascote tigre rolam 1 dado cada. Maior número
-- vence. Empate devolve a aposta (nem ganha nem perde). RTP = 93,75%.
--
-- Rode DEPOIS de 0001-0016 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

-- ── Plinko do Tigre ──────────────────────────────────────────
create or replace function public.play_plinko(bet_amount int)
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
  v_slot int := 0;
  v_path text := '';
  v_multiplier numeric;
  multipliers numeric[] := array[14, 3.5, 1.4, 0.5, 0.3, 0.5, 1.4, 3.5, 14]; -- índices 0-8
  i int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- 8 decisões esquerda(0)/direita(1) — a soma é a posição final (0-8)
  for i in 1..8 loop
    if random() < 0.5 then
      v_path := v_path || 'E';
    else
      v_slot := v_slot + 1;
      v_path := v_path || 'D';
    end if;
  end loop;

  v_multiplier := multipliers[v_slot + 1];
  v_payout := round(bet_amount * v_multiplier);

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'plinko', bet_amount, null, v_path || ' (slot ' || v_slot || ')', v_payout);

  return json_build_object(
    'path', v_path, 'slot', v_slot, 'multiplier', v_multiplier,
    'payout', v_payout, 'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_plinko(int) from public;
grant execute on function public.play_plinko(int) to authenticated;

-- ── Duelo do Tigre ───────────────────────────────────────────
create or replace function public.play_duel(bet_amount int)
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
  v_player_die int;
  v_tiger_die int;
  v_outcome text;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_player_die := 1 + floor(random() * 6)::int;
  v_tiger_die := 1 + floor(random() * 6)::int;

  if v_player_die > v_tiger_die then
    v_outcome := 'win';
    v_payout := round(bet_amount * 1.85);
  elsif v_player_die = v_tiger_die then
    v_outcome := 'tie';
    v_payout := bet_amount; -- devolve a aposta, sem ganho nem perda
  else
    v_outcome := 'lose';
    v_payout := 0;
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'duel', bet_amount, null, v_player_die::text || ' vs ' || v_tiger_die::text || ' (' || v_outcome || ')', v_payout);

  return json_build_object(
    'player_die', v_player_die, 'tiger_die', v_tiger_die, 'outcome', v_outcome,
    'payout', v_payout, 'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_duel(int) from public;
grant execute on function public.play_duel(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
