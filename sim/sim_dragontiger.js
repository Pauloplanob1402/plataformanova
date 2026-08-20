// Dragão x Tigre: 2 cartas (1-13, sem naipe) sorteadas de forma independente
// (deck "infinito" — simplificação padrão em jogos instantâneos, evita
// precisar rastrear estado de baralho entre rodadas).
function simulate(spins) {
  let dragonBet = { total: 0, payout: 0 };
  let tieBet = { total: 0, payout: 0 };

  for (let i = 0; i < spins; i++) {
    const d = 1 + Math.floor(Math.random() * 13);
    const t = 1 + Math.floor(Math.random() * 13);
    const winner = d > t ? 'dragon' : t > d ? 'tiger' : 'tie';

    // aposta no dragão (por simetria, tigre é idêntico)
    dragonBet.total += 1;
    if (winner === 'dragon') dragonBet.payout += 2; // paga 1:1 (devolve 2x)
    else if (winner === 'tie') dragonBet.payout += 0.5; // devolve metade

    // aposta no empate, paga 9x (8:1) no acerto
    tieBet.total += 1;
    if (winner === 'tie') tieBet.payout += 9;
  }

  return {
    dragonRTP: dragonBet.payout / dragonBet.total,
    tieRTP: tieBet.payout / tieBet.total,
  };
}

console.log(simulate(5_000_000));
