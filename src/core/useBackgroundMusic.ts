import { useEffect, useRef } from 'react';

const MUSIC_SRC = '/audio/golden-dragon-dance.mp3';
const MUSIC_VOLUME = 0.35;

/**
 * Toca a trilha sonora em loop contínuo, sem botão de controle — o volume
 * fica a cargo do próprio aparelho do usuário (ele abaixa se não quiser).
 *
 * Navegadores bloqueiam áudio COM SOM antes de qualquer interação do usuário
 * (política de autoplay). Por isso: tenta tocar com som direto ao abrir a
 * página; se o navegador bloquear, destrava no primeiro toque/clique/tecla.
 *
 * IMPORTANTE (bug corrigido — só acontecia no celular): a tentativa de
 * autoplay no carregamento cria uma Promise que no mobile demora mais pra
 * resolver do que no desktop. Se o primeiro toque do usuário acontecer
 * ANTES dessa Promise terminar, chamar .play() de novo no MESMO elemento
 * conta como "interrompido" pro navegador — e isso não é reconhecido como
 * gesto válido do usuário pela política de autoplay mobile, então trava
 * mudo pra sempre (o desktop quase nunca sofre disso porque a resposta é
 * praticamente instantânea). A correção: no primeiro toque, nunca reusa
 * esse elemento "manchado" — cria um <audio> NOVO do zero e toca ele
 * direto, de forma síncrona, dentro do próprio gesto.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUnlockedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audio.preload = 'auto';
    audioRef.current = audio;

    // tenta tocar já com som ligado assim que a página abre (funciona
    // direto no desktop e em alguns navegadores mobile mais permissivos)
    audio.play().then(() => {
      hasUnlockedRef.current = true;
    }).catch(() => {
      // bloqueado — vai destravar no primeiro toque abaixo, com um
      // elemento novo (nunca reaproveitando este que já falhou)
    });

    const unlockOnFirstInteraction = () => {
      if (hasUnlockedRef.current) return;
      hasUnlockedRef.current = true;

      // elemento novo, tocado de forma síncrona dentro do próprio gesto —
      // é o único jeito garantido de passar na política de autoplay mobile
      const freshAudio = new Audio(MUSIC_SRC);
      freshAudio.loop = true;
      freshAudio.volume = MUSIC_VOLUME;
      freshAudio.play().catch(() => {
        // se mesmo assim falhar, não trava a experiência do usuário
      });

      // troca a referência e limpa a antiga, sem deixar dois áudios tocando
      const old = audioRef.current;
      audioRef.current = freshAudio;
      if (old && old !== freshAudio) {
        old.pause();
        old.src = '';
      }
    };

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'];
    events.forEach((evt) =>
      document.addEventListener(evt, unlockOnFirstInteraction, { once: true, passive: true }),
    );

    return () => {
      events.forEach((evt) => document.removeEventListener(evt, unlockOnFirstInteraction));
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.src = '';
    };
  }, []);
}
