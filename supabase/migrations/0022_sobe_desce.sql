-- =============================================================================
-- Tigrinho da Sorte — 0022: Sobe-Desce do Tigre (Hi-Lo)
-- =============================================================================
-- Carta atual de 1-13. Jogador aposta se a próxima vai ser MAIOR ou MENOR.
-- Empate (mesma carta) sempre conta como derrota, pros dois lados. O
-- multiplicador muda a cada rodada dependendo da carta atual (carta baixa =
-- "maior" é quase certo = paga pouco; carta alta = o oposto) — mesma
-- fórmula de odds justas escalada a 95% de RTP das outras.
--
-- Rode DEPOIS de 0001-0021 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

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

  return json_build_object('round_id', v_round_id, 'current_card', v_card);
end;
$$;

revoke all on function public.start_hilo(int) from public;
grant execute on function public.start_hilo(int) to authenticated;

create or replace function public.guess_hilo(round_id uuid, direction text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.game_rounds;
  v_current_card int;
  v_next_card int;
  v_prob numeric;
  v_correct boolean;
  v_multiplier numeric;
  v_streak int;
  v_new_balance int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if direction not in ('higher', 'lower') then raise exception 'Direção inválida.'; end if;

  select * into v_round from public.game_rounds
  where id = round_id and user_id = v_user_id and status = 'active' and game = 'hilo'
  for update;

  if not found then raise exception 'Rodada não encontrada ou já finalizada.'; end if;

  v_current_card := (v_round.state->>'current_card')::int;

  if direction = 'higher' and v_current_card = 13 then
    raise exception 'Não é possível apostar em "maior" com carta 13.';
  end if;
  if direction = 'lower' and v_current_card = 1 then
    raise exception 'Não é possível apostar em "menor" com carta 1.';
  end if;

  v_next_card := 1 + floor(random() * 13)::int;

  v_prob := case
    when direction = 'higher' then (13 - v_current_card)::numeric / 13
    else (v_current_card - 1)::numeric / 13
  end;

  v_correct := case
    when direction = 'higher' then v_next_card > v_current_card
    else v_next_card < v_current_card
  end;

  if not v_correct then
    update public.game_rounds set status = 'busted', payout = 0 where id = round_id;
    return json_build_object(
      'correct', false, 'next_card', v_next_card,
      'payout', 0, 'new_balance', (select credits from public.profiles where id = v_user_id)
    );
  end if;

  v_multiplier := (v_round.state->>'multiplier')::numeric * (0.95 / v_prob);
  v_streak := (v_round.state->>'streak')::int + 1;

  update public.game_rounds
  set state = jsonb_build_object('current_card', v_next_card, 'multiplier', v_multiplier, 'streak', v_streak)
  where id = round_id;

  return json_build_object('correct', true, 'next_card', v_next_card, 'multiplier', v_multiplier, 'streak', v_streak);
end;
$$;

revoke all on function public.guess_hilo(uuid, text) from public;
grant execute on function public.guess_hilo(uuid, text) to authenticated;

create or replace function public.cashout_hilo(round_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.game_rounds;
  v_payout int;
  v_new_balance int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;

  select * into v_round from public.game_rounds
  where id = round_id and user_id = v_user_id and status = 'active' and game = 'hilo'
  for update;

  if not found then raise exception 'Rodada não encontrada ou já finalizada.'; end if;

  if (v_round.state->>'streak')::int < 1 then
    raise exception 'Acerte ao menos 1 rodada antes de sacar.';
  end if;

  v_payout := round(v_round.bet_amount * (v_round.state->>'multiplier')::numeric);
  update public.profiles set credits = credits + v_payout where id = v_user_id;
  update public.game_rounds set status = 'cashed_out', payout = v_payout where id = round_id;
  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object('payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.cashout_hilo(uuid) from public;
grant execute on function public.cashout_hilo(uuid) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
