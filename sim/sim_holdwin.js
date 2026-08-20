// Simulação do Hold & Win ("Moedas do Tigre") pra calibrar RTP.
// Grade 5x3 = 15 células. Cada célula pode cair uma Moeda (com valor) ou
// ficar em branco. Se 6+ moedas caírem no giro inicial, entra no recurso:
// as moedas travam, e as células em branco continuam girando com 3 "vidas"
// de respin — toda vez que uma moeda nova cai, as vidas voltam pra 3.
// Acaba quando as vidas zeram ou a grade fica 100% cheia de moedas.

const CELLS = 15;
const COIN_PROB = 0.25;
const TRIGGER_MIN_COINS = 6;
const START_LIVES = 3;

const coinValues =  [0.5, 1, 1.5, 2, 3, 5, 10, 50];
const coinWeights = [40, 30, 15, 8, 4, 2, 0.7, 0.3];
const totalCoinWeight = coinWeights.reduce((a, b) => a + b, 0);

function drawCoinValue() {
  let roll = Math.random() * totalCoinWeight;
  let cum = 0;
  for (let i = 0; i < coinValues.length; i++) {
    cum += coinWeights[i];
    if (roll < cum) return coinValues[i];
  }
  return coinValues[coinValues.length - 1];
}

function simulate(spins, coinProb, triggerMin, startLives) {
  const bet = 1;
  let totalBet = 0, totalPayout = 0, featureCount = 0, fullGridCount = 0;
  let payoutHistogram = {};

  for (let s = 0; s < spins; s++) {
    totalBet += bet;

    // grade inicial: cada célula é moeda (com valor) ou branco
    let cellIsCoin = new Array(CELLS).fill(false);
    let cellValue = new Array(CELLS).fill(0);
    let coinCount = 0;
    for (let i = 0; i < CELLS; i++) {
      if (Math.random() < coinProb) {
        cellIsCoin[i] = true;
        cellValue[i] = drawCoinValue();
        coinCount++;
      }
    }

    if (coinCount < triggerMin) {
      continue; // sem recurso, sem prêmio (mesma regra dos jogos comerciais de hold&win)
    }

    featureCount++;
    let lives = startLives;
    while (lives > 0 && coinCount < CELLS) {
      lives--;
      let newLanded = false;
      for (let i = 0; i < CELLS; i++) {
        if (!cellIsCoin[i]) {
          if (Math.random() < coinProb) {
            cellIsCoin[i] = true;
            cellValue[i] = drawCoinValue();
            coinCount++;
            newLanded = true;
          }
        }
      }
      if (newLanded) lives = startLives; // reseta as vidas
    }

    const fullGrid = coinCount === CELLS;
    if (fullGrid) fullGridCount++;

    let sum = 0;
    for (let i = 0; i < CELLS; i++) if (cellIsCoin[i]) sum += cellValue[i];
    const payout = sum * bet;
    totalPayout += payout;

    const bucket = payout >= 50 ? '50+' : payout >= 20 ? '20-50' : payout >= 5 ? '5-20' : '<5';
    payoutHistogram[bucket] = (payoutHistogram[bucket] || 0) + 1;
  }

  return {
    rtp: totalPayout / totalBet,
    featureRate: featureCount / spins,
    fullGridRate: fullGridCount / spins,
    payoutHistogram,
  };
}

const SPINS = 1_000_000;
console.log('--- p=0.25, min=6, lives=3 ---');
console.log(simulate(SPINS, 0.25, 6, 3));

console.log('--- p=0.22, min=6, lives=3 ---');
console.log(simulate(SPINS, 0.22, 6, 3));

console.log('--- p=0.20, min=7, lives=3 ---');
console.log(simulate(SPINS, 0.20, 7, 3));

console.log('--- p=0.20, min=6, lives=2 ---');
console.log(simulate(SPINS, 0.20, 6, 2));

console.log('--- ajuste fino: p baixo, trava alta ---');
for (const p of [0.10, 0.11, 0.12, 0.13, 0.14]) {
  console.log(`p=${p}, min=6, lives=3 =>`, simulate(SPINS, p, 6, 3));
}

console.log('--- refinando pra RTP alvo ~93-95% ---');
for (const p of [0.145, 0.148, 0.15, 0.152, 0.155]) {
  console.log(`p=${p} =>`, simulate(SPINS, p, 6, 3));
}

console.log('--- faixa mais alta, lives=3 ---');
for (const p of [0.16, 0.17, 0.18, 0.19, 0.20]) {
  console.log(`p=${p} =>`, simulate(SPINS, p, 6, 3));
}

console.log('--- afinando entre 0.19 e 0.20 ---');
for (const p of [0.191, 0.192, 0.193, 0.194, 0.195]) {
  console.log(`p=${p} =>`, simulate(2_000_000, p, 6, 3));
}
