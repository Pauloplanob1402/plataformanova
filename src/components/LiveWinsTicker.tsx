import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../core/supabaseClient';

interface WinRow {
  referral_code: string;
  game: string;
  payout: number;
  created_at: string;
}

interface LiveWinsTickerProps {
  /** Usado só pra saber se o bônus diário já foi resgatado — decide o que
   *  mostrar quando ainda não existe nenhum ganho real registrado. */
  user?: User | null;
  onClaimBonus?: () => void;
}

const GAME_LABELS: Record<string, string> = {
  tigrinho: 'Tigrinho da Sorte',
  moedas: 'Moedas do Tigre',
  dragaotigre: 'Dragão x Tigre',
  scratch: 'Raspadinha',
  wheel: 'Roda da Sorte',
  chest: 'Baú do Tigre',
  dice: 'Dados',
  coin: 'Moeda',
  lucky_number: 'Número da Sorte',
  keno: 'Keno',
  fishing: 'Pesca',
  plinko: 'Plinko',
  duel: 'Duelo',
  bingo: 'Bingo',
  race: 'Turfe',
  mines: 'Mina do Tigre',
  tower: 'Torre do Tigre',
  tower_mini: 'Torre Mini',
  hilo: 'Sobe-Desce',
  roulette: 'Roleta',
  batalha: 'Batalha do Tigre',
};

const REFRESH_MS = 30_000;
const ROTATE_MS = 4_500;

export function LiveWinsTicker({ user, onClaimBonus }: LiveWinsTickerProps) {
  const [wins, setWins] = useState<WinRow[]>([]);
  const [index, setIndex] = useState(0);
  const [bonusAvailable, setBonusAvailable] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data } = await supabase.rpc('get_recent_big_wins', { limit_count: 15 });
      if (active && data) setWins(data as WinRow[]);
    };

    load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Só usado no fallback (quando ainda não existe nenhum ganho real pra
  // mostrar) — confere se o bônus diário de hoje já foi resgatado, pra
  // oferecer uma recompensa de verdade em vez de um texto genérico tipo
  // "seja o primeiro a ganhar hoje", que soa como se ninguém nunca ganhasse.
  useEffect(() => {
    if (!user) return;
    let active = true;
    const todayUtc = new Date().toISOString().slice(0, 10);
    supabase
      .from('daily_checkins')
      .select('checkin_date')
      .eq('user_id', user.id)
      .order('checkin_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setBonusAvailable(data?.checkin_date !== todayUtc);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (wins.length === 0) return;
    const rotate = window.setInterval(() => {
      setIndex((i) => (i + 1) % wins.length);
    }, ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, [wins.length]);

  if (wins.length === 0) {
    if (bonusAvailable) {
      return (
        <button type="button" className="live-ticker live-ticker--bonus" onClick={onClaimBonus}>
          <span className="live-ticker__dot" />
          🎁 Seu bônus diário está liberado — toque pra resgatar
        </button>
      );
    }
    return (
      <div className="live-ticker">
        <span className="live-ticker__dot" />
        🎮 Escolha um jogo abaixo e comece a girar
      </div>
    );
  }

  const current = wins[index % wins.length];
  const gameLabel = GAME_LABELS[current.game] ?? current.game;

  return (
    <div className="live-ticker" key={index}>
      <span className="live-ticker__dot" />
      Jogador {current.referral_code} ganhou {current.payout} créditos no {gameLabel}!
    </div>
  );
}
