-- =============================================================================
-- Tigrinho da Sorte — 0014: Baú do Tigre
-- =============================================================================
-- Escolhe 1 de 3 baús. Só o escolhido é creditado, mas os OUTROS DOIS também
-- são revelados no final (efeito "quase ganhei" do Adam Alter — se um baú
-- não escolhido tinha prêmio maior, o jogador vê e sente vontade de tentar
-- de novo). Tabela de prêmios: 0x(40%) 0.5x(30%) 1.5x(20%) 4x(8%) 8.5x(2%).
-- RTP = 94%.
--
-- Rode DEPOIS de 0001-0013 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.play_chest(bet_amount int, choice int)
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
  v_values numeric[3];
  v_chosen_mult numeric;
  segment_values  numeric[] := array[0, 0.5, 1.5, 4, 8.5];
  segment_weights numeric[] := array[40, 30, 20, 8, 2];
  roll numeric;
  cumulative numeric;
  i int;
  j int;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;
  if bet_amount is null or bet_amount <= 0 then raise exception 'Valor de aposta inválido.'; end if;
  if choice is null or choice < 1 or choice > 3 then raise exception 'Escolha inválida.'; end if;

  select credits into v_credits from public.profiles where id = v_user_id for update;
  if v_credits is null then raise exception 'Perfil não encontrado.'; end if;
  if v_credits < bet_amount then raise exception 'Créditos insuficientes para essa aposta.'; end if;

  update public.profiles set credits = credits - bet_amount where id = v_user_id;

  -- sorteia o conteúdo dos 3 baús de forma independente
  for j in 1..3 loop
    roll := random() * 100;
    cumulative := 0;
    v_values[j] := segment_values[5]; -- fallback
    for i in 1..5 loop
      cumulative := cumulative + segment_weights[i];
      if roll < cumulative then
        v_values[j] := segment_values[i];
        exit;
      end if;
    end loop;
  end loop;

  v_chosen_mult := v_values[choice];
  v_payout := round(bet_amount * v_chosen_mult);

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.simple_game_history (user_id, game, bet_amount, choice, result, payout)
  values (v_user_id, 'chest', bet_amount, choice::text, to_jsonb(v_values)::text, v_payout);

  return json_build_object(
    'chest_values', v_values,
    'chosen_index', choice,
    'payout', v_payout,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_chest(int, int) from public;
grant execute on function public.play_chest(int, int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
