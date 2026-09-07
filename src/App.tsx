import { Suspense, useCallback, useEffect, useState } from 'react';
import { lazyWithRetry } from './core/lazyWithRetry';
import { HUD } from './components/HUD';
import thumbMoedas from './assets/thumb-moedas-sm.webp';
import thumbDragaoTigre from './assets/thumb-dragaotigre-sm.webp';
import thumbRaspadinha from './assets/thumb-raspadinha-sm.webp';
import thumbBau from './assets/thumb-bau-sm.webp';
import thumbDados from './assets/thumb-dados-sm.webp';
import thumbMoeda from './assets/thumb-moeda-sm.webp';
import thumbNumero from './assets/thumb-numero-sm.webp';
import thumbKeno from './assets/thumb-keno-sm.webp';
import thumbPesca from './assets/thumb-pesca-sm.webp';
import thumbPlinko from './assets/thumb-plinko-sm.webp';
import thumbDuelo from './assets/thumb-duelo-sm.webp';
import thumbBingo from './assets/thumb-bingo-sm.webp';
import thumbTurfe from './assets/thumb-turfe-sm.webp';
import thumbMina from './assets/thumb-mina-sm.webp';
import thumbTorre from './assets/thumb-torre-sm.webp';
import thumbSobeDesce from './assets/thumb-sobedesce-sm.webp';
import thumbBatalha from './assets/thumb-batalha-sm.webp';
import thumbRoda from './assets/thumb-roda-sm.webp';
import thumbRoleta from './assets/thumb-roleta-sm.webp';
import bannerBatalha from './assets/banner-batalha.webp';
import bannerSobeDesce from './assets/banner-sobedesce.webp';
import bannerMina from './assets/banner-mina.webp';
import bannerTorre from './assets/banner-torre.webp';
import bannerTorreMini from './assets/banner-torremini.webp';
import bannerTurfe from './assets/banner-turfe.webp';
import bannerDuelo from './assets/banner-duelo.webp';
import bannerPlinko from './assets/banner-plinko.webp';
import bannerPesca from './assets/banner-pesca.webp';
import bannerKeno from './assets/banner-keno.webp';
import bannerNumero from './assets/banner-numero.webp';
import bannerMoeda from './assets/banner-moeda.webp';
import bannerDados from './assets/banner-dados.webp';
import bannerBau from './assets/banner-bau.webp';
import bannerRaspadinha from './assets/banner-raspadinha.webp';
import bannerDragaoTigre from './assets/banner-dragaotigre.webp';
import bannerMoedas from './assets/banner-moedas.webp';
import bannerTigrinho from './assets/banner-tigrinho.webp';
import bannerRoda from './assets/banner-roda.webp';
import bannerRoleta from './assets/banner-roleta.webp';
import bannerBingo from './assets/banner-bingo.webp';
import mascoteTigre from './assets/mascote-tigre.webp';

