import { useEffect, useRef } from 'react';

const MUSIC_SRC = '/audio/golden-dragon-dance.mp3';
const MUSIC_VOLUME = 0.35;

/**
 * Toca a trilha sonora em loop contínuo, sem botão de controle — o volume
 * fica a cargo do próprio aparelho do usuário (ele abaixa se não quiser).
 *
 * Navegadores bloqueiam áudio COM SOM antes de qualquer interação do usuário
 * (política de autoplay). Por isso: tenta tocar com som direto ao abrir a
 * página; se o navegador bloquear, começa mutado e destrava automaticamente
 * no primeiríssimo toque/clique/tecla do usuário em qualquer lugar da
 * página — não precisa ser um botão específico, nem o usuário perceber.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audioRef.current = audio;

    // tenta tocar já com som ligado assim que a página abre
    audio.play().then(() => {
      hasUnlockedRef.current = true;
    }).catch(() => {
      // bloqueado pelo navegador — vai destravar no primeiro toque abaixo
    });

    const unlockOnFirstInteraction = () => {
      if (hasUnlockedRef.current) return;
      hasUnlockedRef.current = true;
      audio.muted = false;
      audio.play().catch(() => {});
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, unlockOnFirstInteraction, { once: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, unlockOnFirstInteraction));
      audio.pause();
      audio.src = '';
    };
  }, []);
}
