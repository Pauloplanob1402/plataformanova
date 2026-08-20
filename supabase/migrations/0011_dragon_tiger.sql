-- =============================================================================
-- Tigrinho da Sorte — 0011: novo jogo "Dragão vs Tigre"
-- =============================================================================
-- Clássico jogo instantâneo asiático: 2 cartas (1=Ás ... 13=Rei, sem naipe)
-- reveladas, uma pro lado do Dragão e outra pro lado do Tigre — quem tirar
-- o valor mais alto ganha. O jogador aposta em Dragão, Tigre ou Empate
-- ANTES das cartas serem reveladas.
--
-- Cartas sorteadas de forma independente (equivalente a um baralho
-- "infinito" — simplificação padrão em jogos instantâneos: evita ter que
-- rastrear estado de baralho/embaralhamento entre rodadas no banco).
--
-- Pagamentos (calibrados por simulação de 5 milhões de rodadas, ver
-- sim_dragontiger.js):
--   - Aposta em Dragão ou Tigre: paga 1:1 se acertar; se der EMPATE, devolve
--     metade da aposta (não é vitória nem derrota total) — RTP ~96,2%,
--     igual ao Dragão x Tigre de cassino de verdade.
--   - Aposta em Empate: paga 8:1 se acertar, perde tudo se não empatar —
--     RTP ~69%. A margem alta aqui é normal e do jogo em si (em qualquer
--     cassino real o empate tem a maior margem de todas as apostas dessa
--     mesa) — não é erro de calibração.
--
-- Rode DEPOIS de 0001-0010 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create table if not exists public.dragon_tiger_history (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  bet_amount  int not null,
  bet_type    text not null check (bet_type in ('dragon', 'tiger', 'tie')),
  dragon_card int not null,
  tiger_card  int not null,
  winner      text not null check (winner in ('dragon', 'tiger', 'tie')),
  payout      int not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_dragon_tiger_history_user on public.dragon_tiger_history(user_id);

alter table public.dragon_tiger_history enable row level security;

drop policy if exists "dragon_tiger_history_select_own" on public.dragon_tiger_history;
create policy "dragon_tiger_history_select_own"
  on public.dragon_tiger_history for select
  using (auth.uid() = user_id);

create or replace function public.play_dragon_tiger(bet_amount int, bet_type text)
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
  v_dragon_card int;
  v_tiger_card int;
  v_winner text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado.';
  end if;

  if bet_amount is null or bet_amount <= 0 then
    raise exception 'Valor de aposta inválido.';
  end if;

  if bet_type not in ('dragon', 'tiger', 'tie') then
    raise exception 'Tipo de aposta inválido.';
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

  v_dragon_card := 1 + floor(random() * 13)::int;
  v_tiger_card  := 1 + floor(random() * 13)::int;

  v_winner := case
    when v_dragon_card > v_tiger_card then 'dragon'
    when v_tiger_card > v_dragon_card then 'tiger'
    else 'tie'
  end;

  if bet_type = 'tie' then
    if v_winner = 'tie' then
      v_payout := bet_amount * 9; -- paga 8:1 (devolve 9x no total)
    end if;
  else
    if v_winner = bet_type then
      v_payout := bet_amount * 2; -- paga 1:1 (devolve 2x no total)
    elsif v_winner = 'tie' then
      v_payout := round(bet_amount * 0.5); -- empate devolve metade
    end if;
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.dragon_tiger_history (user_id, bet_amount, bet_type, dragon_card, tiger_card, winner, payout)
  values (v_user_id, bet_amount, bet_type, v_dragon_card, v_tiger_card, v_winner, v_payout);

  return json_build_object(
    'dragon_card', v_dragon_card,
    'tiger_card', v_tiger_card,
    'winner', v_winner,
    'payout', v_payout,
    'new_balance', v_new_balance
  );
end;
$$;

revoke all on function public.play_dragon_tiger(int, text) from public;
grant execute on function public.play_dragon_tiger(int, text) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
