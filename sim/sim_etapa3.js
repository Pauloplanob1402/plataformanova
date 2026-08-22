// Etapa 3: jogos de múltiplas decisões (Mina, Torre, Torre Mini, Sobe-Desce).
// Fórmula: multiplicador "justo" (odds reais) escalado por um RTP alvo —
// mesma técnica usada em Mines/Tower de verdade. Isso garante que o RTP
// fica no alvo INDEPENDENTE de quando o jogador decide parar.

const RTP_TARGET = 0.95;

console.log('=== Mina do Tigre: grade 25 células ===');
function minesMultiplier(totalCells, mines, picks) {
  let fairMult = 1;
  for (let i = 0; i < picks; i++) {
    fairMult *= (totalCells - i) / (totalCells - mines - i);
  }
  return RTP_TARGET * fairMult;
}
// simula: jogador sempre revela até um número fixo de picks, depois saca
function simulateMines(spins, totalCells, mines, targetPicks) {
  let totalBet = 0, totalPayout = 0;
  for (let s = 0; s < spins; s++) {
    totalBet += 1;
    // sorteia posições das minas
    const cells = Array.from({length: totalCells}, (_, i) => i);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    const minePositions = new Set(cells.slice(0, mines));
    let picks = 0;
    let busted = false;
    for (let p = 0; p < targetPicks; p++) {
      if (minePositions.has(p)) { busted = true; break; }
      picks++;
    }
    if (!busted) {
      totalPayout += minesMultiplier(totalCells, mines, picks);
    }
  }
  return totalPayout / totalBet;
}
for (const mines of [3, 5, 8]) {
  for (const picks of [1, 3, 5]) {
    console.log(`minas=${mines} picks=${picks}: multiplicador=${minesMultiplier(25, mines, picks).toFixed(3)}x RTP simulado=${simulateMines(500_000, 25, mines, picks).toFixed(4)}`);
  }
}

console.log('\n=== Torre do Tigre: 8 níveis, 3 células (1 armadilha) por nível ===');
function towerMultiplier(cellsPerLevel, traps, level) {
  const safeRatio = (cellsPerLevel - traps) / cellsPerLevel;
  return RTP_TARGET * Math.pow(1 / safeRatio, level);
}
function simulateTower(spins, cellsPerLevel, traps, targetLevel) {
  let totalPayout = 0;
  const safeProb = (cellsPerLevel - traps) / cellsPerLevel;
  for (let s = 0; s < spins; s++) {
    let busted = false;
    for (let lvl = 0; lvl < targetLevel; lvl++) {
      if (Math.random() > safeProb) { busted = true; break; }
    }
    if (!busted) totalPayout += towerMultiplier(cellsPerLevel, traps, targetLevel);
  }
  return totalPayout / spins;
}
for (const level of [1, 3, 5, 8]) {
  console.log(`nível=${level}: multiplicador=${towerMultiplier(3, 1, level).toFixed(3)}x RTP simulado=${simulateTower(500_000, 3, 1, level).toFixed(4)}`);
}

console.log('\n=== Sobe-Desce do Tigre: carta 1-13 ===');
function hiloMultiplier(prob) { return RTP_TARGET / prob; }
// prob de acertar "maior" dado carta atual c: (13-c)/13; "menor": (c-1)/13
for (const c of [1, 5, 7, 10, 13]) {
  const probHigher = (13 - c) / 13;
  const probLower = (c - 1) / 13;
  console.log(`carta=${c}: prob(maior)=${probHigher.toFixed(3)} mult=${probHigher > 0 ? hiloMultiplier(probHigher).toFixed(2) : 'N/A'}x | prob(menor)=${probLower.toFixed(3)} mult=${probLower > 0 ? hiloMultiplier(probLower).toFixed(2) : 'N/A'}x`);
}
