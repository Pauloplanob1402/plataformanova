-- =============================================================================
-- Tigrinho da Sorte — Fase 3: funções RPC (lógica de jogo protegida no servidor)
-- =============================================================================
-- Por que isso existe: um usuário mal-intencionado pode abrir o DevTools,
-- reescrever o JavaScript do site e chamar a API do Supabase diretamente
-- (com a anon key, que é pública por design). Se o cálculo de créditos
-- morasse no React, essa pessoa poderia se creditar de graça. Por isso TODA
-- regra que mexe em créditos roda aqui dentro, em funções SECURITY DEFINER —
-- elas rodam com o privilégio de quem as criou (ignorando RLS de propósito),
-- e são o ÚNICO caminho autorizado a escrever nas tabelas sensíveis, porque
-- nenhuma tabela tem policy de INSERT/UPDATE para o client (ver 0001_init.sql).
--
-- "SET search_path = public, pg_temp" em cada função é proteção contra
-- "search_path hijacking": sem isso, alguém com permissão de criar objetos
-- em outro schema poderia criar uma função/tabela com o mesmo nome em um
-- schema que entra antes de "public" na busca, e a função SECURITY DEFINER
-- acabaria chamando essa versão maliciosa em vez da real.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. spin_slot(bet_amount int) — gira os 3 rolos e resolve o pagamento
-- -----------------------------------------------------------------------------
-- Replica exatamente os pesos e multiplicadores de src/core/symbols.ts e a
-- mesma regra de vitória do SlotMachine.tsx (evaluateResult): os 3 rolos são
-- sorteados de forma independente com os mesmos pesos, e só paga se os 3
-- baterem. Se algum dia você editar symbols.ts, edite esta função também
-- para manter os dois lados em sincronia.

create or replace function public.spin_slot(bet_amount int)
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
  v_symbols text[3];
  v_indices int[3];
  v_multiplier numeric;

  -- mesma tabela de src/core/symbols.ts, na mesma ordem (índices 1..6):
  symbol_ids text[] := array['lantern', 'ingot', 'coin', 'firecracker', 'bell', 'tiger'];
  symbol_weights int[] := array[32, 24, 20, 14, 7, 3];
  symbol_multipliers numeric[] := array[1.5, 2.5, 4, 7, 15, 45];
  total_weight int := 100; -- soma de symbol_weights

  roll numeric;
  cumulative int;
  picked int;
  i int;
  j int;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if bet_amount is null or bet_amount <= 0 then
    raise exception 'Valor de aposta inválido.';
  end if;

  -- "for update" trava a linha até o fim da transação: evita que dois spins
  -- simultâneos do mesmo usuário leiam o mesmo saldo antigo (race condition).
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

  for i in 1..3 loop
    roll := random() * total_weight;
    cumulative := 0;
    picked := 6; -- fallback, nunca deveria ser usado
    for j in 1..6 loop
      cumulative := cumulative + symbol_weights[j];
      if roll < cumulative then
        picked := j;
        exit;
      end if;
    end loop;
    v_indices[i] := picked;
    v_symbols[i] := symbol_ids[picked];
  end loop;

  if v_indices[1] = v_indices[2] and v_indices[2] = v_indices[3] then
    v_multiplier := symbol_multipliers[v_indices[1]];
    v_payout := round(bet_amount * v_multiplier);
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.spin_history (user_id, bet_amount, payout, symbols)
  values (v_user_id, bet_amount, v_payout, to_jsonb(v_symbols));

  return json_build_object(
    'symbols', v_symbols,
    'payout', v_payout,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.spin_slot(int) from public;
grant execute on function public.spin_slot(int) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. daily_checkin() — bônus diário
-- -----------------------------------------------------------------------------

create or replace function public.daily_checkin()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_reward int := 50; -- valor fixo por enquanto; a Fase 6 pode fazer variar por vip_level
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

  insert into public.daily_checkins (user_id, checkin_date, reward)
  values (v_user_id, v_today, v_reward);

  update public.profiles set credits = credits + v_reward where id = v_user_id;
  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object('reward', v_reward, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.daily_checkin() from public;
grant execute on function public.daily_checkin() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. redeem_code(p_code text) — resgate de código promocional
-- -----------------------------------------------------------------------------

create or replace function public.redeem_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.redeem_codes%rowtype;
  v_already_used boolean;
  v_new_balance int;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Digite um código.';
  end if;

  -- "for update" trava a linha do código: impede que dois usuários resgatando
  -- ao mesmo tempo façam uses_count passar de max_uses por condição de corrida.
  select * into v_row
  from public.redeem_codes
  where code = p_code
  for update;

  if not found then
    raise exception 'Código inválido.';
  end if;

  if v_row.expires_at is not null and v_row.expires_at <= now() then
    raise exception 'Este código expirou.';
  end if;

  if v_row.uses_count >= v_row.max_uses then
    raise exception 'Este código já atingiu o limite de usos.';
  end if;

  select exists(
    select 1 from public.redeem_code_uses
    where user_id = v_user_id and code = p_code
  ) into v_already_used;

  if v_already_used then
    raise exception 'Você já usou este código antes.';
  end if;

  update public.redeem_codes set uses_count = uses_count + 1 where code = p_code;
  insert into public.redeem_code_uses (user_id, code) values (v_user_id, p_code);
  update public.profiles set credits = credits + v_row.reward where id = v_user_id;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object('reward', v_row.reward, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.redeem_code(text) from public;
grant execute on function public.redeem_code(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. apply_referral(p_referral_code text) — aplica código de quem indicou
-- -----------------------------------------------------------------------------

create or replace function public.apply_referral(p_referral_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_own_code text;
  v_current_referred_by uuid;
  v_referrer_id uuid;
  v_bonus int := 50;
  v_new_balance int;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if p_referral_code is null or length(trim(p_referral_code)) = 0 then
    raise exception 'Digite um código de indicação.';
  end if;

  select referral_code, referred_by into v_own_code, v_current_referred_by
  from public.profiles
  where id = v_user_id;

  if v_current_referred_by is not null then
    raise exception 'Você já usou um código de indicação antes.';
  end if;

  if upper(trim(p_referral_code)) = upper(v_own_code) then
    raise exception 'Você não pode usar o seu próprio código.';
  end if;

  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(trim(p_referral_code));

  if v_referrer_id is null then
    raise exception 'Código de indicação inválido.';
  end if;

  update public.profiles
  set referred_by = v_referrer_id, credits = credits + v_bonus
  where id = v_user_id;

  update public.profiles
  set credits = credits + v_bonus
  where id = v_referrer_id;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  return json_build_object('bonus', v_bonus, 'new_balance', v_new_balance);
end;
$$;

revoke all on function public.apply_referral(text) from public;
grant execute on function public.apply_referral(text) to authenticated;

-- =============================================================================
-- Como rodar esta migration
-- =============================================================================
-- Mesma coisa da Fase 2 — rode DEPOIS de 0001_init.sql já estar aplicado:
--
-- Opção A (CLI):  npx supabase db push
-- Opção B (painel): SQL Editor -> New query -> cole este arquivo -> Run
--
-- Teste rápido pelo SQL Editor (logado como você mesmo, via API/RPC, não como
-- superusuário — o SQL Editor roda como postgres e ignora RLS/SECURITY
-- DEFINER na prática, então o teste real precisa ser feito chamando a RPC
-- pelo app ou por um "curl" autenticado):
--   select public.spin_slot(10);
--   select public.daily_checkin();
--   select public.redeem_code('ALGUMCODIGO');
--   select public.apply_referral('ABCDEF12');
-- =============================================================================
