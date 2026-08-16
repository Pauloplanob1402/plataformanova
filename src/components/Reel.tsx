import { SYMBOL_TABLE } from '../core/symbols';
import { SYMBOL_IMAGES } from '../symbols/images';

interface ReelProps {
  /** 3 índices (cima, meio, baixo) em SYMBOL_TABLE. */
  symbolIndices: number[];
  spinning: boolean;
  /** linhas vencedoras nesta rodada (1=topo, 2=meio, 3=base) — só essas células acendem. */
  winningRows: number[];
}

/**
 * Uma coluna do slot: mostra 3 posições empilhadas (cima/meio/baixo), como
 * numa grade 3x3 de slot comercial. Componente puramente visual — toda a
 * lógica de giro e avaliação vive no SlotMachine.
 */
export function Reel({ symbolIndices, spinning, winningRows }: ReelProps) {
  return (
    <div className={`reel-column ${spinning ? 'reel-column--spinning' : ''}`}>
      {symbolIndices.map((symbolIndex, row) => {
        const symbol = SYMBOL_TABLE[symbolIndex];
        const isWinning = !spinning && winningRows.includes(row + 1);
        return (
          <div key={row} className={`reel-cell ${isWinning ? 'reel-cell--win' : ''}`}>
            <img src={SYMBOL_IMAGES[symbol.id]} alt={symbol.name} />
          </div>
        );
      })}
    </div>
  );
}
