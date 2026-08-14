import { useId, type JSX } from 'react';

/**
 * Ícones 100% originais, em SVG com gradientes e sombreamento, no estilo
 * esmalte cloisonné chinês (dourado + carmesim + contornos em tinta preta).
 * Nenhuma arte de terceiros é usada.
 */

function useGradientIds(names: string[]) {
  const uid = useId();
  return Object.fromEntries(names.map((n) => [n, `${n}-${uid}`])) as Record<string, string>;
}

export function LanternIcon() {
  const g = useGradientIds(['body', 'cap', 'glow']);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={g.glow} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="100%" stopColor="#F2C879" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g.body} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E23A50" />
          <stop offset="45%" stopColor="#B8172F" />
          <stop offset="100%" stopColor="#7A0F20" />
        </linearGradient>
        <linearGradient id={g.cap} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCE3A0" />
          <stop offset="100%" stopColor="#C4933A" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="52" r="40" fill={`url(#${g.glow})`} />

      <line x1="50" y1="4" x2="50" y2="14" stroke="#8a5a2b" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="50" cy="17" rx="13" ry="5" fill={`url(#${g.cap})`} stroke="#6b4520" strokeWidth="1" />

      <path d="M28 22 Q26 58 38 82 Q50 92 62 82 Q74 58 72 22 Z" fill={`url(#${g.body})`} stroke="#4a0812" strokeWidth="2" />
      <path d="M32 24 Q30 56 40 78" stroke="#F2C879" strokeWidth="1.5" opacity="0.35" fill="none" />

      <g stroke="#F2C879" strokeWidth="1.3" opacity="0.75">
        <path d="M29 33 Q50 38 71 33" fill="none" />
        <path d="M27 44 Q50 50 73 44" fill="none" />
        <path d="M27 55 Q50 61 73 55" fill="none" />
        <path d="M29 66 Q50 71 71 66" fill="none" />
      </g>

      <circle cx="50" cy="50" r="9" fill="#FCE3A0" opacity="0.9" />
      <text x="50" y="55" fontSize="12" textAnchor="middle" fill="#8a1020" fontWeight="700">福</text>

      <ellipse cx="50" cy="85" rx="11" ry="4" fill={`url(#${g.cap})`} stroke="#6b4520" strokeWidth="1" />
      <line x1="50" y1="89" x2="50" y2="95" stroke="#8a5a2b" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M46 95 L50 100 L54 95" fill="none" stroke="#D8A84E" strokeWidth="1.5" />
    </svg>
  );
}

export function IngotIcon() {
  const g = useGradientIds(['gold', 'shine', 'glow']);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={g.glow} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="100%" stopColor="#F2C879" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g.gold} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCE3A0" />
          <stop offset="35%" stopColor="#E7B24F" />
          <stop offset="100%" stopColor="#9A6A1E" />
        </linearGradient>
        <linearGradient id={g.shine} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="52" r="38" fill={`url(#${g.glow})`} />

      <path
        d="M16 62 Q16 40 32 38 H68 Q84 40 84 62 Q84 80 58 82 H42 Q16 80 16 62 Z"
        fill={`url(#${g.gold})`}
        stroke="#6b4a10" strokeWidth="2"
      />
      <ellipse cx="50" cy="58" rx="26" ry="14" fill="#7A5313" opacity="0.35" />
      <ellipse cx="50" cy="55" rx="24" ry="12" fill={`url(#${g.gold})`} stroke="#6b4a10" strokeWidth="1.5" />
      <path d="M14 60 Q50 74 86 60" stroke={`url(#${g.shine})`} strokeWidth="6" fill="none" opacity="0.8" />

      <path d="M38 50 Q50 42 62 50" stroke="#6b4a10" strokeWidth="1.5" fill="none" opacity="0.5" />
      <text x="50" y="63" fontSize="15" textAnchor="middle" fill="#6b4a10" fontWeight="700">福</text>
    </svg>
  );
}

