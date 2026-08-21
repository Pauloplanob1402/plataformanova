-- =============================================================================
-- Tigrinho da Sorte — 0015: Raspadinha do Tigre
-- =============================================================================
-- 9 células (3x3), cada uma recebe um símbolo (ou fica em branco). Se um
-- símbolo aparecer em 3 OU MAIS células, paga o valor daquele símbolo — pode
-- pagar mais de um símbolo na mesma cartela se mais de um bater 3+.
-- Calibrado por simulação de 2 milhões de cartelas (sim_etapa1.js), RTP ~94,8%.
--
-- Rode DEPOIS de 0001-0014 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.play_scratch(bet_amount int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_new_balance int;
  v_payout numeric := 0;

  -- símbolos: lantern, ingot, coin, bell, tiger, blank (índices 1-6)
  symbol_ids     text[]    := array['lantern', 'ingot', 'coin', 'bell', 'tiger', 'blank'];
  symbol_values  numeric[] := array[2, 4, 8, 20, 60, 0];
  symbol_weights numeric[] := array[19, 11.4, 6.65, 2.85, 0.95, 59.15];

  v_grid_ids text[9];
  v_counts int[6] := array_fill(0, array[6]);
  roll numeric;
  cumulative numeric;
  picked int;
  cell int;
  sym_i int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  for cell in 1..9 loop
    roll := random() * 100;
    cumulative := 0;
    picked := 6; -- fallback = blank
    for sym_i in 1..6 loop
      cumulative := cumulative + symbol_weights[sym_i];
      if roll < cumulative then
        picked := sym_i;
        exit;
      end if;
    end loop;
    v_grid_ids[cell] := symbol_ids[picked];
    v_counts[picked] := v_counts[picked] + 1;
  end loop;

  for sym_i in 1..5 loop -- não paga "blank" (índice 6)
    if v_counts[sym_i] >= 3 then
      v_payout := v_payout + symbol_values[sym_i];
    end if;
  end loop;

  v_payout := round(v_payout * bet_amount);

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'scratch', bet_amount, null, to_jsonb(v_grid_ids)::text, v_payout::int);

  return json_build_object(
    'grid', v_grid_ids,
    'payout', v_payout::int,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_scratch(int) from public;
grant execute on function public.play_scratch(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
