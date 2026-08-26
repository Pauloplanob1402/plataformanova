/**
 * Efeitos curtos (clique, moeda, fanfarra, derrota) são SINTETIZADOS em tempo
 * real via Web Audio API — nenhum arquivo de terceiros é usado neles. Isso
 * também é o que mantém o app leve: dá pra redesenhar o "timbre" de cada som
 * sem adicionar nem um KB de áudio novo pra baixar. O som de torcida durante
 * o giro é um arquivo de áudio fornecido pelo usuário.
 *
 * Timbres pensados pra soar mais "mesa de cassino" e menos "joguinho infantil":
 * clique é um toque seco (ruído filtrado + thump grave, tipo botão físico),
 * vitória é um sino em camadas com decaimento longo (em vez de bipe de 8-bit),
 * e derrota é um som discreto e sóbrio — sem efeito cômico de "perdeu".
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private spinLoopAudio: HTMLAudioElement | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Buffer de ruído branco reutilizável — base dos sons percussivos (clique, thud). */
  private getNoiseBuffer(): AudioBuffer {
    const ctx = this.getContext();
    if (!this.noiseBuffer) {
      const length = Math.floor(ctx.sampleRate * 0.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
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

  /** Sino/timbre metálico: fundamental + parciais levemente desafinados, ataque rápido e decaimento longo. */
  private bell(freq: number, duration: number, gainValue: number, delay = 0) {
    const ctx = this.getContext();
    [1, 2.01, 3.03].forEach((mult, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, ctx.currentTime + delay);
      const g = gainValue / (idx + 1.7);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(g, ctx.currentTime + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration + 0.05);
    });
  }

  /** Ruído filtrado — base dos sons percussivos/mecânicos (clique, impacto, thud). */
  private noiseBurst(
    duration: number,
    gainValue: number,
    filterFreq: number,
    filterType: BiquadFilterType = 'bandpass',
    delay = 0,
  ) {
    const ctx = this.getContext();
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + delay);
    filter.Q.value = filterType === 'bandpass' ? 1.1 : 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + delay + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime + delay);
    src.stop(ctx.currentTime + delay + duration + 0.02);
  }

  /** Clique de UI (botão "Jogar" etc.) — toque seco e mecânico, tipo botão físico de mesa, não bipe de joguinho. */
  click() {
    this.noiseBurst(0.035, 0.2, 2200, 'bandpass');
    this.tone(130, 0.05, 'sine', 0.09, 0.004);
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

  /** Som de parada de um rolo — impacto surdo, sem bipe agudo. */
  reelStop() {
    this.noiseBurst(0.07, 0.16, 850, 'lowpass');
  }

  /** Tilintar de moeda — usado em pequenas vitórias e no cash-out. Um único sino curto. */
  coin() {
    this.bell(1567.98, 0.32, 0.11);
  }

  /** Fanfarra de vitória — sinos em camadas com decaimento longo (som "premium", não bipe de 8-bit). */
  win(multiplier: number) {
    const big = multiplier >= 15;
    const notes = big
      ? [523.25, 659.25, 783.99, 1046.5] // vitória grande: C E G C
      : [523.25, 659.25, 783.99]; // vitória normal: C E G
    notes.forEach((freq, i) => this.bell(freq, big ? 0.75 : 0.55, big ? 0.12 : 0.1, i * 0.1));
    if (big) this.noiseBurst(0.3, 0.05, 4200, 'highpass', 0.05); // brilho fino por cima, só na vitória grande
  }

  /** Som de derrota — discreto e sóbrio, dois tons graves descendo. Sem efeito cômico. */
  lose() {
    this.tone(196.0, 0.22, 'sine', 0.08);
    this.tone(146.83, 0.3, 'sine', 0.065, 0.1);
    this.noiseBurst(0.05, 0.04, 280, 'lowpass', 0);
  }

  /** Som grave de "quebrou" no jogo de progressão — reaproveita a derrota e reforça com um grave a mais. */
  bust() {
    this.lose();
    this.tone(98, 0.35, 'sine', 0.09, 0.08);
  }

  /** Som de avanço bem-sucedido na torre. */
  advance() {
    this.tone(660, 0.1, 'triangle', 0.1);
    this.tone(880, 0.12, 'triangle', 0.09, 0.06);
  }
}

export const soundEngine = new SoundEngine();