export function CoinIcon() {
  const g = useGradientIds(['rim', 'face', 'glow']);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={g.glow} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="100%" stopColor="#F2C879" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g.rim} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#FCE3A0" />
          <stop offset="55%" stopColor="#E7B24F" />
          <stop offset="100%" stopColor="#8C5F17" />
        </radialGradient>
        <radialGradient id={g.face} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#B8172F" />
          <stop offset="100%" stopColor="#6E0E1E" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="52" r="38" fill={`url(#${g.glow})`} />

      <circle cx="50" cy="50" r="37" fill={`url(#${g.rim})`} stroke="#6b4a10" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="29" fill={`url(#${g.face})`} stroke="#4a0812" strokeWidth="1.5" />
      <g stroke="#F2C879" strokeWidth="1" opacity="0.5">
        <circle cx="50" cy="50" r="24" fill="none" />
      </g>

      <rect x="39" y="39" width="22" height="22" fill="#3a0810" stroke="#F2C879" strokeWidth="2" />
      <rect x="44.5" y="44.5" width="11" height="11" fill="#B8172F" />

      <path d="M28 30 A34 34 0 0 1 50 16" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.4" />
    </svg>
  );
}

export function FirecrackerIcon() {
  const g = useGradientIds(['red', 'gold']);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={g.gold} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="100%" stopColor="#F2C879" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g.red} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E23A50" />
          <stop offset="50%" stopColor="#B8172F" />
          <stop offset="100%" stopColor="#8A101F" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="42" fill={`url(#${g.gold})`} />

      <g transform="rotate(-10 50 50)">
        <line x1="34" y1="14" x2="34" y2="26" stroke="#8a5a2b" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="10" x2="50" y2="24" stroke="#8a5a2b" strokeWidth="2" strokeLinecap="round" />
        <line x1="66" y1="16" x2="66" y2="28" stroke="#8a5a2b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="34" cy="12" r="2.2" fill="#F2A65A" />
        <circle cx="50" cy="8" r="2.2" fill="#F2A65A" />
        <circle cx="66" cy="14" r="2.2" fill="#F2A65A" />

        <rect x="24" y="26" width="20" height="52" rx="4" fill={`url(#${g.red})`} stroke="#4a0812" strokeWidth="1.8" />
        <rect x="40" y="34" width="20" height="46" rx="4" fill={`url(#${g.red})`} stroke="#4a0812" strokeWidth="1.8" />
        <rect x="56" y="28" width="20" height="50" rx="4" fill={`url(#${g.red})`} stroke="#4a0812" strokeWidth="1.8" />

        {[26, 42, 58].map((x, i) => (
          <g key={i}>
            <rect x={x} y={30 + i * 4} width="16" height="3.5" fill="#F2C879" />
            <rect x={x} y={38 + i * 4} width="16" height="3.5" fill="#F2C879" opacity="0.85" />
            <rect x={x} y={46 + i * 4} width="16" height="3.5" fill="#F2C879" opacity="0.7" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function BellIcon() {
  const g = useGradientIds(['gold', 'glow']);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={g.glow} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="100%" stopColor="#F2C879" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g.gold} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCE3A0" />
          <stop offset="40%" stopColor="#E7B24F" />
          <stop offset="100%" stopColor="#8C5F17" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="52" r="40" fill={`url(#${g.glow})`} />

      <rect x="45" y="6" width="10" height="12" rx="2" fill="#8a5a2b" />
      <ellipse cx="50" cy="8" rx="7" ry="4" fill={`url(#${g.gold})`} />

      <path d="M24 68 Q22 26 50 24 Q78 26 76 68 Z" fill={`url(#${g.gold})`} stroke="#6b4a10" strokeWidth="2" />
      <path d="M30 62 Q28 30 50 28" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.4" fill="none" strokeLinecap="round" />
      <g stroke="#8C5F17" strokeWidth="1.3" opacity="0.6">
        <path d="M28 42 Q50 46 72 42" fill="none" />
        <path d="M26 54 Q50 59 74 54" fill="none" />
      </g>

      <ellipse cx="50" cy="68" rx="28" ry="7" fill={`url(#${g.gold})`} stroke="#6b4a10" strokeWidth="2" />
      <ellipse cx="50" cy="66" rx="22" ry="4.5" fill="#FCE3A0" opacity="0.6" />

      <circle cx="50" cy="86" r="7" fill={`url(#${g.gold})`} stroke="#6b4a10" strokeWidth="2" />
      <line x1="50" y1="75" x2="50" y2="80" stroke="#8C5F17" strokeWidth="2" />
    </svg>
  );
}

export function TigerIcon() {
  const g = useGradientIds(['fur', 'ear', 'glow']);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={g.glow} cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#FFE9B8" />
          <stop offset="100%" stopColor="#F2C879" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g.fur} cx="42%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FBC978" />
          <stop offset="55%" stopColor="#F2A65A" />
          <stop offset="100%" stopColor="#C97A2E" />
        </radialGradient>
        <linearGradient id={g.ear} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E23A50" />
          <stop offset="100%" stopColor="#8A101F" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="52" r="44" fill={`url(#${g.glow})`} />

      {/* orelhas */}
      <path d="M20 38 L10 10 L36 28 Z" fill={`url(#${g.fur})`} stroke="#3a1a10" strokeWidth="2" strokeLinejoin="round" />
      <path d="M80 38 L90 10 L64 28 Z" fill={`url(#${g.fur})`} stroke="#3a1a10" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 34 L16 16 L32 28 Z" fill={`url(#${g.ear})`} />
      <path d="M79 34 L84 16 L68 28 Z" fill={`url(#${g.ear})`} />

      {/* coroa/marca real na testa */}
      <path d="M42 20 L50 10 L58 20 L50 26 Z" fill="#D8A84E" stroke="#3a1a10" strokeWidth="1.5" strokeLinejoin="round" />
      <text x="50" y="23" fontSize="9" textAnchor="middle" fill="#3a1a10" fontWeight="700">王</text>

      {/* rosto */}
      <ellipse cx="50" cy="58" rx="36" ry="32" fill={`url(#${g.fur})`} stroke="#3a1a10" strokeWidth="2.2" />

      {/* listras */}
      <g stroke="#3a1a10" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85">
        <path d="M50 30 V44" />
        <path d="M34 34 L40 48" />
        <path d="M66 34 L60 48" />
        <path d="M22 52 L34 58" />
        <path d="M78 52 L66 58" />
        <path d="M26 72 L36 66" />
        <path d="M74 72 L64 66" />
      </g>

      {/* focinho branco */}
      <path d="M30 62 Q50 52 70 62 Q68 84 50 88 Q32 84 30 62 Z" fill="#FFF7E6" stroke="#3a1a10" strokeWidth="1.5" opacity="0.95" />

      {/* olhos */}
      <ellipse cx="37" cy="58" rx="7" ry="8.5" fill="#FFFFFF" stroke="#3a1a10" strokeWidth="1.3" />
      <ellipse cx="63" cy="58" rx="7" ry="8.5" fill="#FFFFFF" stroke="#3a1a10" strokeWidth="1.3" />
      <circle cx="38" cy="60" r="3.6" fill="#1a1108" />
      <circle cx="64" cy="60" r="3.6" fill="#1a1108" />
      <circle cx="36.5" cy="58.5" r="1" fill="#FFF7E6" />
      <circle cx="62.5" cy="58.5" r="1" fill="#FFF7E6" />

      {/* nariz e boca */}
      <path d="M44 70 Q50 66 56 70 Q54 74 50 74 Q46 74 44 70 Z" fill="#3a1a10" />
      <path d="M50 74 V78" stroke="#3a1a10" strokeWidth="2" />
      <path d="M50 78 Q42 84 34 80" stroke="#3a1a10" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M50 78 Q58 84 66 80" stroke="#3a1a10" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* bigodes */}
      <g stroke="#3a1a10" strokeWidth="1.3" opacity="0.7" strokeLinecap="round">
        <path d="M28 72 L14 70" />
        <path d="M28 76 L14 78" />
        <path d="M72 72 L86 70" />
        <path d="M72 76 L86 78" />
      </g>
    </svg>
  );
}

export const SYMBOL_ICONS: Record<string, () => JSX.Element> = {
  lantern: LanternIcon,
  ingot: IngotIcon,
  coin: CoinIcon,
  firecracker: FirecrackerIcon,
  bell: BellIcon,
  tiger: TigerIcon,
};
