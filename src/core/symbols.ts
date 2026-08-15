export interface SlotSymbolDef {
  id: string;
  name: string;
  /** Peso relativo de sorteio — maior = mais frequente. */
  weight: number;
  /**
   * Multiplicador POR VIA (way). O pagamento de uma via é
   * bet_amount * wayMultiplier * (quantidade de vias daquele símbolo).
   * Numa grade 3x3, "vias" = contagem do símbolo no rolo 1 × contagem no
   * rolo 2 × contagem no rolo 3 (0 se ele não aparecer em algum rolo).
   */
  wayMultiplier: number;
}

/**
 * Tabela de símbolos ORIGINAL (arte própria, sem uso de nenhum asset de jogo
 * comercial existente). Sistema "ways to win": grade 3 rolos x 3 posições,
 * qualquer combinação alinhada da esquerda pra direita paga.
 * Pesos e multiplicadores calibrados via simulação de 2M giros para RTP
 * ~94.3% — ajustável em Docs/rtp-calibration (ver histórico do projeto).
 */
export const SYMBOL_TABLE: SlotSymbolDef[] = [
  { id: 'lantern', name: 'Lanterna', weight: 32, wayMultiplier: 0.36 },
  { id: 'ingot', name: 'Lingote', weight: 24, wayMultiplier: 0.62 },
  { id: 'coin', name: 'Moeda', weight: 20, wayMultiplier: 1 },
  { id: 'firecracker', name: 'Rojão', weight: 14, wayMultiplier: 1.8 },
  { id: 'bell', name: 'Sino', weight: 7, wayMultiplier: 3.9 },
  { id: 'tiger', name: 'Tigre', weight: 3, wayMultiplier: 11.5 },
];

export const REELS = 3;
export const ROWS = 3;
