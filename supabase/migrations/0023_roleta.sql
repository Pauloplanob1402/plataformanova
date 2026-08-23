-- =============================================================================
-- Tigrinho da Sorte — 0023: Roleta da Fortuna
-- =============================================================================
-- Roleta europeia clássica (37 posições, 0-36, zero único). A matemática já
-- é conhecida — não precisa calibrar nada, é a mesma de qualquer roleta
-- europeia real: RTP = 97,3% em QUALQUER aposta (número exato ou simples).
--
-- Rode DEPOIS de 0001-0022 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

alter table public.simple_game_history drop constraint if exists simple_game_history_game_check;
alter table public.simple_game_history add constraint simple_game_history_game_check
  check (game in ('coin', 'lucky_number', 'dice', 'wheel', 'chest', 'scratch', 'keno', 'fishing', 'plinko', 'duel', 'bingo', 'race', 'roulette', 'baccarat'));

create or replace function public.play_roulette(bet_amount int, bet_type text, bet_value int default null)
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
  v_winning_number int;
  v_color text;
  red_numbers int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if bet_type not in ('straight','red','black','even','odd','low','high') then raise exception 'Aposta inválida.'; end if;
  if bet_type = 'straight' and (bet_value is null or bet_value < 0 or bet_value > 36) then
    raise exception 'Número inválido (0-36).';
  end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  v_winning_number := floor(random() * 37)::int; -- 0 a 36

  v_color := case
    when v_winning_number = 0 then 'green'
    when v_winning_number = any(red_numbers) then 'red'
    else 'black'
  end;

  v_payout := case
    when bet_type = 'straight' and bet_value = v_winning_number then bet_amount * 36
    when bet_type = 'red' and v_color = 'red' then bet_amount * 2
    when bet_type = 'black' and v_color = 'black' then bet_amount * 2
    when bet_type = 'even' and v_winning_number <> 0 and v_winning_number % 2 = 0 then bet_amount * 2
    when bet_type = 'odd' and v_winning_number % 2 = 1 then bet_amount * 2
    when bet_type = 'low' and v_winning_number between 1 and 18 then bet_amount * 2
    when bet_type = 'high' and v_winning_number between 19 and 36 then bet_amount * 2
    else 0
  end;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'roulette', bet_amount, bet_type || coalesce(':' || bet_value::text, ''), v_winning_number::text || ' (' || v_color || ')', v_payout);

  return json_build_object(
    'winning_number', v_winning_number, 'color', v_color,
    'payout', v_payout, 'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_roulette(int, text, int) from public;
grant execute on function public.play_roulette(int, text, int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
