import { useEffect, useState } from 'react';
import { supabase } from '../core/supabaseClient';

interface RankingRow {
  referral_code: string;
  net_winnings: number;
  rank: number;
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function RankingScreen() {
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc('get_weekly_ranking').then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setLoadError('Não foi possível carregar o ranking agora.');
      } else {
        setRows((data as RankingRow[]) ?? []);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="panel-card">
      <h2 className="panel-card__title">🏆 Ranking da Semana</h2>
      <p className="panel-card__subtitle">Top 20 em créditos ganhos nos últimos 7 dias.</p>

      {loadError && <p className="auth-feedback auth-feedback--error">{loadError}</p>}

      {rows === null && !loadError && <p className="panel-card__subtitle">Carregando...</p>}

      {rows !== null && rows.length === 0 && (
        <p className="panel-card__subtitle">Ninguém no ranking ainda essa semana — seja o primeiro!</p>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="ranking-list">
          {rows.map((r) => (
            <div key={r.referral_code} className={`ranking-row ${r.rank <= 3 ? 'ranking-row--top' : ''}`}>
              <span className="ranking-row__rank">{MEDALS[r.rank] ?? `#${r.rank}`}</span>
              <span className="ranking-row__name">{r.referral_code}</span>
              <span className="ranking-row__value">+{r.net_winnings}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
