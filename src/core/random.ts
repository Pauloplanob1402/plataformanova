/**
 * xoshiro128+ — mesmo gerador usado nos seus outros simuladores (Fortuna do Tigre).
 * Rápido, boa distribuição, permite seed fixa para testes reprodutíveis de RTP.
 * Não é criptográfico — para um simulador sem dinheiro real isso é suficiente.
 */
export class RandomProvider {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed?: number) {
    let z = (seed ?? Date.now()) >>> 0;
    this.s0 = RandomProvider.splitMix32(z); z = this.s0;
    this.s1 = RandomProvider.splitMix32(z); z = this.s1;
    this.s2 = RandomProvider.splitMix32(z); z = this.s2;
    this.s3 = RandomProvider.splitMix32(z);
  }

  private static splitMix32(state: number): number {
    state = (state + 0x9e3779b9) >>> 0;
    let result = state;
    result = Math.imul(result ^ (result >>> 16), 0x21f0aaad);
    result = Math.imul(result ^ (result >>> 15), 0x735a2d97);
    return (result ^ (result >>> 15)) >>> 0;
  }

  private static rotl(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
  }

  nextUint(): number {
    const result = (this.s0 + this.s3) >>> 0;
    const t = (this.s1 << 9) >>> 0;

    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = RandomProvider.rotl(this.s3, 11);

    return result;
  }

  nextDouble(): number {
    return this.nextUint() / 0xffffffff;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextDouble() * (max - min));
  }

  /** Sorteia um índice a partir de um array de pesos (frequência calibrada). */
  weightedIndex(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    const roll = this.nextDouble() * total;
    let cumulative = 0;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (roll < cumulative) return i;
    }
    return weights.length - 1;
  }
}
