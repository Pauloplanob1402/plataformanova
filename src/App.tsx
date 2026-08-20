import { useCallback, useEffect, useState } from 'react';
import { HUD } from './components/HUD';
import { SlotMachine } from './components/SlotMachine';
import { HoldWinGame } from './components/HoldWinGame';
import { DragonTigerGame } from './components/DragonTigerGame';
import { WinCelebration, type CelebrationData } from './components/WinCelebration';
import { AuthScreen } from './components/AuthScreen';
import { DailyCheckin } from './components/DailyCheckin';
import { RedeemCode } from './components/RedeemCode';
import { ReferralScreen } from './components/ReferralScreen';
import { VipStatus } from './components/VipStatus';
import { DepositScreen } from './components/DepositScreen';
import { WithdrawScreen } from './components/WithdrawScreen';
import { useProfile } from './core/useProfile';
import { useSessionStats } from './core/useSessionStats';
import { useBackgroundMusic } from './core/useBackgroundMusic';
import { useAuth } from './core/useAuth';
import './index.css';

// Vitórias acima desse valor disparam a celebração "grande" (mais moedas, banner maior).
const BIG_WIN_THRESHOLD = 200;

type Screen = 'jogo' | 'moedas' | 'dragaotigre' | 'deposito' | 'saque' | 'bonus' | 'codigo' | 'indicacao' | 'vip';

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'jogo', label: '🐯 Jogo' },
  { id: 'moedas', label: '🪙 Moedas' },
  { id: 'dragaotigre', label: '🐉 Dragão x Tigre' },
  { id: 'deposito', label: '💰 Depósito' },
  { id: 'saque', label: '🏦 Saque' },
  { id: 'bonus', label: '🎁 Bônus' },
  { id: 'codigo', label: '🎟️ Código' },
  { id: 'indicacao', label: '🤝 Indicação' },
  { id: 'vip', label: '👑 VIP' },
];

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { credits, kycDone, loading: profileLoading, error: profileError, setCreditsLocally, refetch } = useProfile(user);
  const { recordSpin, resetStats } = useSessionStats();
  useBackgroundMusic();
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
        onReset={handleReset}
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
        {screen === 'moedas' && (
          <HoldWinGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'dragaotigre' && (
          <DragonTigerGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'deposito' && <DepositScreen user={user} onDeposited={refetch} />}
        {screen === 'saque' && (
          <WithdrawScreen
            user={user}
            credits={credits ?? 0}
            kycDone={kycDone}
            onWithdrawn={setCreditsLocally}
          />
        )}
        {screen === 'bonus' && <DailyCheckin user={user} onBalanceChange={setCreditsLocally} />}
        {screen === 'codigo' && <RedeemCode onBalanceChange={setCreditsLocally} />}
        {screen === 'indicacao' && <ReferralScreen user={user} onBalanceChange={setCreditsLocally} />}
        {screen === 'vip' && <VipStatus user={user} />}
      </main>

      <WinCelebration data={celebration} />
    </div>
  );
}

export default App;
