-- =============================================================================
-- Tigrinho da Sorte — 0010: novo jogo "Moedas do Tigre" (Hold & Win)
-- =============================================================================
-- Grade 5x3 (15 células). Cada célula cai Moeda (com um valor) ou fica em
-- branco. Se 6 ou mais moedas caírem no giro inicial, ativa o recurso: as
-- moedas travam no lugar, e só as células em branco continuam girando —
-- com 3 "vidas" de respin, que voltam pra 3 toda vez que uma moeda nova
-- cai. Acaba quando as vidas zeram ou a grade fecha 100% de moedas
-- (jackpot máximo). Prêmio final = soma do valor de todas as moedas
-- travadas × valor da aposta.
--
-- CALIBRAÇÃO (rodando 2 milhões de giros simulados, sim_holdwin.js):
--   - chance de moeda por célula: 19,2%
--   - mínimo de moedas pra ativar o recurso: 6 de 15
--   - vidas de respin: 3 (resetam a cada moeda nova)
--   - RTP resultante: ~92,7% | recurso dispara em ~5,1% dos giros
--     (~1 em cada 20) | grade cheia em ~1,7% dos giros
-- Se um dia quiser mudar esses números, rode a simulação de novo antes de
-- aplicar — é um sistema com "efeito bola de neve" (moeda nova reseta as
-- vidas), então pequenos ajustes de probabilidade mudam o RTP de forma
-- BEM não-linear (testado: 19,1% → RTP 90%, 20% → RTP 110%+).
--
-- Segue o mesmo padrão de segurança dos outros jogos: tudo decidido e
-- travado numa única chamada RPC SECURITY DEFINER, sem nenhuma escrita
-- direta do client. Os "frames" de cada respin já vêm prontos na resposta
-- pro front só animar em sequência, sem chamadas adicionais ao servidor.
--
-- Rode DEPOIS de 0001-0009 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.hold_win_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  bet_amount  int not null,
  payout      int not null,
  coin_count  int not null,
  full_grid   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_hold_win_history_user on public.hold_win_history(user_id);

alter table public.hold_win_history enable row level security;

drop policy if exists "hold_win_history_select_own" on public.hold_win_history;
create policy "hold_win_history_select_own"
  on public.hold_win_history for select
  using (auth.uid() = user_id);

create or replace function public.spin_hold_win(bet_amount int)
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

  cell_count constant int := 15; -- grade 5 colunas x 3 linhas
  coin_prob  constant numeric := 0.192;
  trigger_min constant int := 6;
  start_lives constant int := 3;

  coin_values  numeric[] := array[0.5, 1, 1.5, 2, 3, 5, 10, 50];
  coin_weights numeric[] := array[40, 30, 15, 8, 4, 2, 0.7, 0.3];
  total_coin_weight constant numeric := 100; -- soma de coin_weights

  v_is_coin boolean[15] := array_fill(false, array[15]);
  v_value   numeric[15] := array_fill(0::numeric, array[15]);
  v_coin_count int := 0;
  v_feature_triggered boolean := false;
  v_full_grid boolean := false;
  v_lives int;
  v_new_landed boolean;
  v_frames jsonb := '[]'::jsonb;

  roll numeric;
  cumulative numeric;
  picked_value numeric;
  i int;
  vi int;
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

  -- ── Grade inicial ────────────────────────────────────────────
  for i in 1..cell_count loop
    if random() < coin_prob then
      v_is_coin[i] := true;
      roll := random() * total_coin_weight;
      cumulative := 0;
      picked_value := coin_values[8]; -- fallback
      for vi in 1..8 loop
        cumulative := cumulative + coin_weights[vi];
        if roll < cumulative then
          picked_value := coin_values[vi];
          exit;
        end if;
      end loop;
      v_value[i] := picked_value;
      v_coin_count := v_coin_count + 1;
    end if;
  end loop;

  v_frames := v_frames || jsonb_build_object(
    'cells', (select jsonb_agg(case when v_is_coin[k] then to_jsonb(v_value[k]) else 'null'::jsonb end order by k) from generate_series(1, cell_count) k)
  );

  -- ── Recurso Hold & Win, se atingiu o mínimo de moedas ───────
  if v_coin_count >= trigger_min then
    v_feature_triggered := true;
    v_lives := start_lives;

    while v_lives > 0 and v_coin_count < cell_count loop
      v_lives := v_lives - 1;
      v_new_landed := false;

      for i in 1..cell_count loop
        if not v_is_coin[i] then
          if random() < coin_prob then
            v_is_coin[i] := true;
            roll := random() * total_coin_weight;
            cumulative := 0;
            picked_value := coin_values[8];
            for vi in 1..8 loop
              cumulative := cumulative + coin_weights[vi];
              if roll < cumulative then
                picked_value := coin_values[vi];
                exit;
              end if;
            end loop;
            v_value[i] := picked_value;
            v_coin_count := v_coin_count + 1;
            v_new_landed := true;
          end if;
        end if;
      end loop;

      v_frames := v_frames || jsonb_build_object(
        'cells', (select jsonb_agg(case when v_is_coin[k] then to_jsonb(v_value[k]) else 'null'::jsonb end order by k) from generate_series(1, cell_count) k)
      );

      if v_new_landed then
        v_lives := start_lives;
      end if;
    end loop;

    v_full_grid := (v_coin_count = cell_count);

    for i in 1..cell_count loop
      if v_is_coin[i] then
        v_payout := v_payout + v_value[i];
      end if;
    end loop;
    v_payout := round(v_payout * bet_amount);
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.hold_win_history (user_id, bet_amount, payout, coin_count, full_grid)
  values (v_user_id, bet_amount, v_payout::int, v_coin_count, v_full_grid);

  return json_build_object(
    'frames', v_frames,
    'feature_triggered', v_feature_triggered,
    'full_grid', v_full_grid,
    'coin_count', v_coin_count,
    'payout', v_payout::int,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.spin_hold_win(int) from public;
grant execute on function public.spin_hold_win(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
