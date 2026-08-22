-- =============================================================================
-- Tigrinho da Sorte — 0018: Bingo do Tigre
-- =============================================================================
-- Cartela 5x5 (24 números de 1-75 + centro livre). O Supabase sorteia 22
-- bolas. Se qualquer linha, coluna ou diagonal fechar (5 números batidos),
-- paga 26x. Calibrado por simulação de 1 milhão de cartelas (sim_etapa2.js):
-- probabilidade de fechar alguma linha ≈ 3,6%, RTP ≈ 92,6%.
--
-- Rode DEPOIS de 0001-0017 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.play_bingo(bet_amount int)
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
  v_card int[25];       -- índice 13 (posição central, 1-based) é o "livre" (valor 0)
  v_drawn int[];
  v_marked boolean[25];
  v_won boolean := false;
  card_pool int[];
  draw_pool int[];
  i int;
  j int;
  tmp int;
  lines int[][] := array[
    array[1,2,3,4,5],     array[6,7,8,9,10],    array[11,12,13,14,15],
    array[16,17,18,19,20],array[21,22,23,24,25],
    array[1,6,11,16,21],  array[2,7,12,17,22],  array[3,8,13,18,23],
    array[4,9,14,19,24],  array[5,10,15,20,25],
    array[1,7,13,19,25],  array[5,9,13,17,21]
  ];
  line int[];
  idx int;
  line_complete boolean;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- monta a cartela: embaralha 1..75 e pega os 24 primeiros (centro = livre)
  card_pool := array(select generate_series(1, 75));
  for i in reverse 75..2 loop
    j := 1 + floor(random() * i)::int;
    tmp := card_pool[i]; card_pool[i] := card_pool[j]; card_pool[j] := tmp;
  end loop;
  for i in 1..25 loop
    if i = 13 then
      v_card[i] := 0; -- livre
    elsif i < 13 then
      v_card[i] := card_pool[i];
    else
      v_card[i] := card_pool[i - 1];
    end if;
  end loop;

  -- sorteia 22 bolas (embaralhamento independente do mesmo intervalo 1-75)
  draw_pool := array(select generate_series(1, 75));
  for i in reverse 75..2 loop
    j := 1 + floor(random() * i)::int;
    tmp := draw_pool[i]; draw_pool[i] := draw_pool[j]; draw_pool[j] := tmp;
  end loop;
  v_drawn := draw_pool[1:22];

  for i in 1..25 loop
    v_marked[i] := (v_card[i] = 0) or (v_card[i] = any(v_drawn));
  end loop;

  foreach line slice 1 in array lines loop
    line_complete := true;
    foreach idx in array line loop
      if not v_marked[idx] then
        line_complete := false;
        exit;
      end if;
    end loop;
    if line_complete then
      v_won := true;
      exit;
    end if;
  end loop;

  if v_won then
    v_payout := bet_amount * 26;
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'bingo', bet_amount, null, case when v_won then 'linha fechada' else 'sem linha' end, v_payout);

  return json_build_object(
    'card', v_card, 'drawn', v_drawn, 'won', v_won,
    'payout', v_payout, 'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_bingo(int) from public;
grant execute on function public.play_bingo(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
