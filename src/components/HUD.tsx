import mascoteTigre from '../assets/mascote-tigre.webp';

interface HUDProps {
  credits: number;
  sessionRtp: number;
  onReset: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onSignOut?: () => void;
}

export function HUD({ credits, sessionRtp, onReset, muted, onToggleMute, onSignOut }: HUDProps) {
  return (
    <header className="hud">
      <div className="hud__brand">
        <img src={mascoteTigre} alt="Mascote Tigrinho" className="hud__mascot" />
        <div>
          <h1 className="hud__title">Tigrinho da Sorte</h1>
          <span className="hud__subtitle">simulador demonstrativo · sem dinheiro real</span>
        </div>
      </div>
      <div className="hud__stats">
        <div className="hud__pill">
          <span className="hud__pill-label">Créditos</span>
          <span className="hud__pill-value">{credits}</span>
        </div>
        <div className="hud__pill">
          <span className="hud__pill-label">RTP sessão</span>
          <span className="hud__pill-value">{(sessionRtp * 100).toFixed(1)}%</span>
        </div>
        <button
          className="hud__icon-btn"
          onClick={onToggleMute}
          aria-label={muted ? 'Ativar som' : 'Desativar som'}
          title={muted ? 'Ativar som' : 'Desativar som'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="hud__reset" onClick={onReset}>
          Recarregar
        </button>
        {onSignOut && (
          <button className="hud__icon-btn" onClick={onSignOut} aria-label="Sair" title="Sair">
            🚪
          </button>
        )}
      </div>
    </header>
  );
}