// Cada jogo só baixa o próprio código quando o jogador realmente abre ele —
// em vez de carregar os 19 juntos na página inicial (que era o gargalo de
// carregamento no celular).
const SlotMachine = lazyWithRetry(() => import('./components/SlotMachine').then((m) => ({ default: m.SlotMachine })));
const HoldWinGame = lazyWithRetry(() => import('./components/HoldWinGame').then((m) => ({ default: m.HoldWinGame })));
const DragonTigerGame = lazyWithRetry(() => import('./components/DragonTigerGame').then((m) => ({ default: m.DragonTigerGame })));
const CoinFlipGame = lazyWithRetry(() => import('./components/CoinFlipGame').then((m) => ({ default: m.CoinFlipGame })));
const LuckyNumberGame = lazyWithRetry(() => import('./components/LuckyNumberGame').then((m) => ({ default: m.LuckyNumberGame })));
const WheelGame = lazyWithRetry(() => import('./components/WheelGame').then((m) => ({ default: m.WheelGame })));
const DiceGame = lazyWithRetry(() => import('./components/DiceGame').then((m) => ({ default: m.DiceGame })));
const ChestGame = lazyWithRetry(() => import('./components/ChestGame').then((m) => ({ default: m.ChestGame })));
const ScratchGame = lazyWithRetry(() => import('./components/ScratchGame').then((m) => ({ default: m.ScratchGame })));
const KenoGame = lazyWithRetry(() => import('./components/KenoGame').then((m) => ({ default: m.KenoGame })));
const FishingGame = lazyWithRetry(() => import('./components/FishingGame').then((m) => ({ default: m.FishingGame })));
const PlinkoGame = lazyWithRetry(() => import('./components/PlinkoGame').then((m) => ({ default: m.PlinkoGame })));
const DuelGame = lazyWithRetry(() => import('./components/DuelGame').then((m) => ({ default: m.DuelGame })));
const BingoGame = lazyWithRetry(() => import('./components/BingoGame').then((m) => ({ default: m.BingoGame })));
const RaceGame = lazyWithRetry(() => import('./components/RaceGame').then((m) => ({ default: m.RaceGame })));
const MinesGame = lazyWithRetry(() => import('./components/MinesGame').then((m) => ({ default: m.MinesGame })));
const TowerGame = lazyWithRetry(() => import('./components/TowerGame').then((m) => ({ default: m.TowerGame })));
const HiLoGame = lazyWithRetry(() => import('./components/HiLoGame').then((m) => ({ default: m.HiLoGame })));
const RouletteGame = lazyWithRetry(() => import('./components/RouletteGame').then((m) => ({ default: m.RouletteGame })));
const BaccaratGame = lazyWithRetry(() => import('./components/BaccaratGame').then((m) => ({ default: m.BaccaratGame })));
import { LiveWinsTicker } from './components/LiveWinsTicker';
const RankingScreen = lazyWithRetry(() => import('./components/RankingScreen').then((m) => ({ default: m.RankingScreen })));
import { WinCelebration, type CelebrationData } from './components/WinCelebration';
import { AuthScreen } from './components/AuthScreen';
const DailyCheckin = lazyWithRetry(() => import('./components/DailyCheckin').then((m) => ({ default: m.DailyCheckin })));
const RedeemCode = lazyWithRetry(() => import('./components/RedeemCode').then((m) => ({ default: m.RedeemCode })));
const ReferralScreen = lazyWithRetry(() => import('./components/ReferralScreen').then((m) => ({ default: m.ReferralScreen })));
const VipStatus = lazyWithRetry(() => import('./components/VipStatus').then((m) => ({ default: m.VipStatus })));
const DepositScreen = lazyWithRetry(() => import('./components/DepositScreen').then((m) => ({ default: m.DepositScreen })));
const WithdrawScreen = lazyWithRetry(() => import('./components/WithdrawScreen').then((m) => ({ default: m.WithdrawScreen })));
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
  | 'mina'
  | 'torre'
  | 'torremini'
  | 'sobedesce'
  | 'roleta'
  | 'batalha'
  | 'ranking'
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

const GAME_SCREENS: { id: Screen; label: string; thumb?: string; banner?: string }[] = [
  { id: 'jogo', label: 'Tigrinho', banner: bannerTigrinho },
  { id: 'moedas', label: 'Moedas', thumb: thumbMoedas, banner: bannerMoedas },
  { id: 'dragaotigre', label: 'Dragão x Tigre', thumb: thumbDragaoTigre, banner: bannerDragaoTigre },
  { id: 'raspadinha', label: 'Raspadinha', thumb: thumbRaspadinha, banner: bannerRaspadinha },
  { id: 'roda', label: 'Roda', thumb: thumbRoda, banner: bannerRoda },
  { id: 'bau', label: 'Baú', thumb: thumbBau, banner: bannerBau },
  { id: 'dados', label: 'Dados', thumb: thumbDados, banner: bannerDados },
  { id: 'moeda', label: 'Moeda', thumb: thumbMoeda, banner: bannerMoeda },
  { id: 'numero', label: 'Número', thumb: thumbNumero, banner: bannerNumero },
  { id: 'keno', label: 'Keno', thumb: thumbKeno, banner: bannerKeno },
  { id: 'pesca', label: 'Pesca', thumb: thumbPesca, banner: bannerPesca },
  { id: 'plinko', label: 'Plinko', thumb: thumbPlinko, banner: bannerPlinko },
  { id: 'duelo', label: 'Duelo', thumb: thumbDuelo, banner: bannerDuelo },
  { id: 'bingo', label: 'Bingo', thumb: thumbBingo, banner: bannerBingo },
  { id: 'turfe', label: 'Turfe', thumb: thumbTurfe, banner: bannerTurfe },
  { id: 'mina', label: 'Mina', thumb: thumbMina, banner: bannerMina },
  { id: 'torre', label: 'Torre', thumb: thumbTorre, banner: bannerTorre },
  { id: 'torremini', label: 'Torre Mini', thumb: thumbTorre, banner: bannerTorreMini },
  { id: 'sobedesce', label: 'Sobe-Desce', thumb: thumbSobeDesce, banner: bannerSobeDesce },
  { id: 'roleta', label: 'Roleta', thumb: thumbRoleta, banner: bannerRoleta },
  { id: 'batalha', label: 'Batalha', thumb: thumbBatalha, banner: bannerBatalha },
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
  { id: 'ranking', label: '🏆 Ranking' },
];

