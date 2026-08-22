import { useCallback, useEffect, useState } from 'react';
import { HUD } from './components/HUD';
import { SlotMachine } from './components/SlotMachine';
import { HoldWinGame } from './components/HoldWinGame';
import { DragonTigerGame } from './components/DragonTigerGame';
import { CoinFlipGame } from './components/CoinFlipGame';
import { LuckyNumberGame } from './components/LuckyNumberGame';
import { WheelGame } from './components/WheelGame';
import { DiceGame } from './components/DiceGame';
import { ChestGame } from './components/ChestGame';
import { ScratchGame } from './components/ScratchGame';
import { KenoGame } from './components/KenoGame';
import { FishingGame } from './components/FishingGame';
import { PlinkoGame } from './components/PlinkoGame';
import { DuelGame } from './components/DuelGame';
import { BingoGame } from './components/BingoGame';
import { RaceGame } from './components/RaceGame';
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

type Screen =
  | 'jogo'
  | 'moedas'
  | 'dragaotigre'
  | 'raspadinha'
  | 'roda'
  | 'bau'
  | 'dados'
  | 'moeda'
  | 'numero'
  | 'keno'
  | 'pesca'
  | 'plinko'
  | 'duelo'
  | 'bingo'
  | 'turfe'
  | 'deposito'
  | 'saque'
  | 'bonus'
  | 'codigo'
  | 'indicacao'
  | 'vip';

type Section = 'jogos' | 'carteira' | 'conta';

const SECTION_TABS: { id: Section; label: string }[] = [
  { id: 'jogos', label: '🎮 Jogos' },
  { id: 'carteira', label: '💰 Carteira' },
  { id: 'conta', label: '🎁 Conta' },
];

const GAME_SCREENS: { id: Screen; label: string }[] = [
  { id: 'jogo', label: '🐯 Tigrinho' },
  { id: 'moedas', label: '🪙 Moedas' },
  { id: 'dragaotigre', label: '🐉 Dragão x Tigre' },
  { id: 'raspadinha', label: '🧾 Raspadinha' },
  { id: 'roda', label: '🎡 Roda' },
  { id: 'bau', label: '🧧 Baú' },
  { id: 'dados', label: '🎲 Dados' },
  { id: 'moeda', label: '🪙 Moeda' },
  { id: 'numero', label: '🏮 Número' },
  { id: 'keno', label: '🎋 Keno' },
  { id: 'pesca', label: '🎣 Pesca' },
  { id: 'plinko', label: '🏮 Plinko' },
  { id: 'duelo', label: '⚔️ Duelo' },
  { id: 'bingo', label: '🎴 Bingo' },
  { id: 'turfe', label: '🏁 Turfe' },
];

const WALLET_SCREENS: { id: Screen; label: string }[] = [
  { id: 'deposito', label: '💰 Depósito' },
  { id: 'saque', label: '🏦 Saque' },
];

const ACCOUNT_SCREENS: { id: Screen; label: string }[] = [
  { id: 'bonus', label: '🎁 Bônus diário' },
  { id: 'codigo', label: '🎟️ Código' },
  { id: 'indicacao', label: '🤝 Indicação' },
  { id: 'vip', label: '👑 VIP' },
];

const SCREEN_SECTION: Record<Screen, Section> = {
  jogo: 'jogos', moedas: 'jogos', dragaotigre: 'jogos', raspadinha: 'jogos', roda: 'jogos',
  bau: 'jogos', dados: 'jogos', moeda: 'jogos', numero: 'jogos', keno: 'jogos', pesca: 'jogos',
  plinko: 'jogos', duelo: 'jogos', bingo: 'jogos', turfe: 'jogos',
  deposito: 'carteira', saque: 'carteira',
  bonus: 'conta', codigo: 'conta', indicacao: 'conta', vip: 'conta',
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { credits, kycDone, loading: profileLoading, error: profileError, setCreditsLocally, refetch } = useProfile(user);
  const { recordSpin, resetStats } = useSessionStats();
  useBackgroundMusic();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [screen, setScreen] = useState<Screen>('jogo');
  const section = SCREEN_SECTION[screen];

  const goToSection = useCallback((s: Section) => {
    if (s === 'jogos') setScreen('jogo');
    else if (s === 'carteira') setScreen('deposito');
    else setScreen('bonus');
  }, []);

  const currentSectionScreens =
    section === 'jogos' ? GAME_SCREENS : section === 'carteira' ? WALLET_SCREENS : ACCOUNT_SCREENS;

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

      {profileError && <p className="footer footer--error"> {profileError}</p>}

      {credits === 0 && (
        <div className="low-balance-banner">
          <span className="low-balance-banner__text">Seu saldo está zerado — pegue seu bônus diário grátis ou deposite pra jogar.</span>
          <div className="low-balance-banner__actions">
            <button type="button" className="low-balance-banner__btn" onClick={() => setScreen('bonus')}>
              🎁 Bônus grátis
            </button>
            <button type="button" className="low-balance-banner__btn low-balance-banner__btn--primary" onClick={() => setScreen('deposito')}>
              💰 Depositar
            </button>
          </div>
        </div>
      )}

      <nav className="section-tabs" role="tablist" aria-label="Seções">
        {SECTION_TABS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            className={`section-tab ${section === s.id ? 'section-tab--active' : ''}`}
            onClick={() => goToSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === 'jogos' ? (
        <nav className="game-lobby-grid" role="tablist" aria-label="Jogos">
          {currentSectionScreens.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={screen === s.id}
              className={`game-lobby-card ${screen === s.id ? 'game-lobby-card--active' : ''}`}
              onClick={() => setScreen(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      ) : (
        <nav className="nav-tabs" role="tablist" aria-label={section === 'carteira' ? 'Carteira' : 'Conta'}>
          {currentSectionScreens.map((s) => (
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
      )}

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
        {screen === 'raspadinha' && (
          <ScratchGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'roda' && (
          <WheelGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'bau' && (
          <ChestGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'dados' && (
          <DiceGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'moeda' && (
          <CoinFlipGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'numero' && (
          <LuckyNumberGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'keno' && (
          <KenoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'pesca' && (
          <FishingGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'plinko' && (
          <PlinkoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'duelo' && (
          <DuelGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'bingo' && (
          <BingoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
        )}
        {screen === 'turfe' && (
          <RaceGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} />
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
