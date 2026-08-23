-- =============================================================================
-- Tigrinho da Sorte — 0025: cancelar rodada travada
-- =============================================================================
-- Problema real que pode acontecer com qualquer jogador (não só em teste):
-- se a conexão cair, o navegador fechar, ou o app crashar no meio de uma
-- rodada de Mina/Torre/Torre Mini/Sobe-Desce, a rodada fica com status
-- 'active' pra sempre — e o índice único que impede rodadas simultâneas
-- (idx_one_active_round_per_user, criado em 0020) trava TODOS os jogos de
-- múltiplas etapas até alguém resolver isso manualmente no banco.
--
-- Esta RPC deixa o próprio jogador se destravar pela tela: encerra a rodada
-- ativa dele (se houver) como perdida, sem mexer no saldo de novo (a aposta
-- já foi debitada quando a rodada começou — cancelar não devolve nem cobra
-- de novo, só fecha o registro).
--
-- Rode DEPOIS de 0001-0024 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

create or replace function public.cancel_stuck_round()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.game_rounds;
begin
  if v_user_id is null then raise exception 'Não autenticado.'; end if;

  select * into v_round from public.game_rounds
  where user_id = v_user_id and status = 'active'
  for update;

  if not found then
    return json_build_object('ok', true, 'had_stuck_round', false);
  end if;

  update public.game_rounds set status = 'busted', payout = 0 where id = v_round.id;

  return json_build_object('ok', true, 'had_stuck_round', true, 'game', v_round.game);
end;
$$;

revoke all on function public.cancel_stuck_round() from public;
grant execute on function public.cancel_stuck_round() to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- Também já resolve o problema que você tem agora — rode e teste de novo.
-- =============================================================================
