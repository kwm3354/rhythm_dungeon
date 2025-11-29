import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export type BeatCallback = () => void;

export class BeatManager {
  private scene: Phaser.Scene;
  private bpm: number;
  private beatInterval: number;   // ms между битами
  private hitWindowMain: number;  // ±ms для основных битов (больше)
  private hitWindowHalf: number;  // ±ms для полу-битов (меньше)
  private beatOffsetMs: number;   // offset первого бита в ms

  private startTime: number = 0;
  private lastBeatTime: number = 0;
  private beatCount: number = 0;
  private isRunning: boolean = false;

  private onBeatCallbacks: BeatCallback[] = [];

  constructor(scene: Phaser.Scene, bpm: number = GAME_CONFIG.DEFAULT_BPM, beatOffsetSec: number = 0) {
    this.scene = scene;
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000; // Конвертируем BPM в миллисекунды
    this.hitWindowMain = GAME_CONFIG.HIT_WINDOW_MS * 2; // 150ms для основных битов
    this.hitWindowHalf = GAME_CONFIG.HIT_WINDOW_MS;     // 75ms для полу-битов
    this.beatOffsetMs = beatOffsetSec * 1000;           // Конвертируем секунды в ms
  }

  start(): void {
    // Учитываем offset первого бита для синхронизации с музыкой
    this.startTime = performance.now() - this.beatOffsetMs;
    this.lastBeatTime = this.startTime;
    this.beatCount = 0;
    this.isRunning = true;

    // Запускаем проверку бита
    this.scene.time.addEvent({
      delay: 16, // ~60fps
      callback: this.update,
      callbackScope: this,
      loop: true,
    });
  }

  stop(): void {
    this.isRunning = false;
  }

  private update(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const timeSinceStart = now - this.startTime;
    const currentBeat = Math.floor(timeSinceStart / this.beatInterval);

    // Проверяем, наступил ли новый бит
    if (currentBeat > this.beatCount) {
      this.beatCount = currentBeat;
      this.lastBeatTime = this.startTime + currentBeat * this.beatInterval;

      // Вызываем все callback-и
      this.onBeatCallbacks.forEach(cb => cb());
    }
  }

  /**
   * Проверяет, попадает ли текущий момент в окно бита или полу-бита
   * Поддерживает движение на восьмых нотах (2x скорость)
   * @returns объект с информацией о попадании
   */
  checkBeatTiming(): { isOnBeat: boolean; offset: number; quality: 'perfect' | 'good' | 'miss'; isMainBeat: boolean } {
    const now = performance.now();
    const halfBeat = this.beatInterval / 2;
    const timeSinceLastBeat = now - this.lastBeatTime;

    // Расстояние до ближайшего основного бита
    const timeToNextBeat = this.beatInterval - timeSinceLastBeat;
    const distanceToMainBeat = Math.min(timeSinceLastBeat, timeToNextBeat);

    // Расстояние до ближайшего полу-бита
    // Полу-бит находится на halfBeat от последнего основного бита
    const timeSinceHalfBeat = timeSinceLastBeat - halfBeat;
    const timeToNextHalfBeat = halfBeat - timeSinceLastBeat;
    const distanceToHalfBeat = timeSinceLastBeat < halfBeat
      ? Math.min(timeSinceLastBeat, Math.abs(timeToNextHalfBeat))
      : Math.min(Math.abs(timeSinceHalfBeat), timeToNextBeat);

    // Берём ближайший из основного или полу-бита
    const distanceToNearest = Math.min(distanceToMainBeat, distanceToHalfBeat);

    // Offset относительно ближайшей точки
    let offset: number;
    if (distanceToMainBeat <= distanceToHalfBeat) {
      // Ближе к основному биту
      offset = timeSinceLastBeat <= halfBeat ? timeSinceLastBeat : -timeToNextBeat;
    } else {
      // Ближе к полу-биту
      offset = timeSinceLastBeat < halfBeat ? -timeToNextHalfBeat : timeSinceHalfBeat;
    }

    // Определяем какое окно использовать
    const isMainBeat = distanceToMainBeat <= distanceToHalfBeat;
    const hitWindow = isMainBeat ? this.hitWindowMain : this.hitWindowHalf;

    // Определяем качество попадания
    if (distanceToNearest <= hitWindow / 4) {
      return { isOnBeat: true, offset, quality: 'perfect', isMainBeat };
    } else if (distanceToNearest <= hitWindow) {
      return { isOnBeat: true, offset, quality: 'good', isMainBeat };
    } else {
      return { isOnBeat: false, offset, quality: 'miss', isMainBeat };
    }
  }

  /**
   * Подписка на событие бита
   */
  onBeat(callback: BeatCallback): void {
    this.onBeatCallbacks.push(callback);
  }

  /**
   * Прогресс до следующего бита (0-1)
   */
  getBeatProgress(): number {
    if (!this.isRunning) return 0;

    const now = performance.now();
    const timeSinceLastBeat = now - this.lastBeatTime;
    return Math.min(timeSinceLastBeat / this.beatInterval, 1);
  }

  /**
   * Время до следующего бита в ms
   */
  getTimeToNextBeat(): number {
    const now = performance.now();
    const timeSinceLastBeat = now - this.lastBeatTime;
    return this.beatInterval - timeSinceLastBeat;
  }

  getBPM(): number {
    return this.bpm;
  }

  setBPM(bpm: number): void {
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000;
  }

  getBeatInterval(): number {
    return this.beatInterval;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getBeatCount(): number {
    return this.beatCount;
  }
}
