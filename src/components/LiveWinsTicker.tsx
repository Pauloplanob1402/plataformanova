import { useEffect, useState } from 'react';
import { supabase } from '../core/supabaseClient';

interface WinRow {
  referral_code: string;
  game: string;
  payout: number;
  created_at: string;
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

export function LiveWinsTicker() {
  const [wins, setWins] = useState<WinRow[]>([]);
  const [index, setIndex] = useState(0);

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

  useEffect(() => {
    if (wins.length === 0) return;
    const rotate = window.setInterval(() => {
      setIndex((i) => (i + 1) % wins.length);
    }, ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, [wins.length]);

  if (wins.length === 0) {
    return (
      <div className="live-ticker">
        <span className="live-ticker__dot" />
        Seja o primeiro a ganhar hoje! 🐯
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
