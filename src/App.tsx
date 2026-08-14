import { useCallback, useEffect, useState } from 'react';
import { HUD } from './components/HUD';
import { SlotMachine } from './components/SlotMachine';
import { WinCelebration, type CelebrationData } from './components/WinCelebration';
import { AuthScreen } from './components/AuthScreen';
import { DailyCheckin } from './components/DailyCheckin';
import { RedeemCode } from './components/RedeemCode';
import { ReferralScreen } from './components/ReferralScreen';
import { useProfile } from './core/useProfile';
import { useSessionStats } from './core/useSessionStats';
import { useBackgroundMusic } from './core/useBackgroundMusic';
import { useAuth } from './core/useAuth';
import './index.css';

// Vitórias acima desse valor disparam a celebração "grande" (mais moedas, banner maior).
const BIG_WIN_THRESHOLD = 200;

type Screen = 'jogo' | 'bonus' | 'codigo' | 'indicacao';

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'jogo', label: '🐯 Jogo' },
  { id: 'bonus', label: '🎁 Bônus diário' },
  { id: 'codigo', label: '🎟️ Código' },
  { id: 'indicacao', label: '🤝 Indicação' },
];

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { credits, loading: profileLoading, error: profileError, setCreditsLocally, refetch } = useProfile(user);
  const { sessionRtp, recordSpin, resetStats } = useSessionStats();
  const { muted, toggleMute } = useBackgroundMusic();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [screen, setScreen] = useState<Screen>('jogo');

  const triggerCelebration = useCallback((amount: number) => {
    setCelebration({ key: Date.now(), amount, big: amount >= BIG_WIN_THRESHOLD });
  }, []);

  const handleReset = useCallback(() => {
    resetStats();
    refetch();
  }, [resetStats, refetch]);

  useEffect(() => {
    if (!celebration) return;
    const duration = celebration.big ? 3300 : 2700;
    const timeout = window.setTimeout(() => setCelebration(null), duration);
    return () => window.clearTimeout(timeout);
  }, [celebration]);

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="app">
        <p className="footer">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <AuthScreen />
      </div>
    );
  }

  return (
    <div className="app">
      <HUD
        credits={credits ?? 0}
        sessionRtp={sessionRtp}
        onReset={handleReset}
        muted={muted}
        onToggleMute={toggleMute}
        onSignOut={signOut}
      />

      {profileError && <p className="footer footer--error">{profileError}</p>}

      <nav className="nav-tabs" role="tablist" aria-label="Navegação">
        {SCREENS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={screen === s.id}
            className={`tab ${screen === s.id ? 'tab--active' : ''}`}
            onClick={() => setScreen(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {screen === 'jogo' && (
          <SlotMachine
            credits={credits ?? 0}
            onBalanceChange={setCreditsLocally}
            onSpinResolved={recordSpin}
            onWin={triggerCelebration}
          />
        )}
        {screen === 'bonus' && <DailyCheckin user={user} onBalanceChange={setCreditsLocally} />}
        {screen === 'codigo' && <RedeemCode onBalanceChange={setCreditsLocally} />}
        {screen === 'indicacao' && <ReferralScreen user={user} onBalanceChange={setCreditsLocally} />}
      </main>

      <footer className="footer">
        Simulador educativo sem apostas reais. Nenhum valor monetário é processado.
      </footer>

      <WinCelebration data={celebration} />
    </div>
  );
}

export default App;
