import { useEffect, useRef, useState } from 'react';

const MUSIC_SRC = '/audio/golden-dragon-dance.mp3';
const MUSIC_VOLUME = 0.35;

/**
 * Toca a trilha sonora em loop contínuo enquanto o jogo estiver aberto.
 *
 * Navegadores bloqueiam áudio COM SOM antes de qualquer interação do usuário
 * (política de autoplay). Por isso: começa mutado e tocando (autoplay
 * silencioso é permitido), e assim que o usuário interage com a página pela
 * primeira vez (clique, toque ou tecla) — inclusive girando o slot — o som
 * é ativado automaticamente. O botão no HUD permite ligar/desligar manualmente.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audio.muted = true;
    audioRef.current = audio;

    audio.play().catch(() => {
      // autoplay bloqueado até mesmo mudo em alguns navegadores — sem problema,
      // vai iniciar na primeira interação do usuário via o listener abaixo.
    });

    const unlockOnFirstInteraction = () => {
      if (hasUnlockedRef.current) return;
      hasUnlockedRef.current = true;
      audio.muted = false;
      audio.play().catch(() => {});
      setMuted(false);
    };

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, unlockOnFirstInteraction, { once: true }));

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, unlockOnFirstInteraction));
      audio.pause();
      audio.src = '';
    };
  }, []);

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (muted) {
      audio.muted = false;
      audio.play().catch(() => {});
      hasUnlockedRef.current = true;
      setMuted(false);
    } else {
      audio.muted = true;
      setMuted(true);
    }
  };

  return { muted, toggleMute };
}
