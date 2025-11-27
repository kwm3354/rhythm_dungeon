import Phaser from 'phaser';
import { DrumMachine } from './DrumMachine';

export class AudioManager {
  private scene: Phaser.Scene;
  private audioContext: AudioContext | null = null;
  private isReady: boolean = false;

  // Drum machine
  private drumMachine: DrumMachine | null = null;
  private useDrums: boolean = false; // По умолчанию используем музыку

  // Музыкальный трек
  private musicElement: HTMLAudioElement | null = null;
  private isMusicPlaying: boolean = false;

  // Громкости
  private masterVolume: number = 0.5;
  private sfxVolume: number = 0.7;
  private musicVolume: number = 0.6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Инициализация AudioContext (требует user interaction)
   */
  async init(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      this.isReady = true;
    } catch (error) {
      console.error('Failed to create AudioContext:', error);
    }
  }

  /**
   * Создаёт и запускает drum machine
   */
  startDrumMachine(bpm: number, onBeat?: (beat: number) => void): void {
    if (!this.audioContext || !this.isReady) return;

    this.drumMachine = new DrumMachine(this.audioContext, bpm);
    this.drumMachine.setVolume(this.musicVolume * this.masterVolume);

    if (onBeat) {
      this.drumMachine.onBeat(onBeat);
    }

    this.drumMachine.start();
  }

  /**
   * Останавливает drum machine
   */
  stopDrumMachine(): void {
    if (this.drumMachine) {
      this.drumMachine.stop();
      this.drumMachine = null;
    }
  }

  /**
   * Проигрывает звук метронома (клик)
   */
  playMetronomeClick(accent: boolean = false): void {
    // Если drum machine активен, не играем метроном
    if (this.useDrums && this.drumMachine?.isActive()) return;

    if (!this.audioContext || !this.isReady) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.frequency.value = accent ? 880 : 440;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(this.sfxVolume * this.masterVolume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }

  /**
   * Проигрывает звук попадания в бит
   */
  playHitSound(quality: 'perfect' | 'good' | 'miss'): void {
    if (!this.audioContext || !this.isReady) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    if (quality === 'perfect') {
      // Мягкий щелчок с резонансом
      this.playClick(ctx, now, 1200, 0.03, 0.12);
    } else if (quality === 'good') {
      // Тихий щелчок
      this.playClick(ctx, now, 800, 0.025, 0.08);
    } else {
      // Глухой стук
      this.playThud(ctx, now);
    }
  }

  private playClick(ctx: AudioContext, time: number, freq: number, duration: number, volume: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + duration);

    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 2;

    const vol = volume * this.sfxVolume * this.masterVolume;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playThud(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.05);

    const vol = 0.15 * this.sfxVolume * this.masterVolume;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  /**
   * Проигрывает звук подбора предмета
   */
  playPickupSound(): void {
    if (!this.audioContext || !this.isReady) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Приятный звук подбора (арпеджио)
    const notes = [523, 659, 784]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.frequency.value = freq;
      osc.type = 'sine';

      const startTime = now + i * 0.05;
      gain.gain.setValueAtTime(0.3 * this.sfxVolume * this.masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  /**
   * Загружает музыкальный трек
   */
  loadMusic(url: string): void {
    this.musicElement = new Audio(url);
    this.musicElement.loop = true;
    this.musicElement.volume = this.musicVolume * this.masterVolume;
  }

  /**
   * Запускает музыку
   */
  playMusic(): void {
    if (!this.musicElement) return;

    this.musicElement.currentTime = 0;
    this.musicElement.play().catch(err => {
      console.warn('Failed to play music:', err);
    });
    this.isMusicPlaying = true;
  }

  /**
   * Останавливает музыку
   */
  stopMusic(): void {
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement.currentTime = 0;
    }
    this.isMusicPlaying = false;
  }

  /**
   * Возвращает текущую позицию в музыке
   */
  getMusicTime(): number {
    return this.musicElement?.currentTime || 0;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  isAudioReady(): boolean {
    return this.isReady;
  }

  isMusicLoaded(): boolean {
    return this.musicElement !== null;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.drumMachine) {
      this.drumMachine.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.drumMachine) {
      this.drumMachine.setVolume(this.musicVolume * this.masterVolume);
    }
  }

  setUseDrums(use: boolean): void {
    this.useDrums = use;
  }
}
