export interface SlotSymbolDef {
  id: string;
  name: string;
  /** Peso relativo de sorteio — maior = mais frequente. */
  weight: number;
  /** Multiplicador da aposta quando 3 iguais alinham (payline única, usado pelo jogo atual). */
  payoutMultiplier: number;
  /**
   * Multiplicador usado pelo sistema alternativo "ways to win" (core/waysToWin.ts),
   * onde vários símbolos podem pagar na mesma rodada em vez de só 1 payline.
   * Calibrado mais baixo que payoutMultiplier porque paga com mais frequência
   * (basta o símbolo aparecer em todos os 3 rolos, não precisa ser na mesma linha).
   */
  wayMultiplier: number;
}

/** Dimensões da grade usada pelo sistema "ways to win" (3 rolos x 3 posições). */
export const REELS = 3;
export const ROWS = 3;

/**
 * Tabela de símbolos ORIGINAL (arte própria em SVG, sem uso de nenhum asset de
 * jogo comercial existente). Pesos calibrados para RTP alvo ~95% — ajustável
 * na ferramenta de calibração (ver core/rtpCalibration.ts).
 */
export const SYMBOL_TABLE: SlotSymbolDef[] = [
  { id: 'lantern', name: 'Lanterna', weight: 32, payoutMultiplier: 1.5, wayMultiplier: 0.4 },
  { id: 'ingot', name: 'Lingote', weight: 24, payoutMultiplier: 2.5, wayMultiplier: 0.7 },
  { id: 'coin', name: 'Moeda', weight: 20, payoutMultiplier: 4, wayMultiplier: 1.2 },
  { id: 'firecracker', name: 'Rojão', weight: 14, payoutMultiplier: 7, wayMultiplier: 2.5 },
  { id: 'bell', name: 'Sino', weight: 7, payoutMultiplier: 15, wayMultiplier: 6 },
  { id: 'tiger', name: 'Tigre', weight: 3, payoutMultiplier: 45, wayMultiplier: 18 },
];
