-- =============================================================================
-- Tigrinho da Sorte — 0020: infraestrutura de rodada + Mina do Tigre (Mines)
-- =============================================================================
-- Diferente dos jogos anteriores (resultado único numa chamada), estes 4 da
-- Etapa 3 têm VÁRIAS decisões dentro da mesma rodada — o jogador escolhe
-- "continuar" ou "sacar" a cada passo. Isso exige guardar o estado da rodada
-- em andamento no banco (nunca no client, senão o jogador poderia forjar
-- "já revelei essa célula e era segura").
--
-- game_rounds: 1 rodada ativa por usuário por vez (índice único garante isso
-- — trava contra abrir várias rodadas em paralelo pra tentar burlar).
--
-- Mina do Tigre: grade de 25 células, jogador escolhe quantas minas (3, 5 ou
-- 8) antes de começar. Cada célula seguro revelada aumenta o multiplicador
-- pela fórmula de "odds justas" escalada a 95% de RTP — a MESMA fórmula que
-- jogos de Mines de verdade usam. Testado por simulação: o RTP fica em 95%
-- não importa em qual ponto o jogador decide sacar (sim_etapa3.js).
--
-- Rode DEPOIS de 0001-0019 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.game_rounds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  game        text not null check (game in ('mines', 'tower', 'tower_mini', 'hilo')),
  bet_amount  int not null,
  status      text not null default 'active' check (status in ('active', 'cashed_out', 'busted')),
  state       jsonb not null,
  payout      int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_game_rounds_user on public.game_rounds(user_id);

-- só pode existir 1 rodada ATIVA por usuário ao mesmo tempo (em qualquer um
-- dos 4 jogos) — evita abrir uma rodada nova sem resolver a anterior
create unique index if not exists idx_one_active_round_per_user
  on public.game_rounds(user_id) where status = 'active';

alter table public.game_rounds enable row level security;

drop policy if exists "game_rounds_select_own" on public.game_rounds;
create policy "game_rounds_select_own"
  on public.game_rounds for select
  using (auth.uid() = user_id);

drop trigger if exists game_rounds_updated_at on public.game_rounds;
create trigger game_rounds_updated_at
  before update on public.game_rounds
  for each row execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- Mina do Tigre
-- -----------------------------------------------------------------------------

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

  return json_build_object('round_id', v_round_id, 'total_cells', total_cells, 'mine_count', mine_count);
end;
$$;

revoke all on function public.start_mines(int, int) from public;
grant execute on function public.start_mines(int, int) to authenticated;

create or replace function public.reveal_mines_cell(round_id uuid, cell_index int)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.game_rounds;
  v_mine_positions int[];
  v_revealed int[];
  v_total_cells int;
  v_mine_count int;
  v_picks int;
  v_multiplier numeric;
  v_new_balance int;
  v_payout int := 0;
  v_busted boolean := false;
  v_fair_mult numeric;
  i int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;

  select * into v_round from public.game_rounds
  where id = round_id and user_id = v_user_id and status = 'active' and game = 'mines'
  for update;

  if not found then raise exception 'Rodada não encontrada ou já finalizada.'; end if;

  v_total_cells := (v_round.state->>'total_cells')::int;
  v_mine_count := (v_round.state->>'mine_count')::int;
  select array(select jsonb_array_elements_text(v_round.state->'mine_positions')::int) into v_mine_positions;
  select array(select jsonb_array_elements_text(v_round.state->'revealed')::int) into v_revealed;

  if cell_index < 0 or cell_index >= v_total_cells then raise exception 'Célula inválida.'; end if;
  if cell_index = any(v_revealed) then raise exception 'Célula já revelada.'; end if;

  if cell_index = any(v_mine_positions) then
    v_busted := true;
    update public.game_rounds
    set status = 'busted', payout = 0,
        state = v_round.state || jsonb_build_object('revealed', to_jsonb(array_append(v_revealed, cell_index)))
    where id = round_id;

    return json_build_object(
      'busted', true, 'mine_positions', v_mine_positions,
      'payout', 0, 'new_balance', (select credits from public.profiles where id = v_user_id)
    );
  end if;

  v_revealed := array_append(v_revealed, cell_index);
  v_picks := cardinality(v_revealed);

  v_fair_mult := 1;
  for i in 0..(v_picks - 1) loop
    v_fair_mult := v_fair_mult * (v_total_cells - i)::numeric / (v_total_cells - v_mine_count - i)::numeric;
  end loop;
  v_multiplier := 0.95 * v_fair_mult;

  update public.game_rounds
  set state = v_round.state || jsonb_build_object('revealed', to_jsonb(v_revealed), 'multiplier', v_multiplier)
  where id = round_id;

  -- grade totalmente limpa (revelou todas as células seguras) => saca automático
  if v_picks = (v_total_cells - v_mine_count) then
    v_payout := round(v_round.bet_amount * v_multiplier);
    update public.profiles set credits = credits + v_payout where id = v_user_id;
    update public.game_rounds set status = 'cashed_out', payout = v_payout where id = round_id;
    select credits into v_new_balance from public.profiles where id = v_user_id;

    return json_build_object(
      'busted', false, 'cleared', true, 'multiplier', v_multiplier,
      'picks', v_picks, 'payout', v_payout, 'new_balance', v_new_balance
    );
  end if;

  return json_build_object(
    'busted', false, 'cleared', false, 'multiplier', v_multiplier, 'picks', v_picks
  );
end;
$$;

revoke all on function public.reveal_mines_cell(uuid, int) from public;
grant execute on function public.reveal_mines_cell(uuid, int) to authenticated;

create or replace function public.cashout_mines(round_id uuid)
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
  where id = round_id and user_id = v_user_id and status = 'active' and game = 'mines'
  for update;

  if not found then raise exception 'Rodada não encontrada ou já finalizada.'; end if;

  v_multiplier := (v_round.state->>'multiplier')::numeric;
  if jsonb_array_length(v_round.state->'revealed') < 1 then
    raise exception 'Revele ao menos 1 célula antes de sacar.';
  end if;

  v_payout := round(v_round.bet_amount * v_multiplier);
  update public.profiles set credits = credits + v_payout where id = v_user_id;
  update public.game_rounds set status = 'cashed_out', payout = v_payout where id = round_id;
  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object(
    'payout', v_payout, 'new_balance', v_new_balance,
    'mine_positions', array(select jsonb_array_elements_text(v_round.state->'mine_positions')::int)
  );
end;
$$;

revoke all on function public.cashout_mines(uuid) from public;
grant execute on function public.cashout_mines(uuid) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
