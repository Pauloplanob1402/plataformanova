export interface SlotSymbolDef {
  id: string;
  name: string;
  /** Peso relativo de sorteio — maior = mais frequente. */
  weight: number;
  /** Multiplicador da aposta quando 3 iguais alinham. */
  payoutMultiplier: number;
}

/**
 * Tabela de símbolos ORIGINAL (arte própria em SVG, sem uso de nenhum asset de
 * jogo comercial existente). Pesos calibrados para RTP alvo ~95% — ajustável
 * na ferramenta de calibração (ver core/rtpCalibration.ts).
 */
export const SYMBOL_TABLE: SlotSymbolDef[] = [
  { id: 'lantern', name: 'Lanterna', weight: 32, payoutMultiplier: 1.5 },
  { id: 'ingot', name: 'Lingote', weight: 24, payoutMultiplier: 2.5 },
  { id: 'coin', name: 'Moeda', weight: 20, payoutMultiplier: 4 },
  { id: 'firecracker', name: 'Rojão', weight: 14, payoutMultiplier: 7 },
  { id: 'bell', name: 'Sino', weight: 7, payoutMultiplier: 15 },
  { id: 'tiger', name: 'Tigre', weight: 3, payoutMultiplier: 45 },
];
