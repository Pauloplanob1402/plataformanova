-- =============================================================================
-- Tigrinho da Sorte — 0027: Ranking semanal + Ticker de ganhos ao vivo
-- =============================================================================
-- Une as 6 tabelas de histórico espalhadas (spin_history, hold_win_history,
-- simple_game_history, dragon_tiger_history, baccarat_history, game_rounds)
-- numa única view, e expõe 2 RPCs que só devolvem dado ANÔNIMO — nunca
-- e-mail, telefone ou qualquer coisa identificável de verdade. A view em si
-- NÃO tem RLS pra ser lida diretamente pelo client (ninguém tem select
-- direto nela) — só as duas funções abaixo, que já filtram e anonimizam
-- antes de devolver.
--
-- Identificação pública usa profiles.referral_code, que já é público por
-- natureza (o jogador já compartilha esse código pra indicar amigos).
--
-- Rode DEPOIS de 0001-0026 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace view public.all_bets_v as
  select user_id, 'tigrinho'::text as game, bet_amount, payout, created_at
  from public.spin_history
  union all
  select user_id, 'moedas'::text as game, bet_amount, payout, created_at
  from public.hold_win_history
  union all
  select user_id, game, bet_amount, payout, created_at
  from public.simple_game_history
  union all
  select user_id, 'dragaotigre'::text as game, bet_amount, payout, created_at
  from public.dragon_tiger_history
  union all
  select user_id, 'batalha'::text as game, bet_amount, payout, created_at
  from public.baccarat_history
  union all
  select user_id, game, bet_amount, payout, created_at
  from public.game_rounds
  where status in ('busted', 'cashed_out');

-- -----------------------------------------------------------------------------
-- Ranking semanal — top 20 por saldo líquido (ganho - apostado) nos últimos 7 dias
-- -----------------------------------------------------------------------------
create or replace function public.get_weekly_ranking()
returns table (referral_code text, net_winnings bigint, rank int)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    p.referral_code,
    sum(b.payout - b.bet_amount)::bigint as net_winnings,
    row_number() over (order by sum(b.payout - b.bet_amount) desc)::int as rank
  from public.all_bets_v b
  join public.profiles p on p.id = b.user_id
  where b.created_at >= now() - interval '7 days'
  group by p.referral_code
  having sum(b.payout - b.bet_amount) > 0
  order by net_winnings desc
  limit 20;
$$;

revoke all on function public.get_weekly_ranking() from public;
grant execute on function public.get_weekly_ranking() to authenticated;

-- -----------------------------------------------------------------------------
-- Ticker de ganhos ao vivo — últimas vitórias "grandes" (payout >= 3x a aposta)
-- nas últimas 24h
-- -----------------------------------------------------------------------------
create or replace function public.get_recent_big_wins(limit_count int default 15)
returns table (referral_code text, game text, payout int, created_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.referral_code, b.game, b.payout, b.created_at
  from public.all_bets_v b
  join public.profiles p on p.id = b.user_id
  where b.payout >= b.bet_amount * 3
    and b.created_at >= now() - interval '24 hours'
  order by b.created_at desc
  limit greatest(1, least(limit_count, 50));
$$;

revoke all on function public.get_recent_big_wins(int) from public;
grant execute on function public.get_recent_big_wins(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
