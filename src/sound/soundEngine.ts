/**
 * Efeitos curtos (clique, moeda, fanfarra) são SINTETIZADOS em tempo real via
 * Web Audio API — nenhum arquivo de terceiros é usado neles. O som de torcida
 * durante o giro é um arquivo de áudio fornecido pelo usuário.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private spinLoopAudio: HTMLAudioElement | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainValue: number, delay = 0) {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }

  /** Clique curto de UI (botões). */
  click() {
    this.tone(880, 0.05, 'square', 0.06);
  }

  /** Toca a torcida em loop enquanto os rolos giram. Chamar no início do giro. */
  startSpinLoop() {
    if (!this.spinLoopAudio) {
      this.spinLoopAudio = new Audio('/audio/spin-crowd-loop.mp3');
      this.spinLoopAudio.loop = true;
      this.spinLoopAudio.volume = 0.55;
    }
    this.spinLoopAudio.currentTime = 0;
    this.spinLoopAudio.play().catch(() => {});
  }

  /** Para a torcida do giro. Chamar quando o último rolo parar. */
  stopSpinLoop() {
    if (!this.spinLoopAudio) return;
    this.spinLoopAudio.pause();
    this.spinLoopAudio.currentTime = 0;
  }

  /** Som de parada de um rolo. */
  reelStop() {
    this.tone(180, 0.12, 'triangle', 0.12);
  }

  /** Tilintar de moeda — usado em pequenas vitórias e no cash-out. */
  coin() {
    this.tone(1200, 0.15, 'sine', 0.1);
    this.tone(1800, 0.15, 'sine', 0.08, 0.05);
  }

  /** Fanfarra curta de vitória — símbolos alinhados. */
  win(multiplier: number) {
    const notes = multiplier >= 15
      ? [523.25, 659.25, 783.99, 1046.5] // vitória grande: C E G C
      : [523.25, 659.25, 783.99]; // vitória normal: C E G
    notes.forEach((freq, i) => this.tone(freq, 0.25, 'triangle', 0.12, i * 0.09));
  }

  /** Som grave de "quebrou" no jogo de progressão. */
  bust() {
    this.tone(220, 0.3, 'sawtooth', 0.12);
    this.tone(140, 0.4, 'sawtooth', 0.1, 0.1);
  }

  /** Som de avanço bem-sucedido na torre. */
  advance() {
    this.tone(660, 0.1, 'triangle', 0.1);
    this.tone(880, 0.12, 'triangle', 0.09, 0.06);
  }
}

export const soundEngine = new SoundEngine();
