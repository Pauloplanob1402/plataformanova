-- -----------------------------------------------------------------------------
-- 0003: migra spin_slot() de "3 rolos, 1 posição cada" para "3 rolos x 3
-- posições" (grade 3x3) com sistema de pagamento "ways to win": qualquer
-- símbolo que aparecer nos 3 rolos (em qualquer posição vertical) paga,
-- proporcional à quantidade de repetições em cada rolo.
--
-- Roda este arquivo DEPOIS do 0001_init.sql e 0002_functions.sql — ele só
-- substitui a função spin_slot (create or replace), as tabelas continuam
-- as mesmas. Cole no SQL Editor do Supabase ou rode via `supabase db push`.
--
-- Espelha exatamente src/core/symbols.ts e src/core/waysToWin.ts. Se um dia
-- editar os pesos/multiplicadores lá, edite aqui também.
-- -----------------------------------------------------------------------------

create or replace function public.spin_slot(bet_amount int)
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

  -- mesma tabela de src/core/symbols.ts, na mesma ordem (índices 1..6):
  symbol_ids text[] := array['lantern', 'ingot', 'coin', 'firecracker', 'bell', 'tiger'];
  symbol_weights int[] := array[32, 24, 20, 14, 7, 3];
  -- multiplicador POR VIA (não por linha) — recalibrado para o sistema de vias
  symbol_way_mult numeric[] := array[0.36, 0.62, 1, 1.8, 3.9, 11.5];
  total_weight int := 100; -- soma de symbol_weights

  -- grade 3x3: v_grid_idx[rolo][posição] guarda o índice do símbolo (1..6)
  v_grid_idx int[3][3];
  v_grid_ids text[9]; -- achatado, reel-major, pra devolver ao client
  v_winning_ids text[] := array[]::text[];

  roll numeric;
  cumulative int;
  picked int;
  reel_i int;
  row_i int;
  sym_i int;
  count_r1 int;
  count_r2 int;
  count_r3 int;
  ways int;
  flat_pos int := 1;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if bet_amount is null or bet_amount <= 0 then
    raise exception 'Valor de aposta inválido.';
  end if;

  -- "for update" trava a linha até o fim da transação: evita que dois spins
  -- simultâneos do mesmo usuário leiam o mesmo saldo antigo (race condition).
  select credits into v_credits
  from public.profiles
  where id = v_user_id
  for update;

  if v_credits is null then
    raise exception 'Perfil não encontrado.';
  end if;

  if v_credits < bet_amount then
    raise exception 'Créditos insuficientes para essa aposta.';
  end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- sorteia 3 rolos x 3 posições, cada posição independente com os mesmos pesos
  for reel_i in 1..3 loop
    for row_i in 1..3 loop
      roll := random() * total_weight;
      cumulative := 0;
      picked := 6; -- fallback, nunca deveria ser usado
      for sym_i in 1..6 loop
        cumulative := cumulative + symbol_weights[sym_i];
        if roll < cumulative then
          picked := sym_i;
          exit;
        end if;
      end loop;
      v_grid_idx[reel_i][row_i] := picked;
      v_grid_ids[flat_pos] := symbol_ids[picked];
      flat_pos := flat_pos + 1;
    end loop;
  end loop;

  -- avalia "ways to win": para cada símbolo, conta ocorrências em cada rolo;
  -- se aparecer nos 3 rolos, vias = produto das contagens
  for sym_i in 1..6 loop
    count_r1 := 0;
    count_r2 := 0;
    count_r3 := 0;
    for row_i in 1..3 loop
      if v_grid_idx[1][row_i] = sym_i then count_r1 := count_r1 + 1; end if;
      if v_grid_idx[2][row_i] = sym_i then count_r2 := count_r2 + 1; end if;
      if v_grid_idx[3][row_i] = sym_i then count_r3 := count_r3 + 1; end if;
    end loop;

    ways := count_r1 * count_r2 * count_r3;
    if ways > 0 then
      v_payout := v_payout + round(bet_amount * symbol_way_mult[sym_i] * ways);
      v_winning_ids := array_append(v_winning_ids, symbol_ids[sym_i]);
    end if;
  end loop;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.spin_history (user_id, bet_amount, payout, symbols)
  values (v_user_id, bet_amount, v_payout, to_jsonb(v_grid_ids));

  return json_build_object(
    'grid', v_grid_ids,
    'payout', v_payout,
    'new_balance', v_new_balance,
    'winning_symbols', v_winning_ids
  );
end;
$$;

revoke all on function public.spin_slot(int) from public;
grant execute on function public.spin_slot(int) to authenticated;
