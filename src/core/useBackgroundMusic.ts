import { useEffect, useRef, useState } from 'react';

const MUSIC_SRC = '/audio/golden-dragon-dance.mp3';
const MUSIC_VOLUME = 0.35;

/**
 * Toca a trilha sonora em loop contínuo, sem botão de controle — o volume
 * fica a cargo do próprio aparelho do usuário (ele abaixa se não quiser).
 *
 * Navegadores bloqueiam áudio COM SOM antes de qualquer interação do usuário
 * (política de autoplay) — isso vale pra QUALQUER site, em QUALQUER
 * navegador mobile, sem exceção; não é algo contornável por código. Por
 * isso: tenta tocar com som direto ao abrir a página; se o navegador
 * bloquear, destrava no primeiro toque/clique/tecla EM QUALQUER LUGAR da
 * tela (não precisa ser especificamente num jogo — é só que, na prática,
 * tocar num jogo costuma ser a primeira coisa que a pessoa faz).
 *
 * Retorna `musicEnabled` pra quem usa o hook poder mostrar um aviso visual
 * ("toque pra ativar o som") enquanto o áudio ainda não tocou de verdade —
 * deixa claro pro usuário o momento exato em que liga, em vez de acontecer
 * "escondido" no meio de outro toque.
 *
 * IMPORTANTE — bug real no Android corrigido aqui: a versão anterior marcava
 * "já destravado" no PRIMEIRO toque, mesmo que o play() daquele toque
 * falhasse (o que acontece em alguns Chrome/WebView Android por causa do
 * tempo de buffer/decode do MP3). Depois disso, os próximos toques eram
 * ignorados e a música nunca mais tentava tocar — silêncio permanente.
 * Agora só marcamos como destravado DEPOIS que o play() realmente confirma
 * sucesso (via .then()); enquanto isso não acontecer, TODO toque seguinte
 * tenta de novo, com um elemento <audio> novo a cada tentativa.
 */
export function useBackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasUnlockedRef = useRef(false);
  const attemptingRef = useRef(false);
  const [musicEnabled, setMusicEnabled] = useState(false);

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audio.preload = 'auto';
    audioRef.current = audio;

    // tenta tocar já com som ligado assim que a página abre (funciona
    // direto no desktop e em alguns navegadores mobile mais permissivos)
    audio
      .play()
      .then(() => {
        hasUnlockedRef.current = true;
        setMusicEnabled(true);
      })
      .catch(() => {
        // bloqueado — vai tentar de novo a cada toque, abaixo
      });

    const tryUnlock = () => {
      if (hasUnlockedRef.current || attemptingRef.current) return;
      attemptingRef.current = true;

      // elemento novo a cada tentativa, tocado de forma síncrona dentro do
      // próprio gesto — evita reaproveitar um <audio> que já "gastou" a
      // permissão de autoplay numa tentativa anterior que falhou
      const freshAudio = new Audio(MUSIC_SRC);
      freshAudio.loop = true;
      freshAudio.volume = MUSIC_VOLUME;
      freshAudio
        .play()
        .then(() => {
          hasUnlockedRef.current = true;
          attemptingRef.current = false;
          setMusicEnabled(true);
          const old = audioRef.current;
          audioRef.current = freshAudio;
          if (old && old !== freshAudio) {
            old.pause();
            old.src = '';
          }
          // sucesso confirmado — agora sim pode parar de tentar
          events.forEach((evt) => document.removeEventListener(evt, tryUnlock));
        })
        .catch(() => {
          // falhou de novo (comum em navegador embutido de app tipo
          // Facebook/Instagram/WhatsApp) — libera pra tentar no próximo toque
          attemptingRef.current = false;
        });
    };

    const events: Array<keyof DocumentEventMap> = ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'];
    events.forEach((evt) => document.addEventListener(evt, tryUnlock, { passive: true }));

    return () => {
      events.forEach((evt) => document.removeEventListener(evt, tryUnlock));
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.src = '';
    };
  }, []);

  return { musicEnabled };
}
