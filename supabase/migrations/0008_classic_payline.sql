-- =============================================================================
-- Tigrinho da Sorte — 0008: troca "ways to win" por linha clássica
-- =============================================================================
-- Motivo: "ways to win" (símbolo pagando ao aparecer em cada rolo, sem
-- precisar alinhar) confundia os jogadores — parecia pagar "aleatoriamente"
-- porque os símbolos vencedores ficavam espalhados pela grade, sem formar
-- uma linha visível. Trocado pela regra clássica: só paga quando os 3
-- símbolos de uma mesma LINHA horizontal (topo, meio ou base) são iguais.
-- Bem mais fácil de reconhecer de relance — e o jogo já tem 3 linhas
-- (grade 3x3), então continuam existindo 3 chances de pagar por giro,
-- só que agora de um jeito visualmente óbvio.
--
-- Usa symbol.payoutMultiplier (já existia em symbols.ts, definido desde o
-- início como "usado pelo jogo atual" — o wayMultiplier fica sem uso a
-- partir de agora, mas não precisa remover do front, não atrapalha nada).
--
-- Retorna também "winning_rows" (1, 2 e/ou 3) além de "winning_symbols",
-- pra o front conseguir destacar exatamente as células da linha que pagou
-- — e só elas, sem risco de destacar um símbolo solto em outro lugar da
-- grade que não faz parte de nenhuma linha vencedora.
--
-- Rode DEPOIS de 0001-0007 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

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

  symbol_ids text[] := array['lantern', 'ingot', 'coin', 'firecracker', 'bell', 'tiger'];
  symbol_weights int[] := array[32, 24, 20, 14, 7, 3];
  -- multiplicador de linha clássica (payoutMultiplier em symbols.ts):
  -- paga bet_amount * multiplicador quando os 3 símbolos da linha são iguais.
  -- Recalibrado pra RTP ~93% com a regra de linha (paga com menos frequência
  -- que o antigo "ways to win", por isso os valores são bem maiores).
  symbol_payout_mult numeric[] := array[3, 5, 10, 16, 45, 120];
  total_weight int := 100;

  -- grade 3x3 achatada (reel-major): posições 1-3 = rolo 1, 4-6 = rolo 2, 7-9 = rolo 3
  v_grid_idx int[9];
  v_grid_ids text[9];
  v_winning_ids text[] := array[]::text[];
  v_winning_rows int[] := array[]::int[];

  roll numeric;
  cumulative int;
  picked int;
  reel_i int;
  row_i int;
  sym_i int;
  s1 int;
  s2 int;
  s3 int;
  pos int;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if bet_amount is null or bet_amount <= 0 then
    raise exception 'Valor de aposta inválido.';
  end if;

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
      pos := (reel_i - 1) * 3 + row_i;
      v_grid_idx[pos] := picked;
      v_grid_ids[pos] := symbol_ids[picked];
    end loop;
  end loop;

  -- avalia as 3 linhas horizontais: linha row_i é composta pela posição
  -- row_i do rolo 1 (índice row_i), do rolo 2 (índice 3+row_i) e do rolo 3
  -- (índice 6+row_i). Paga só quando os 3 são o MESMO símbolo.
  for row_i in 1..3 loop
    s1 := v_grid_idx[row_i];
    s2 := v_grid_idx[3 + row_i];
    s3 := v_grid_idx[6 + row_i];

    if s1 = s2 and s2 = s3 then
      v_payout := v_payout + round(bet_amount * symbol_payout_mult[s1]);
      v_winning_ids := array_append(v_winning_ids, symbol_ids[s1]);
      v_winning_rows := array_append(v_winning_rows, row_i);
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
    'winning_symbols', v_winning_ids,
    'winning_rows', v_winning_rows
  );
end;
$$;

revoke all on function public.spin_slot(int) from public;
grant execute on function public.spin_slot(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- Como é "create or replace", substitui a função na hora.
-- =============================================================================
