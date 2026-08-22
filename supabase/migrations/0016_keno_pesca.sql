-- =============================================================================
-- Tigrinho da Sorte — 0016: Keno do Tigre + Pesca do Tigre
-- =============================================================================
-- Keno: escolhe 5 números de 1-40, o Supabase sorteia 10. Paga conforme
-- quantos dos seus 5 números batem nos 10 sorteados. Paytable calculado por
-- combinatória exata (hipergeométrica), não por simulação — é possível
-- calcular a probabilidade exata de cada quantidade de acertos.
--   0 ou 1 acerto: não paga | 2 acertos: 1x | 3: 4x | 4: 20x | 5: 400x
--   RTP = 93,97%
--
-- Pesca: sorteio único ponderado (mesma matemática da Roda da Sorte,
-- só re-temado como "pescar um peixe"). RTP = 93,8%.
--
-- Rode DEPOIS de 0001-0015 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

-- a tabela simple_game_history (criada em 0012) tinha uma trava CHECK que só
-- aceitava os nomes de jogo da época — precisa abrir pra estes 6 novos.
alter table public.simple_game_history drop constraint if exists simple_game_history_game_check;
alter table public.simple_game_history add constraint simple_game_history_game_check
  check (game in ('coin', 'lucky_number', 'dice', 'wheel', 'chest', 'scratch', 'keno', 'fishing', 'plinko', 'duel', 'bingo', 'race'));

-- ── Keno do Tigre ────────────────────────────────────────────
create or replace function public.play_keno(bet_amount int, picks int[])
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
  v_drawn int[];
  v_hits int := 0;
  v_pick int;
  paytable int[] := array[0, 0, 1, 4, 20, 400]; -- índice = qtd de acertos (0-5)
  v_multiplier int;
  pool int[];
  i int;
  j int;
  tmp int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if picks is null or array_length(picks, 1) <> 5 then raise exception 'Escolha exatamente 5 números.'; end if;

  foreach v_pick in array picks loop
    if v_pick < 1 or v_pick > 40 then raise exception 'Número fora do intervalo (1-40).'; end if;
  end loop;
  if (select count(distinct p) from unnest(picks) p) <> 5 then
    raise exception 'Os 5 números precisam ser diferentes.';
  end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- embaralha 1..40 (Fisher-Yates) e pega os 10 primeiros como sorteados
  pool := array(select generate_series(1, 40));
  for i in reverse 40..2 loop
    j := 1 + floor(random() * i)::int;
    tmp := pool[i];
    pool[i] := pool[j];
    pool[j] := tmp;
  end loop;
  v_drawn := pool[1:10];

  select count(*) into v_hits from unnest(picks) p where p = any(v_drawn);

  v_multiplier := paytable[v_hits + 1];
  v_payout := bet_amount * v_multiplier;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'keno' , bet_amount, picks::text, v_drawn::text || ' (hits:' || v_hits || ')', v_payout);

  return json_build_object('drawn', v_drawn, 'hits', v_hits, 'payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.play_keno(int, int[]) from public;
grant execute on function public.play_keno(int, int[]) to authenticated;

-- ── Pesca do Tigre ───────────────────────────────────────────
create or replace function public.play_fishing(bet_amount int)
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
  v_multiplier := segment_values[8];
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
  values (v_user_id, 'fishing', bet_amount, null, v_multiplier::text || 'x', v_payout);

  return json_build_object('multiplier', v_multiplier, 'payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.play_fishing(int) from public;
grant execute on function public.play_fishing(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
