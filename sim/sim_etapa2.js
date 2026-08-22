// Calibração dos 6 jogos da Etapa 2.

function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
  return r;
}

console.log('=== 1. Keno do Tigre: escolhe 5 de 40, sorteia 10 ===');
// hipergeométrica: N=40 total, K=10 sorteados, n=5 escolhidos, P(k acertos)
const N = 40, K = 10, n = 5;
const totalCombos = comb(N, n);
const probs = [];
for (let k = 0; k <= n; k++) {
  const p = (comb(K, k) * comb(N - K, n - k)) / totalCombos;
  probs.push(p);
  console.log(`${k} acertos: prob=${p.toFixed(5)}`);
}
// paytable a calibrar: 0,1 acertos=0; 2=1x; 3=4x; 4=20x; 5=200x
function kenoRTP(paytable) {
  return probs.reduce((sum, p, k) => sum + p * (paytable[k] || 0), 0);
}
console.log('RTP teste [0,0,1,4,20,200]:', kenoRTP([0, 0, 1, 4, 20, 200]));
console.log('RTP teste [0,0,1,3,15,120]:', kenoRTP([0, 0, 1, 3, 15, 120]));
console.log('RTP teste [0,0,1,3,15,100]:', kenoRTP([0, 0, 1, 3, 15, 100]));

console.log('\n=== 2. Plinko do Tigre: 8 filas (binomial) ===');
const rows = 8;
const plinkoProbs = [];
for (let slot = 0; slot <= rows; slot++) {
  plinkoProbs.push(comb(rows, slot) / Math.pow(2, rows));
}
console.log('probs por slot (0-8):', plinkoProbs.map(p => p.toFixed(4)));
function plinkoRTP(multipliers) {
  return plinkoProbs.reduce((sum, p, i) => sum + p * multipliers[i], 0);
}
// simétrico: bordas altas, centro baixo
console.log('RTP [16,4,1.5,0.5,0.3,0.5,1.5,4,16]:', plinkoRTP([16, 4, 1.5, 0.5, 0.3, 0.5, 1.5, 4, 16]));
console.log('RTP [12,3,1.2,0.4,0.2,0.4,1.2,3,12]:', plinkoRTP([12, 3, 1.2, 0.4, 0.2, 0.4, 1.2, 3, 12]));

console.log('\n=== 4. Duelo do Tigre: 1 dado cada ===');
const winP = 15/36, tieP = 6/36, loseP = 15/36;
console.log('vitória:', winP, 'empate:', tieP, 'derrota:', loseP);
function duelRTP(winPay) { return winP * winPay + tieP * 1; }
console.log('RTP paga 1.85x na vitória (empate devolve aposta):', duelRTP(1.85));

console.log('\n=== 6. Turfe do Tigre: 12 animais, odds justas ===');
const weights = { tigre: 20, dragao: 12, cavalo: 10, coelho: 9, boi: 8, macaco: 7, galo: 7, cachorro: 6, porco: 6, rato: 6, cobra: 5, cabra: 4 };
const totalW = Object.values(weights).reduce((a, b) => a + b, 0);
console.log('soma pesos:', totalW);
for (const [animal, w] of Object.entries(weights)) {
  const payout = 94 / w;
  console.log(`${animal}: peso=${w} paga=${payout.toFixed(1)}x RTP=${((w/100)*payout).toFixed(3)}`);
}

console.log('\n=== Keno: afinando paytable ===');
console.log('RTP [0,0,1,4,20,400]:', kenoRTP([0, 0, 1, 4, 20, 400]));
console.log('RTP [0,0,1,4,20,410]:', kenoRTP([0, 0, 1, 4, 20, 410]));

console.log('\n=== Plinko: afinando multiplicadores ===');
console.log('RTP [15,4,1.5,0.5,0.3,0.5,1.5,4,15]:', plinkoRTP([15, 4, 1.5, 0.5, 0.3, 0.5, 1.5, 4, 15]));
console.log('RTP [14,3.5,1.4,0.5,0.3,0.5,1.4,3.5,14]:', plinkoRTP([14, 3.5, 1.4, 0.5, 0.3, 0.5, 1.4, 3.5, 14]));

console.log('\n=== 5. Bingo do Tigre: simulação ===');
// cartela 5x5 (24 números + centro livre), sorteia N bolas de um total de 75,
// vence se completar qualquer linha/coluna/diagonal (12 no total)
function simulateBingo(spins, totalBalls, drawCount, payout) {
  let totalPayout = 0;
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([0,1,2,3,4].map(c => r*5+c));
  for (let c = 0; c < 5; c++) lines.push([0,1,2,3,4].map(r => r*5+c));
  lines.push([0,6,12,18,24]);
  lines.push([4,8,12,16,20]);

  for (let s = 0; s < spins; s++) {
    // gera cartela: 24 números distintos de 1..totalBalls + centro livre (índice 12)
    const pool = Array.from({length: totalBalls}, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const card = pool.slice(0, 24);
    card.splice(12, 0, 0); // centro livre = 0 (sempre "marcado")

    // sorteia as bolas (do restante do pool, sem reposição)
    const remaining = pool.slice(24);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const drawn = new Set(remaining.slice(0, drawCount));
    drawn.add(0); // centro livre

    const marked = card.map(n => drawn.has(n));
    const won = lines.some(line => line.every(idx => marked[idx]));
    if (won) totalPayout += payout;
  }
  return totalPayout / spins;
}

for (const draws of [20, 22, 24, 26]) {
  console.log(`draws=${draws} =>`, simulateBingo(300_000, 75, draws, 1));
}

console.log('\n=== Bingo: corrigindo o bug (bolas devem poder bater com a cartela) ===');
function simulateBingo2(spins, totalBalls, drawCount, payout) {
  let totalPayout = 0;
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push([0,1,2,3,4].map(c => r*5+c));
  for (let c = 0; c < 5; c++) lines.push([0,1,2,3,4].map(r => r*5+c));
  lines.push([0,6,12,18,24]);
  lines.push([4,8,12,16,20]);

  function shuffledPool() {
    const pool = Array.from({length: totalBalls}, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  for (let s = 0; s < spins; s++) {
    const card = shuffledPool().slice(0, 24);
    card.splice(12, 0, 0); // centro livre

    const drawnArr = shuffledPool().slice(0, drawCount);
    const drawn = new Set(drawnArr);
    drawn.add(0);

    const marked = card.map(n => drawn.has(n));
    const won = lines.some(line => line.every(idx => marked[idx]));
    if (won) totalPayout += payout;
  }
  return totalPayout / spins;
}

for (const draws of [15, 18, 20, 22]) {
  console.log(`draws=${draws} => prob de vencer:`, simulateBingo2(300_000, 75, draws, 1));
}

console.log('\n=== Bingo: valor final travado (draws=22, paga 26x) ===');
console.log('RTP:', simulateBingo2(1_000_000, 75, 22, 26));
