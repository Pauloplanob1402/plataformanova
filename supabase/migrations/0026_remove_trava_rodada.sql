-- =============================================================================
-- Tigrinho da Sorte — 0026: elimina o travamento de rodada por completo
-- =============================================================================
-- DIAGNÓSTICO: não havia bug de lógica em reveal_mines_cell / climb_tower /
-- guess_hilo — todos fecham a rodada corretamente (busted ou cashed_out)
-- sempre que o jogador estoura ou saca. O problema real é de design: se o
-- jogador começa uma rodada e NÃO a termina explicitamente (não saca, não
-- estoura — ex: testa a Mina, revela 2 células, troca pra testar a Torre
-- sem voltar), a trava de segurança "só 1 rodada ativa por vez" (criada em
-- 0020 pra impedir múltiplas rodadas em paralelo) bloqueia QUALQUER jogo
-- novo até alguém cancelar manualmente. Isso é fácil demais de cair sem
-- querer — tanto testando quanto jogando de verdade (trocar de aba, cair a
-- conexão, etc.).
--
-- CORREÇÃO: em vez de bloquear e exigir cancelamento manual, os 3 "start"
-- (start_mines, start_tower, start_hilo) agora encerram sozinhos qualquer
-- rodada antiga pendurada do mesmo jogador ANTES de criar a nova — sem
-- pedir nada, sem travar nada. A rodada antiga é fechada como perdida (o
-- valor apostado nela já tinha sido debitado quando começou; encerrar não
-- desconta de novo, só fecha o registro) — exatamente o que o botão
-- "Cancelar rodada travada" já fazia manualmente, só que automático agora.
--
-- O botão/RPC cancel_stuck_round (0025) continua existindo, sem problema,
-- só que na prática nunca mais deve ser necessário usá-lo.
--
-- Rode DEPOIS de 0001-0025 já aplicadas. Cole no SQL Editor do Supabase.
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

  -- encerra sozinho qualquer rodada antiga pendurada (não bloqueia mais)
  update public.game_rounds set status = 'busted', payout = 0
  where user_id = v_user_id and status = 'active';

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

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

  return json_build_object('round_id', v_round_id, 'total_cells', total_cells, 'mine_count', mine_count);
end;
$$;

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
  v_game text := case when mini then 'tower_mini' else 'tower' end;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  update public.game_rounds set status = 'busted', payout = 0
  where user_id = v_user_id and status = 'active';

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

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

create or replace function public.start_hilo(bet_amount int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_credits int;
  v_round_id uuid;
  v_card int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;

  update public.game_rounds set status = 'busted', payout = 0
  where user_id = v_user_id and status = 'active';

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_card := 1 + floor(random() * 13)::int;

  insert into public.game_rounds (user_id, game, bet_amount, state)
  values (v_user_id, 'hilo', bet_amount, jsonb_build_object('current_card', v_card, 'multiplier', 1, 'streak', 0))
  returning id into v_round_id;

  return json_build_object('round_id', v_round_id, 'current_card', v_card);
end;
$$;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- Depois disso, nenhum dos 4 jogos (Mina/Torre/Torre Mini/Sobe-Desce) volta
-- a travar por rodada pendurada, mesmo trocando de jogo no meio de uma
-- partida sem sacar.
-- =============================================================================
