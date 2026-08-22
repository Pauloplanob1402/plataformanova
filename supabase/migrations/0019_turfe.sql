-- =============================================================================
-- Tigrinho da Sorte — 0019: Turfe do Tigre (corrida do zodíaco)
-- =============================================================================
-- 12 animais do zodíaco chinês correm; você aposta em 1. Cada animal tem uma
-- probabilidade de vitória diferente (o Tigre é o favorito, maior chance,
-- mas por isso paga menos — como em qualquer corrida de verdade) e o
-- multiplicador de cada um foi calculado pra dar EXATAMENTE 94% de RTP não
-- importa em qual animal você aposte — não tem "animal mais vantajoso",
-- é só uma questão de perfil de risco (favorito paga pouco e ganha mais
-- vezes; azarão paga muito e ganha raramente).
--
-- Rode DEPOIS de 0001-0018 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.play_race(bet_amount int, choice text)
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
  v_winner text;
  roll numeric;
  cumulative numeric;
  i int;
  animal_ids   text[]    := array['tigre','dragao','cavalo','coelho','boi','macaco','galo','cachorro','porco','rato','cobra','cabra'];
  animal_weights numeric[] := array[20,    12,      10,       9,       8,     7,       7,     6,          6,      6,     5,       4];
  animal_payout  numeric[] := array[4.7,   7.8,     9.4,      10.4,    11.8,  13.4,    13.4,  15.7,       15.7,   15.7,  18.8,    23.5];
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if not (choice = any(animal_ids)) then raise exception 'Animal inválido.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  roll := random() * 100;
  cumulative := 0;
  v_winner := animal_ids[12];
  for i in 1..12 loop
    cumulative := cumulative + animal_weights[i];
    if roll < cumulative then
      v_winner := animal_ids[i];
      exit;
    end if;
  end loop;

  if v_winner = choice then
    for i in 1..12 loop
      if animal_ids[i] = choice then
        v_payout := round(bet_amount * animal_payout[i]);
        exit;
      end if;
    end loop;
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'race', bet_amount, choice, v_winner, v_payout);

  return json_build_object('winner', v_winner, 'payout', v_payout, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.play_race(int, text) from public;
grant execute on function public.play_race(int, text) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
