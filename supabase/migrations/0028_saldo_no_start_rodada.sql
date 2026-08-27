-- =============================================================================
-- Tigrinho da Sorte — 0028: devolver o saldo real no início da rodada
-- =============================================================================
-- Achado numa auditoria de padrões exploráveis: não era um bug de matemática
-- nem de RNG (tudo isso já está correto e auditado — ver notas de cada
-- migration anterior), mas um descuido de robustez: start_mines, start_tower
-- e start_hilo debitavam a aposta no banco mas não devolviam o saldo
-- resultante na resposta. O frontend contornava isso calculando localmente
-- (`credits - bet_amount`) em vez de usar o valor real do servidor.
--
-- Isso NUNCA permitiu gastar mais do que o jogador realmente tinha — toda
-- chamada subsequente (revelar célula, subir andar, sacar) sempre valida e
-- debita contra o saldo VERDADEIRO da tabela profiles, travado com "for
-- update". O único efeito de não ter isso era o número exibido na tela
-- poder ficar temporariamente dessincronizado do real em cenários raros
-- (ex.: dois jogos abertos em abas diferentes). Corrigido de qualquer forma,
-- por princípio: toda parte do saldo mostrada em tela deve vir sempre do
-- servidor, nunca de conta feita no client.
--
-- Rode DEPOIS de 0001-0027 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.start_mines(bet_amount int, mine_count int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_new_balance int;
  v_round_id uuid;
  v_cells int[];
  v_mine_positions int[];
  i int;
  j int;
  tmp int;
  total_cells constant int := 25;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if mine_count is null or mine_count < 1 or mine_count > 20 then raise exception 'Quantidade de minas inválida.'; end if;

  if exists (select 1 from public.game_rounds where user_id = v_user_id and status = 'active') then
    raise exception 'Você já tem uma rodada em andamento. Finalize antes de começar outra.';
  end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- embaralha 0..24 (Fisher-Yates) e pega as primeiras mine_count como minas
  v_cells := array(select generate_series(0, total_cells - 1));
  for i in reverse total_cells..2 loop
    j := 1 + floor(random() * i)::int;
    tmp := v_cells[i]; v_cells[i] := v_cells[j]; v_cells[j] := tmp;
  end loop;
  v_mine_positions := v_cells[1:mine_count];

  insert into public.game_rounds (user_id, game, bet_amount, state)
  values (
    v_user_id, 'mines', bet_amount,
    jsonb_build_object(
      'total_cells', total_cells,
      'mine_count', mine_count,
      'mine_positions', to_jsonb(v_mine_positions),
      'revealed', '[]'::jsonb,
      'multiplier', 1
    )
  )
  returning id into v_round_id;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object(
    'round_id', v_round_id, 'total_cells', total_cells, 'mine_count', mine_count,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.start_mines(int, int) from public;
grant execute on function public.start_mines(int, int) to authenticated;

create or replace function public.start_tower(bet_amount int, mini boolean default false)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_new_balance int;
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

  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object(
    'round_id', v_round_id, 'levels', v_levels, 'cells_per_level', cells_per_level, 'game', v_game,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.start_tower(int, boolean) from public;
grant execute on function public.start_tower(int, boolean) to authenticated;

create or replace function public.start_hilo(bet_amount int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_new_balance int;
  v_round_id uuid;
  v_card int;
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

  v_card := 1 + floor(random() * 13)::int;

  insert into public.game_rounds (user_id, game, bet_amount, state)
  values (v_user_id, 'hilo', bet_amount, jsonb_build_object('current_card', v_card, 'multiplier', 1, 'streak', 0))
  returning id into v_round_id;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object('round_id', v_round_id, 'current_card', v_card, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.start_hilo(int) from public;
grant execute on function public.start_hilo(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
