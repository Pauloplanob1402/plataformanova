// Etapa 4: Roleta (matemática clássica, não precisa simular) + Batalha do
// Tigre (baccarat simplificado — simula pra achar as probabilidades reais).

console.log('=== Roleta da Fortuna: 37 posições (0-36, zero único europeu) ===');
console.log('Número exato: prob=1/37=' + (1/37).toFixed(4) + ' paga 36x RTP=' + (36/37).toFixed(4));
console.log('Vermelho/Preto/Par/Ímpar/Baixo/Alto: prob=18/37=' + (18/37).toFixed(4) + ' paga 2x RTP=' + ((18/37)*2).toFixed(4));
console.log('(RTP = 97,3% em TODAS as apostas — é a matemática real da roleta europeia, sem precisar calibrar nada)');

console.log('\n=== Batalha do Tigre: baccarat simplificado (2 cartas, sem 3ª carta) ===');
// valores de carta: 0 (10,J,Q,K = 4 de 13) e 1-9 (1 de 13 cada)
function drawCardValue() {
  const roll = Math.random() * 13;
  if (roll < 4) return 0;
  return Math.floor(roll - 4) + 1;
}
function drawHand() {
  return (drawCardValue() + drawCardValue()) % 10;
}
function simulateBaccarat(spins) {
  let playerWins = 0, bankerWins = 0, ties = 0;
  for (let i = 0; i < spins; i++) {
    const p = drawHand();
    const b = drawHand();
    if (p > b) playerWins++;
    else if (b > p) bankerWins++;
    else ties++;
  }
  return { playerWins: playerWins / spins, bankerWins: bankerWins / spins, ties: ties / spins };
}
const result = simulateBaccarat(3_000_000);
console.log(result);

// calibra pagamentos pra RTP ~95% no jogador/banca, tie separado (maior margem, como no Dragão x Tigre)
const playerPay = 0.95 / result.playerWins;
const bankerPay = 0.95 / result.bankerWins;
const tiePay = 8; // fixo, testa RTP resultante
console.log('Jogador paga', playerPay.toFixed(2) + 'x', 'RTP=', (result.playerWins * playerPay).toFixed(4));
console.log('Banca paga', bankerPay.toFixed(2) + 'x', 'RTP=', (result.bankerWins * bankerPay).toFixed(4));
console.log('Empate paga 8x fixo: RTP=', (result.ties * 8).toFixed(4));
