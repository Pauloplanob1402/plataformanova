// Calibração dos 6 jogos da Etapa 1. Todos usam sorteio único ponderado
// (sem "efeito bola de neve"), então a matemática é direta — ainda assim
// simulamos pra confirmar antes de qualquer SQL.

function weightedRTP(segments) {
  // segments: [{value, weight}], weight em % (soma deve dar 100)
  const totalWeight = segments.reduce((a, s) => a + s.weight, 0);
  const contribution = segments.reduce((a, s) => a + s.value * s.weight, 0);
  return { rtp: contribution / totalWeight, totalWeight };
}

function solveFillerWeight(fixedSegments, fillerValue, targetRTP) {
  // acha o peso do segmento "filler" (ex: 0x ou 0.5x) que fecha a soma em 100
  // e resolve o RTP alvo variando o peso do PRÓPRIO filler.
  const fixedWeightSum = fixedSegments.reduce((a, s) => a + s.weight, 0);
  const fixedContribution = fixedSegments.reduce((a, s) => a + s.value * s.weight, 0);
  // total = 100 => fillerWeight = 100 - fixedWeightSum
  const fillerWeight = 100 - fixedWeightSum;
  const rtp = (fixedContribution + fillerValue * fillerWeight) / 100;
  return { fillerWeight, rtp };
}

console.log('=== 1. Moeda do Tigre (cara/coroa) ===');
console.log('50% de chance, paga 1.9x no acerto => RTP =', 0.5 * 1.9);

console.log('\n=== 2. Número da Sorte (escolhe 1-10) ===');
console.log('10% de chance, paga 9.4x no acerto => RTP =', 0.1 * 9.4);

console.log('\n=== 3. Roda da Sorte do Tigre (8 gomos) ===');
// pesos ajustados por tentativa até fechar ~94%
const wheelFixed = [
  { value: 1, weight: 15 },
  { value: 1.5, weight: 8 },
  { value: 2, weight: 5 },
  { value: 3, weight: 2.5 },
  { value: 5, weight: 1 },
  { value: 10, weight: 0.3 },
  { value: 50, weight: 0.03 },
];
console.log(solveFillerWeight(wheelFixed, 0.3, 0.94)); // filler = 0.3x (perde pouco, quase sempre "quase ganha")

console.log('\n=== 4. Baú do Tigre (escolhe 1 de 3 baús) ===');
const chestFixed = [
  { value: 1, weight: 12 },
  { value: 1.5, weight: 6 },
  { value: 2, weight: 3 },
  { value: 5, weight: 0.8 },
  { value: 20, weight: 0.1 },
];
console.log(solveFillerWeight(chestFixed, 0.4, 0.94));

console.log('\n=== 5. Dados do Tigre (2 dados, soma 2-12) ===');
// distribuição real de probabilidade de 2 dados
const diceProb = {}; // soma -> combinações em 36
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
  const s = a + b;
  diceProb[s] = (diceProb[s] || 0) + 1;
}
// baixo=2-6, sete=7, alto=8-12
let low = 0, seven = 0, high = 0;
for (const [sum, count] of Object.entries(diceProb)) {
  const s = Number(sum);
  if (s <= 6) low += count;
  else if (s === 7) seven += count;
  else high += count;
}
console.log('prob baixo:', low / 36, 'prob sete:', seven / 36, 'prob alto:', high / 36);
// baixo/alto pagam X, sete paga Y
const payLowHigh = 1.9; // ~mesma prob que moeda, paga parecido
const paySeven = 5.5;
console.log('RTP baixo/alto:', (low / 36) * payLowHigh);
console.log('RTP sete:', (seven / 36) * paySeven);

console.log('\n=== 6. Raspadinha do Tigre (9 células, 3+ iguais paga) ===');

console.log('\n=== reajustando Roda e Baú (pesos maiores nos valores) ===');

function solveTopValue(segments, targetRTP) {
  // segments: todos com weight fixo (soma 100), o ÚLTIMO tem value desconhecido -> resolve
  const known = segments.slice(0, -1);
  const last = segments[segments.length - 1];
  const knownContribution = known.reduce((a, s) => a + s.value * s.weight, 0);
  const neededTotal = targetRTP * 100;
  const lastValue = (neededTotal - knownContribution) / last.weight;
  return lastValue;
}

const wheelSegs = [
  { value: 0, weight: 30 },
  { value: 0.5, weight: 25 },
  { value: 1, weight: 20 },
  { value: 1.5, weight: 12 },
  { value: 2, weight: 8 },
  { value: 3, weight: 3.5 },
  { value: 10, weight: 1.3 },
  { value: null, weight: 0.2 }, // jackpot, valor a resolver
];
console.log('Roda: valor do jackpot (peso 0.2) p/ RTP 94% =', solveTopValue(
  wheelSegs.map(s => s.value === null ? { value: 0, weight: s.weight } : s), 0.94
) + (wheelSegs.reduce((a,s)=>a+ (s.value||0)*s.weight,0))/0.2 - (wheelSegs.reduce((a,s)=>a+ (s.value||0)*s.weight,0))/0.2 );

// mais simples: refazer contas na mão dentro do script
function rtpOf(segments) {
  const totalW = segments.reduce((a, s) => a + s.weight, 0);
  const contrib = segments.reduce((a, s) => a + s.value * s.weight, 0);
  return contrib / totalW;
}

const wheelFinal = [
  { value: 0, weight: 30 },
  { value: 0.5, weight: 25 },
  { value: 1, weight: 20 },
  { value: 1.5, weight: 12 },
  { value: 2, weight: 8 },
  { value: 3, weight: 3.5 },
  { value: 10, weight: 1.2 },
  { value: 60, weight: 0.3 },
];
console.log('pesos somam:', wheelFinal.reduce((a,s)=>a+s.weight,0));
console.log('Roda final RTP:', rtpOf(wheelFinal));

