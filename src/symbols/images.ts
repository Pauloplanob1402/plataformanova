import bell from '../assets/symbol-bell.webp';
import coin from '../assets/symbol-coin.webp';
import firecracker from '../assets/symbol-firecracker.webp';
import ingot from '../assets/symbol-ingot.webp';
import lantern from '../assets/symbol-lantern.webp';
import mascoteTigre from '../assets/mascote-tigre.webp';

/**
 * Imagens dos símbolos do slot — arte gerada originalmente (sem referência a
 * nenhum jogo comercial existente), fundo removido e otimizada em WebP.
 * O símbolo "tiger" reutiliza o mascote (maior prêmio da tabela).
 */
export const SYMBOL_IMAGES: Record<string, string> = {
  lantern,
  ingot,
  coin,
  firecracker,
  bell,
  tiger: mascoteTigre,
};