const SCREEN_SECTION: Record<Screen, Section> = {
  jogo: 'jogos', moedas: 'jogos', dragaotigre: 'jogos', raspadinha: 'jogos', roda: 'jogos',
  bau: 'jogos', dados: 'jogos', moeda: 'jogos', numero: 'jogos', keno: 'jogos', pesca: 'jogos',
  plinko: 'jogos', duelo: 'jogos', bingo: 'jogos', turfe: 'jogos',
  deposito: 'carteira', saque: 'carteira',
  bonus: 'conta', codigo: 'conta', indicacao: 'conta', vip: 'conta', ranking: 'conta',
  mina: 'jogos', torre: 'jogos', torremini: 'jogos', sobedesce: 'jogos',
  roleta: 'jogos', batalha: 'jogos',
};

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { credits, kycDone, loading: profileLoading, error: profileError, setCreditsLocally, refetch } = useProfile(user);
  const { recordSpin, resetStats } = useSessionStats();
  const { musicEnabled } = useBackgroundMusic();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [screen, setScreen] = useState<Screen>('jogo');
  const [gameOpen, setGameOpen] = useState(false);
  const section = SCREEN_SECTION[screen];

  const goToSection = useCallback((s: Section) => {
    setGameOpen(false);
    if (s === 'jogos') setScreen('jogo');
    else if (s === 'carteira') setScreen('deposito');
    else setScreen('bonus');
  }, []);

  const openGame = useCallback((id: Screen) => {
    setScreen(id);
    setGameOpen(true);
  }, []);

  // Leva o jogador direto pra tela de depósito quando ele tenta jogar sem
  // saldo suficiente — antes disso os jogos simplesmente ignoravam o clique
  // em silêncio, o que parecia um travamento.
  const requestDeposit = useCallback(() => {
    setScreen('deposito');
    setGameOpen(false);
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

      {!musicEnabled && (
        <div className="music-enable-banner" role="status">
          🔊 Toque em qualquer lugar da tela pra ativar o som
        </div>
      )}

      <LiveWinsTicker user={user} onClaimBonus={() => setScreen('bonus')} />

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

      {section === 'jogos' && !gameOpen ? (
        <nav className="game-lobby-list" role="tablist" aria-label="Jogos">
          {GAME_SCREENS.map((s) =>
            s.banner ? (
              <button
                key={s.id}
                type="button"
                role="tab"
                className="game-banner game-banner--wide"
                onClick={() => openGame(s.id)}
              >
                <img src={s.banner} alt="" className="game-banner__art" loading="lazy" decoding="async" />
                <span className="game-banner__overlay">
                  <span className="game-banner__label">{s.label}</span>
                  <span className="game-banner__play">Jogar ▶</span>
                </span>
              </button>
            ) : (
              <button
                key={s.id}
                type="button"
                role="tab"
                className="game-banner"
                onClick={() => openGame(s.id)}
              >
                <img src={s.thumb ?? mascoteTigre} alt="" className="game-banner__thumb" loading="lazy" decoding="async" />
                <span className="game-banner__label">{s.label}</span>
                <span className="game-banner__play">Jogar ▶</span>
              </button>
            ),
          )}
        </nav>
      ) : section === 'jogos' && gameOpen ? (
        <button type="button" className="game-back-btn" onClick={() => setGameOpen(false)}>
          ← Voltar aos jogos
        </button>
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

      <Suspense fallback={<div className="game-loading"><img src={mascoteTigre} alt="" className="game-loading__mascot" /><span>Carregando...</span></div>}>
      {(section !== 'jogos' || gameOpen) && (
      <main className="main">
        {screen === 'jogo' && (
          <SlotMachine
            credits={credits ?? 0}
            onBalanceChange={setCreditsLocally}
            onSpinResolved={recordSpin}
            onWin={triggerCelebration} onRequestDeposit={requestDeposit}
          />
        )}
        {screen === 'moedas' && (
          <HoldWinGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'dragaotigre' && (
          <DragonTigerGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'raspadinha' && (
          <ScratchGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'roda' && (
          <WheelGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'bau' && (
          <ChestGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'dados' && (
          <DiceGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'moeda' && (
          <CoinFlipGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'numero' && (
          <LuckyNumberGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'keno' && (
          <KenoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'pesca' && (
          <FishingGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'plinko' && (
          <PlinkoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'duelo' && (
          <DuelGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'bingo' && (
          <BingoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'turfe' && (
          <RaceGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'mina' && (
          <MinesGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'torre' && (
          <TowerGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'torremini' && (
          <TowerGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} mini />
        )}
        {screen === 'sobedesce' && (
          <HiLoGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'roleta' && (
          <RouletteGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
        )}
        {screen === 'batalha' && (
          <BaccaratGame credits={credits ?? 0} onBalanceChange={setCreditsLocally} onWin={triggerCelebration} onRequestDeposit={requestDeposit} />
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
        {screen === 'ranking' && <RankingScreen />}
      </main>
      )}
      </Suspense>

      <WinCelebration data={celebration} />
    </div>
  );
}

export default App;
