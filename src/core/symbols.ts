export interface SlotSymbolDef {
  id: string;
  name: string;
  /** Peso relativo de sorteio — maior = mais frequente. */
  weight: number;
  /**
   * Multiplicador de LINHA CLÁSSICA. Paga bet_amount * payoutMultiplier
   * quando os 3 símbolos de uma mesma linha horizontal (topo, meio ou base)
   * são iguais. Substituiu o sistema "ways to win" (ver wayMultiplier abaixo,
   * mantido só de referência histórica — não é mais usado por nada).
   */
  payoutMultiplier: number;
  /** @deprecated não é mais usado — o jogo mudou de "ways to win" pra linha clássica (ver payoutMultiplier). */
  wayMultiplier: number;
}

/**
 * Tabela de símbolos ORIGINAL (arte própria, sem uso de nenhum asset de jogo
 * comercial existente). Sistema de LINHA CLÁSSICA: grade 3 rolos x 3
 * posições, paga quando os 3 símbolos de uma mesma linha horizontal são
 * iguais (ver supabase/migrations/0008_classic_payline.sql).
 * Pesos e multiplicadores recalibrados pra RTP ~93% com a regra de linha
 * (que paga com menos frequência que o antigo "ways to win" — por isso os
 * multiplicadores são bem maiores que os wayMultiplier antigos).
 */
export const SYMBOL_TABLE: SlotSymbolDef[] = [
  { id: 'lantern', name: 'Lanterna', weight: 32, payoutMultiplier: 3, wayMultiplier: 0.36 },
  { id: 'ingot', name: 'Lingote', weight: 24, payoutMultiplier: 5, wayMultiplier: 0.62 },
  { id: 'coin', name: 'Moeda', weight: 20, payoutMultiplier: 10, wayMultiplier: 1 },
  { id: 'firecracker', name: 'Rojão', weight: 14, payoutMultiplier: 16, wayMultiplier: 1.8 },
  { id: 'bell', name: 'Sino', weight: 7, payoutMultiplier: 45, wayMultiplier: 3.9 },
  { id: 'tiger', name: 'Tigre', weight: 3, payoutMultiplier: 120, wayMultiplier: 11.5 },
];

export const REELS = 3;
export const ROWS = 3;
