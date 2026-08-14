import { SYMBOL_TABLE } from '../core/symbols';
import { SYMBOL_IMAGES } from '../symbols/images';

interface ReelProps {
  symbolIndex: number;
  spinning: boolean;
}

/**
 * Componente puramente visual — só mostra o símbolo que o SlotMachine mandar.
 * Toda a lógica de giro (intervalos, timeouts, quando parar) fica centralizada
 * no SlotMachine, evitando bugs de sincronismo entre componentes.
 */
export function Reel({ symbolIndex, spinning }: ReelProps) {
  const symbol = SYMBOL_TABLE[symbolIndex];

  return (
    <div className={`reel ${spinning ? 'reel--spinning' : ''}`}>
      <div className="reel__symbol">
        <img src={SYMBOL_IMAGES[symbol.id]} alt={symbol.name} />
      </div>
    </div>
  );
}
