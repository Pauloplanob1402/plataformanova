-- =============================================================================
-- Tigrinho da Sorte — Fase 6: sistema VIP (opcional)
-- =============================================================================
-- Roda depois de 0001, 0002 e 0003 (ways_to_win) já aplicadas.
-- Baseado no total apostado (soma histórica de spin_history.bet_amount) por
-- usuário. Faixas: Bronze 0–999, Prata 1.000–4.999, Ouro 5.000+.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. view user_vip_status
-- -----------------------------------------------------------------------------
-- IMPORTANTE: assim como redeem_codes_public (Fase 2), esta view é criada
-- SEM security_invoker, então roda com o privilégio de quem a criou (dono da
-- tabela) e por isso consegue agregar spin_history mesmo essa tabela não
-- tendo nenhuma policy de SELECT liberada para outro usuário. Para não
-- vazar o total apostado de outras pessoas, o filtro "where p.id = auth.uid()"
-- fica dentro da própria definição da view — cada usuário só consegue ver a
-- própria linha, não importa como a consulta.

create view public.user_vip_status as
select
  p.id as user_id,
  coalesce(sum(sh.bet_amount), 0)::integer as total_wagered,
  case
    when coalesce(sum(sh.bet_amount), 0) >= 5000 then 'Ouro'
    when coalesce(sum(sh.bet_amount), 0) >= 1000 then 'Prata'
    else 'Bronze'
  end as vip_tier,
  case
    when coalesce(sum(sh.bet_amount), 0) >= 5000 then 2
    when coalesce(sum(sh.bet_amount), 0) >= 1000 then 1
    else 0
  end as vip_level,
  case
    when coalesce(sum(sh.bet_amount), 0) >= 5000 then null
    when coalesce(sum(sh.bet_amount), 0) >= 1000 then 5000
    else 1000
  end as next_threshold
from public.profiles p
left join public.spin_history sh on sh.user_id = p.id
where p.id = auth.uid()
group by p.id;

grant select on public.user_vip_status to authenticated;

-- -----------------------------------------------------------------------------
-- 2. daily_checkin() — agora escala com o nível VIP
-- -----------------------------------------------------------------------------
-- Substitui a versão de 0002_functions.sql (create or replace troca o
-- comportamento sem precisar apagar nada). Bronze continua em 50; Prata e
-- Ouro recebem mais.

create or replace function public.daily_checkin()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_total_wagered integer;
  v_reward int;
  v_already_done boolean;
  v_new_balance int;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  select exists(
    select 1 from public.daily_checkins
    where user_id = v_user_id and checkin_date = v_today
  ) into v_already_done;

  if v_already_done then
    raise exception 'Você já resgatou o bônus de hoje. Volte amanhã!';
  end if;

  select coalesce(sum(bet_amount), 0) into v_total_wagered
  from public.spin_history
  where user_id = v_user_id;

  v_reward := case
    when v_total_wagered >= 5000 then 100 -- Ouro
    when v_total_wagered >= 1000 then 75  -- Prata
    else 50                                -- Bronze
  end;

  insert into public.daily_checkins (user_id, checkin_date, reward)
  values (v_user_id, v_today, v_reward);

  update public.profiles set credits = credits + v_reward where id = v_user_id;
  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object('reward', v_reward, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.daily_checkin() from public;
grant execute on function public.daily_checkin() to authenticated;

-- =============================================================================
-- Como rodar: SQL Editor -> New query -> cole este arquivo -> Run
-- (depois de 0001, 0002 e 0003_ways_to_win já aplicadas)
--
-- Teste: select * from public.user_vip_status; (autenticado como um usuário
-- que já deu alguns giros) deve devolver uma linha só, com o total apostado
-- por ELE e o tier correspondente.
-- =============================================================================
