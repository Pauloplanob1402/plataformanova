import mascoteTigre from '../assets/mascote-tigre.webp';

interface HUDProps {
  credits: number;
  onReset: () => void;
  onSignOut?: () => void;
}

export function HUD({ credits, onReset, onSignOut }: HUDProps) {
  return (
    <header className="hud">
      <div className="hud__brand">
        <img src={mascoteTigre} alt="Mascote Tigrinho" className="hud__mascot" />
        <div>
          <h1 className="hud__title">Tigrinho da Sorte</h1>
        </div>
      </div>
      <div className="hud__stats">
        <div className="hud__pill">
          <span className="hud__pill-label">Créditos</span>
          <span className="hud__pill-value">{credits}</span>
        </div>
        <button className="hud__icon-btn" onClick={onReset} aria-label="Sincronizar saldo" title="Sincroniza o saldo com o servidor">
          🔄
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