const chestFinal = [
  { value: 0, weight: 25 },
  { value: 0.5, weight: 25 },
  { value: 1.5, weight: 25 },
  { value: 3, weight: 15 },
  { value: 8, weight: 8 },
  { value: 30, weight: 2 },
];
console.log('Baú pesos somam:', chestFinal.reduce((a,s)=>a+s.weight,0));
console.log('Baú final RTP:', rtpOf(chestFinal));

console.log('\n=== Roda final v2 (jackpot resolvido) ===');
const wheelV2 = [
  { value: 0, weight: 30 },
  { value: 0.5, weight: 25 },
  { value: 1, weight: 20 },
  { value: 1.5, weight: 12 },
  { value: 2, weight: 8 },
  { value: 3, weight: 3.5 },
  { value: 10, weight: 1.2 },
  { value: 16, weight: 0.3 },
];
console.log('pesos:', wheelV2.reduce((a,s)=>a+s.weight,0), 'RTP:', rtpOf(wheelV2));

console.log('\n=== Baú final v2 ===');
const chestV2 = [
  { value: 0, weight: 40 },
  { value: 0.5, weight: 30 },
  { value: 1.5, weight: 20 },
  { value: 4, weight: 8 },
  { value: 8.5, weight: 2 },
];
console.log('pesos:', chestV2.reduce((a,s)=>a+s.weight,0), 'RTP:', rtpOf(chestV2));

console.log('\n=== Raspadinha do Tigre: simulação (9 células, 3+ iguais paga) ===');
function simulateScratch(spins, symbols) {
  const totalWeight = symbols.reduce((a, s) => a + s.weight, 0);
  let totalPayout = 0;
  for (let i = 0; i < spins; i++) {
    const counts = new Array(symbols.length).fill(0);
    for (let cell = 0; cell < 9; cell++) {
      let roll = Math.random() * totalWeight;
      let cum = 0;
      for (let s = 0; s < symbols.length; s++) {
        cum += symbols[s].weight;
        if (roll < cum) { counts[s]++; break; }
      }
    }
    for (let s = 0; s < symbols.length; s++) {
      if (counts[s] >= 3) totalPayout += symbols[s].value;
    }
  }
  return totalPayout / spins;
}

const scratchSymbols = [
  { name: 'lantern', weight: 40, value: 1.5 },
  { name: 'ingot', weight: 28, value: 2.5 },
  { name: 'coin', weight: 18, value: 5 },
  { name: 'bell', weight: 10, value: 12 },
  { name: 'tiger', weight: 4, value: 40 },
];
console.log('RTP:', simulateScratch(2_000_000, scratchSymbols));

console.log('\n=== Raspadinha: recalibrando (pesos bem menores) ===');
function tryScratch(symbols, label) {
  const rtp = simulateScratch(2_000_000, symbols);
  console.log(label, '=> RTP:', rtp);
}

tryScratch([
  { name: 'lantern', weight: 10, value: 1.5 },
  { name: 'ingot', weight: 6, value: 3 },
  { name: 'coin', weight: 4, value: 6 },
  { name: 'bell', weight: 2, value: 15 },
  { name: 'tiger', weight: 0.8, value: 50 },
  { name: 'blank', weight: 77.2, value: 0 },
], 'v2');

tryScratch([
  { name: 'lantern', weight: 8, value: 2 },
  { name: 'ingot', weight: 5, value: 4 },
  { name: 'coin', weight: 3, value: 8 },
  { name: 'bell', weight: 1.5, value: 20 },
  { name: 'tiger', weight: 0.6, value: 60 },
  { name: 'blank', weight: 81.9, value: 0 },
], 'v3');

console.log('\n=== Raspadinha: bisseção ===');
for (const w of [15, 18, 20, 22, 25]) {
  tryScratch([
    { name: 'lantern', weight: w, value: 2 },
    { name: 'ingot', weight: w * 0.6, value: 4 },
    { name: 'coin', weight: w * 0.35, value: 8 },
    { name: 'bell', weight: w * 0.15, value: 20 },
    { name: 'tiger', weight: w * 0.05, value: 60 },
    { name: 'blank', weight: 100 - (w + w*0.6 + w*0.35 + w*0.15 + w*0.05), value: 0 },
  ], `w=${w}`);
}

console.log('\n=== Raspadinha: afinando entre 18 e 20 ===');
for (const w of [18.8, 19.0, 19.2, 19.4]) {
  tryScratch([
    { name: 'lantern', weight: w, value: 2 },
    { name: 'ingot', weight: w * 0.6, value: 4 },
    { name: 'coin', weight: w * 0.35, value: 8 },
    { name: 'bell', weight: w * 0.15, value: 20 },
    { name: 'tiger', weight: w * 0.05, value: 60 },
    { name: 'blank', weight: 100 - (w + w*0.6 + w*0.35 + w*0.15 + w*0.05), value: 0 },
  ], `w=${w}`);
}

console.log('\n=== Raspadinha: valores finais travados ===');
tryScratch([
  { name: 'lantern', weight: 19, value: 2 },
  { name: 'ingot', weight: 11.4, value: 4 },
  { name: 'coin', weight: 6.65, value: 8 },
  { name: 'bell', weight: 2.85, value: 20 },
  { name: 'tiger', weight: 0.95, value: 60 },
  { name: 'blank', weight: 59.15, value: 0 },
], 'FINAL');
