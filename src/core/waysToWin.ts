import { REELS, ROWS, SYMBOL_TABLE } from './symbols';

/** Grade do slot: 3 rolos, cada um com 3 posições (cima/meio/baixo). */
export type SlotGrid = number[][]; // grid[reelIndex][rowIndex] = índice em SYMBOL_TABLE

export interface WinResult {
  totalPayout: number;
  /** ids dos símbolos que pagaram nesta rodada (para destacar na grade). */
  winningSymbolIds: string[];
}

/**
 * Avalia o sistema "ways to win": para cada símbolo, conta quantas vezes ele
 * aparece em cada rolo. Se aparecer em TODOS os 3 rolos (contagem > 0 em
 * cada um), o número de vias é o produto das contagens, e o pagamento é
 * bet_amount * wayMultiplier * vias. Símbolos diferentes podem pagar na
 * mesma rodada.
 */
export function evaluateWays(grid: SlotGrid, betAmount: number): WinResult {
  const winningSymbolIds: string[] = [];
  let totalPayout = 0;

  for (const symbol of SYMBOL_TABLE) {
    const symbolIndex = SYMBOL_TABLE.indexOf(symbol);
    const countsPerReel = grid.map((reel) => reel.filter((idx) => idx === symbolIndex).length);
    const ways = countsPerReel.reduce((a, b) => a * b, 1);

    if (ways > 0) {
      totalPayout += Math.round(betAmount * symbol.wayMultiplier * ways);
      winningSymbolIds.push(symbol.id);
    }
  }

  return { totalPayout, winningSymbolIds };
}

/** Sorteia uma grade completa (3 rolos x 3 posições) usando os pesos reais. */
export function drawGrid(weightedIndex: (weights: number[]) => number): SlotGrid {
  const weights = SYMBOL_TABLE.map((s) => s.weight);
  const grid: SlotGrid = [];
  for (let r = 0; r < REELS; r++) {
    const reel: number[] = [];
    for (let row = 0; row < ROWS; row++) {
      reel.push(weightedIndex(weights));
    }
    grid.push(reel);
  }
  return grid;
}
