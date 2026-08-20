-- =============================================================================
-- Tigrinho da Sorte — 0009: Recurso "Respin Dourado"
-- =============================================================================
-- A própria assinatura do gênero "Fortune Tiger": em ~1 a cada 333 giros
-- (0,3% de chance, sorteada TODO giro, independente do resultado normal),
-- um símbolo trava na grade e só as outras posições giram de novo,
-- repetindo até não cair mais nenhuma cópia nova (ou até 6 respins, trava
-- de segurança) — e se a grade inteira travar com o mesmo símbolo, o
-- prêmio daquela rodada é multiplicado por 5x.
--
-- CALIBRAÇÃO: os parâmetros (0.3% de chance, 6 respins máx, bônus 5x) foram
-- escolhidos rodando 2 milhões de giros simulados (script Node em anexo à
-- entrega, sim_respin.js) até o RTP total ficar em ~94,6% — contra ~92,9%
-- do jogo base sem o recurso. Se um dia quiser mudar esses números, rode a
-- simulação de novo antes de aplicar em produção; ajustar isso "no olho"
-- pode disparar o RTP sem perceber (o item que mais pesa é justamente
-- v_full_grid_bonus, porque tela cheia já paga as 3 linhas de uma vez).
--
-- Retorna "feature": null quando o recurso não disparou, ou um objeto com
-- os "frames" (cada estado intermediário da grade) pro front animar os
-- respins em sequência, sem precisar de nenhuma chamada adicional ao
-- servidor no meio da animação — tudo já veio calculado e travado nesta
-- única resposta.
--
-- Rode DEPOIS de 0001-0008 já aplicadas. Cole no SQL Editor do Supabase.
-- =============================================================================

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

  symbol_ids text[] := array['lantern', 'ingot', 'coin', 'firecracker', 'bell', 'tiger'];
  symbol_weights int[] := array[32, 24, 20, 14, 7, 3];
  symbol_payout_mult numeric[] := array[3, 5, 10, 16, 45, 120];
  total_weight int := 100;
  tiger_index constant int := 6; -- posição do tigre em symbol_ids (1-based)

  -- grade 3x3 achatada (reel-major): posições 1-3 = rolo 1, 4-6 = rolo 2, 7-9 = rolo 3
  v_grid_idx int[9];
  v_grid_ids text[9];
  v_winning_ids text[] := array[]::text[];
  v_winning_rows int[] := array[]::int[];

  roll numeric;
  cumulative int;
  picked int;
  reel_i int;
  row_i int;
  sym_i int;
  s1 int;
  s2 int;
  s3 int;
  pos int;

  -- ── Respin Dourado ──────────────────────────────────────────
  v_feature_chance constant numeric := 0.003;   -- 0,3% por giro (~1 em 333)
  v_max_respins    constant int := 6;           -- trava contra sorte extrema
  v_full_grid_bonus constant numeric := 5;      -- multiplicador se travar a grade inteira
  v_feature_triggered boolean := false;
  v_lock_symbol int;
  v_respin_count int := 0;
  v_new_landed boolean;
  v_full_grid boolean := false;
  v_frames jsonb := '[]'::jsonb;
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

  -- ── Giro normal (igual antes) ────────────────────────────────
  for reel_i in 1..3 loop
    for row_i in 1..3 loop
      roll := random() * total_weight;
      cumulative := 0;
      picked := 6;
      for sym_i in 1..6 loop
        cumulative := cumulative + symbol_weights[sym_i];
        if roll < cumulative then
          picked := sym_i;
          exit;
        end if;
      end loop;
      pos := (reel_i - 1) * 3 + row_i;
      v_grid_idx[pos] := picked;
      v_grid_ids[pos] := symbol_ids[picked];
    end loop;
  end loop;

  -- ── Sorteio do Respin Dourado (independente do resultado do giro normal) ──
  if random() < v_feature_chance then
    v_feature_triggered := true;

    -- símbolo que vai travar: prioriza o Tigre se ele já caiu em algum lugar
    -- na grade inicial; senão sorteia entre os símbolos que já estão nela
    if tiger_index = any(v_grid_idx) then
      v_lock_symbol := tiger_index;
    else
      v_lock_symbol := v_grid_idx[1 + floor(random() * 9)::int];
    end if;

    v_frames := v_frames || jsonb_build_object('grid', to_jsonb(v_grid_ids), 'locked', symbol_ids[v_lock_symbol]);

    loop
      v_respin_count := v_respin_count + 1;
      v_new_landed := false;

      for pos in 1..9 loop
        if v_grid_idx[pos] <> v_lock_symbol then
          roll := random() * total_weight;
          cumulative := 0;
          picked := 6;
          for sym_i in 1..6 loop
            cumulative := cumulative + symbol_weights[sym_i];
            if roll < cumulative then
              picked := sym_i;
              exit;
            end if;
          end loop;
          if picked = v_lock_symbol then
            v_new_landed := true;
          end if;
          v_grid_idx[pos] := picked;
          v_grid_ids[pos] := symbol_ids[picked];
        end if;
      end loop;

      v_frames := v_frames || jsonb_build_object('grid', to_jsonb(v_grid_ids), 'locked', symbol_ids[v_lock_symbol]);

      v_full_grid := true;
      for pos in 1..9 loop
        if v_grid_idx[pos] <> v_lock_symbol then
          v_full_grid := false;
          exit;
        end if;
      end loop;

      exit when v_full_grid or not v_new_landed or v_respin_count >= v_max_respins;
    end loop;
  end if;

  -- ── Avalia as 3 linhas horizontais na grade FINAL (já pós-respins, se houve) ──
  for row_i in 1..3 loop
    s1 := v_grid_idx[row_i];
    s2 := v_grid_idx[3 + row_i];
    s3 := v_grid_idx[6 + row_i];

    if s1 = s2 and s2 = s3 then
      v_payout := v_payout + round(bet_amount * symbol_payout_mult[s1]);
      v_winning_ids := array_append(v_winning_ids, symbol_ids[s1]);
      v_winning_rows := array_append(v_winning_rows, row_i);
    end if;
  end loop;

  if v_feature_triggered and v_full_grid then
    v_payout := round(v_payout * v_full_grid_bonus);
  end if;

  if v_payout > 0 then
    update public.profiles set credits = credits + v_payout where id = v_user_id;
  end if;

  select credits into v_new_balance from public.profiles where id = v_user_id;

  insert into public.spin_history (user_id, bet_amount, payout, symbols)
  values (v_user_id, bet_amount, v_payout, to_jsonb(v_grid_ids));

  return json_build_object(
    'grid', v_grid_ids,
    'payout', v_payout,
    'new_balance', v_new_balance,
    'winning_symbols', v_winning_ids,
    'winning_rows', v_winning_rows,
    'feature', case when v_feature_triggered then
      jsonb_build_object(
        'frames', v_frames,
        'full_grid', v_full_grid,
        'bonus_multiplier', case when v_full_grid then v_full_grid_bonus else null end
      )
    else null end
  );
end;
$$;

revoke all on function public.spin_slot(int) from public;
grant execute on function public.spin_slot(int) to authenticated;

-- =============================================================================
-- Como aplicar: Supabase -> SQL Editor -> New query -> cole este arquivo -> Run
-- =============================================================================
