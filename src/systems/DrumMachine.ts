/**
 * Простой синтезатор барабанов для ритм-игры
 * Генерирует kick, snare, hihat паттерны
 */
export class DrumMachine {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private isPlaying: boolean = false;
  private currentBeat: number = 0;
  private bpm: number;
  private intervalId: number | null = null;

  // Callback на каждый бит
  private onBeatCallback: ((beat: number) => void) | null = null;

  // Паттерн: 4/4, 16 шагов (4 такта)
  // 1 = играть, 0 = пауза
  private kickPattern = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
  private snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  private hihatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
  private hihatAccent = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

  constructor(audioContext: AudioContext, bpm: number = 100) {
    this.audioContext = audioContext;
    this.bpm = bpm;

    // Мастер громкость
    this.masterGain = audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(audioContext.destination);
  }

  setBPM(bpm: number): void {
    this.bpm = bpm;
    // Если играет, перезапускаем с новым темпом
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  setVolume(volume: number): void {
    this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  onBeat(callback: (beat: number) => void): void {
    this.onBeatCallback = callback;
  }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentBeat = 0;

    // Интервал между 16-ми нотами (4 шага на бит)
    const stepInterval = (60 / this.bpm / 4) * 1000;

    this.intervalId = window.setInterval(() => {
      this.playStep(this.currentBeat);

      // Callback на каждый бит (каждые 4 шага)
      if (this.currentBeat % 4 === 0 && this.onBeatCallback) {
        this.onBeatCallback(Math.floor(this.currentBeat / 4));
      }

      this.currentBeat = (this.currentBeat + 1) % 16;
    }, stepInterval);
  }

  stop(): void {
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private playStep(step: number): void {
    const now = this.audioContext.currentTime;

    if (this.kickPattern[step]) {
      this.playKick(now);
    }

    if (this.snarePattern[step]) {
      this.playSnare(now);
    }

    if (this.hihatPattern[step]) {
      const accent = this.hihatAccent[step] === 1;
      this.playHihat(now, accent);
    }
  }

  /**
   * Kick drum: низкочастотный удар
   */
  private playKick(time: number): void {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  /**
   * Snare: шум + тон
   */
  private playSnare(time: number): void {
    // Тональная часть
    const osc = this.audioContext.createOscillator();
    const oscGain = this.audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, time);

    oscGain.gain.setValueAtTime(0.3, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + 0.1);

    // Шумовая часть
    const noiseBuffer = this.createNoiseBuffer(0.15);
    const noise = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = noiseBuffer;

    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noiseGain.gain.setValueAtTime(0.5, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    noise.start(time);
  }

  /**
   * Hi-hat: высокочастотный шум
   */
  private playHihat(time: number, accent: boolean = false): void {
    const noiseBuffer = this.createNoiseBuffer(0.05);
    const noise = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    noise.buffer = noiseBuffer;

    filter.type = 'highpass';
    filter.frequency.value = 5000;

    const volume = accent ? 0.3 : 0.15;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
  }

  /**
   * Создаёт буфер белого шума
   */
  private createNoiseBuffer(duration: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  isActive(): boolean {
    return this.isPlaying;
  }
}
