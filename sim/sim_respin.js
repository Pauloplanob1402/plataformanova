// Simulação do sistema base (linha clássica) + recurso Respin Dourado,
// pra calibrar RTP antes de definir os números finais na função SQL.

const symbolWeights = [32, 24, 20, 14, 7, 3]; // lantern,ingot,coin,firecracker,bell,tiger
const payoutMult =    [3, 5, 10, 16, 45, 120];
const totalWeight = 100;
const TIGER = 5; // índice 0-based

function drawSymbol() {
  let roll = Math.random() * totalWeight;
  let cum = 0;
  for (let i = 0; i < 6; i++) {
    cum += symbolWeights[i];
    if (roll < cum) return i;
  }
  return 5;
}

function drawGrid() {
  const g = [];
  for (let i = 0; i < 9; i++) g.push(drawSymbol());
  return g;
}

function evalLines(grid, bet) {
  let payout = 0;
  for (let row = 0; row < 3; row++) {
    const s1 = grid[row], s2 = grid[3 + row], s3 = grid[6 + row];
    if (s1 === s2 && s2 === s3) {
      payout += bet * payoutMult[s1];
    }
  }
  return payout;
}

function simulate(featureChance, maxRespins, fullGridBonusMult, spins) {
  const bet = 1;
  let totalBet = 0, totalPayout = 0, featureCount = 0, fullGridCount = 0;

  for (let s = 0; s < spins; s++) {
    totalBet += bet;
    let grid = drawGrid();

    if (Math.random() < featureChance) {
      featureCount++;
      // escolhe símbolo a travar: tigre se já estiver na grade, senão aleatório dentre os presentes
      let lockSym = grid.includes(TIGER) ? TIGER : grid[Math.floor(Math.random() * 9)];

      let respins = 0;
      let fullGrid = false;
      while (respins < maxRespins) {
        respins++;
        let newLanded = false;
        for (let pos = 0; pos < 9; pos++) {
          if (grid[pos] !== lockSym) {
            const picked = drawSymbol();
            if (picked === lockSym) newLanded = true;
            grid[pos] = picked;
          }
        }
        fullGrid = grid.every((g) => g === lockSym);
        if (fullGrid || !newLanded) break;
      }

      let payout = evalLines(grid, bet);
      if (fullGrid) {
        fullGridCount++;
        payout = payout * fullGridBonusMult;
      }
      totalPayout += payout;
    } else {
      totalPayout += evalLines(grid, bet);
    }
  }

  return {
    rtp: totalPayout / totalBet,
    featureRate: featureCount / spins,
    fullGridRate: fullGridCount / spins,
  };
}

const SPINS = 2_000_000;

console.log('--- Baseline (sem recurso) ---');
console.log(simulate(0, 0, 1, SPINS));

console.log('--- chance=0.012, maxRespins=8, bonus=10x ---');
console.log(simulate(0.012, 8, 10, SPINS));

console.log('--- chance=0.01, maxRespins=6, bonus=8x ---');
console.log(simulate(0.01, 6, 8, SPINS));

console.log('--- chance=0.008, maxRespins=6, bonus=8x ---');
console.log(simulate(0.008, 6, 8, SPINS));

console.log('--- tuning pass ---');
const combos = [
  [0.003, 6, 5],
  [0.004, 5, 5],
  [0.005, 5, 4],
  [0.006, 4, 4],
  [0.005, 6, 4],
];
for (const [chance, maxR, bonus] of combos) {
  console.log(`chance=${chance} maxRespins=${maxR} bonus=${bonus}x =>`, simulate(chance, maxR, bonus, SPINS));
}
