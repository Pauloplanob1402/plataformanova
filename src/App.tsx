import { useCallback, useEffect, useState } from 'react';
import { HUD } from './components/HUD';
import { SlotMachine } from './components/SlotMachine';
import { WinCelebration, type CelebrationData } from './components/WinCelebration';
import { AuthScreen } from './components/AuthScreen';
import { useGameManager } from './core/useGameManager';
import { useBackgroundMusic } from './core/useBackgroundMusic';
import { useAuth } from './core/useAuth';
import './index.css';

// Vitórias acima desse valor disparam a celebração "grande" (mais moedas, banner maior).
const BIG_WIN_THRESHOLD = 200;

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { credits, sessionRtp, placeBet, addWinnings, resetCredits, rng } = useGameManager();
  const { muted, toggleMute } = useBackgroundMusic();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const triggerCelebration = useCallback((amount: number) => {
    setCelebration({ key: Date.now(), amount, big: amount >= BIG_WIN_THRESHOLD });
  }, []);

  useEffect(() => {
    if (!celebration) return;
    const duration = celebration.big ? 3300 : 2700;
    const timeout = window.setTimeout(() => setCelebration(null), duration);
    return () => window.clearTimeout(timeout);
  }, [celebration]);

  if (authLoading) {
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
        credits={credits}
        sessionRtp={sessionRtp}
        onReset={resetCredits}
        muted={muted}
        onToggleMute={toggleMute}
        onSignOut={signOut}
      />

      <main className="main">
        <SlotMachine
          credits={credits}
          placeBet={placeBet}
          addWinnings={addWinnings}
          rng={rng}
          onWin={triggerCelebration}
        />
      </main>

      <footer className="footer">
        Simulador educativo sem apostas reais. Nenhum valor monetário é processado.
      </footer>

      <WinCelebration data={celebration} />
    </div>
  );
}

export default App;
