-- =============================================================================
-- Tigrinho da Sorte — 0013: Roda da Sorte + Dados do Tigre
-- =============================================================================
-- Roda da Sorte: 8 gomos com multiplicadores ponderados, RTP ~93,8%.
-- Dados do Tigre: 2 dados, aposta em Baixo (soma 2-6, paga 2.25x, RTP ~93,8%),
--   Sete (soma exata 7, paga 5.6x, RTP ~93,3%) ou Alto (soma 8-12, paga 2.25x).
--
-- Rode DEPOIS de 0001-0012 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

-- ── Roda da Sorte do Tigre ───────────────────────────────────
-- Gomos: 0x(30%) 0.5x(25%) 1x(20%) 1.5x(12%) 2x(8%) 3x(3.5%) 10x(1.2%) 16x(0.3%)
create or replace function public.play_wheel(bet_amount int)
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
  v_multiplier numeric;
  roll numeric;
  segment_values  numeric[] := array[0, 0.5, 1, 1.5, 2, 3, 10, 16];
  segment_weights numeric[] := array[30, 25, 20, 12, 8, 3.5, 1.2, 0.3];
  cumulative numeric;
  i int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  roll := random() * 100;
  cumulative := 0;
  v_multiplier := segment_values[8]; -- fallback
  for i in 1..8 loop
    cumulative := cumulative + segment_weights[i];
    if roll < cumulative then
      v_multiplier := segment_values[i];
      exit;
    end if;
  end loop;

  v_payout := round(bet_amount * v_multiplier);

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'wheel', bet_amount, null, v_multiplier::text || 'x', v_payout);

  return json_build_object('multiplier', v_multiplier, 'payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.play_wheel(int) from public;
grant execute on function public.play_wheel(int) to authenticated;

-- ── Dados do Tigre ───────────────────────────────────────────
create or replace function public.play_dice(bet_amount int, choice text)
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
  v_die1 int;
  v_die2 int;
  v_sum int;
  v_range text;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if choice not in ('low', 'seven', 'high') then raise exception 'Escolha inválida.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_die1 := 1 + floor(random() * 6)::int;
  v_die2 := 1 + floor(random() * 6)::int;
  v_sum := v_die1 + v_die2;

  v_range := case when v_sum <= 6 then 'low' when v_sum = 7 then 'seven' else 'high' end;

  if v_range = choice then
    v_payout := round(bet_amount * (case when v_range = 'seven' then 5.6 else 2.25 end));
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'dice', bet_amount, choice, v_die1::text || '+' || v_die2::text || '=' || v_sum::text, v_payout);

  return json_build_object(
    'die1', v_die1, 'die2', v_die2, 'sum', v_sum, 'range', v_range,
    'payout', v_payout, 'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_dice(int, text) from public;
grant execute on function public.play_dice(int, text) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
