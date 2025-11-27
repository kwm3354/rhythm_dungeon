import Phaser from 'phaser';
import { BeatManager } from '../systems/BeatManager';
import { GAME_CONFIG } from '../config';

export class BeatIndicator {
  private scene: Phaser.Scene;
  private beatManager: BeatManager;

  // Визуальные элементы
  private pulseOverlay: Phaser.GameObjects.Rectangle;
  private beatCircle: Phaser.GameObjects.Arc;
  private progressArc: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, beatManager: BeatManager) {
    this.scene = scene;
    this.beatManager = beatManager;

    // Полупрозрачный оверлей для пульсации всего экрана
    this.pulseOverlay = scene.add.rectangle(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0xffffff,
      0
    );
    this.pulseOverlay.setDepth(50);

    // Индикатор бита в углу
    const indicatorX = GAME_CONFIG.GAME_WIDTH - 25;
    const indicatorY = 25;

    // Фоновый круг
    this.beatCircle = scene.add.circle(indicatorX, indicatorY, 15, 0x333333);
    this.beatCircle.setDepth(100);
    this.beatCircle.setStrokeStyle(2, 0x666666);

    // Прогресс-арк
    this.progressArc = scene.add.graphics();
    this.progressArc.setDepth(101);

    // Подписываемся на бит
    beatManager.onBeat(() => this.onBeat());
  }

  update(): void {
    this.updateProgressArc();
  }

  private onBeat(): void {
    // Пульсация индикатора (не трогаем overlay - он для feedback)
    this.scene.tweens.killTweensOf(this.beatCircle);
    this.beatCircle.setScale(1);

    this.scene.tweens.add({
      targets: this.beatCircle,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 50,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.beatCircle.setScale(1);
      },
    });

    // Вспышка цвета
    this.beatCircle.setFillStyle(0x4fc3f7);
    this.scene.time.delayedCall(100, () => {
      this.beatCircle.setFillStyle(0x333333);
    });
  }

  private updateProgressArc(): void {
    const progress = this.beatManager.getBeatProgress();
    const indicatorX = GAME_CONFIG.GAME_WIDTH - 25;
    const indicatorY = 25;
    const radius = 15;

    this.progressArc.clear();

    // Рисуем прогресс-дугу
    const startAngle = -Math.PI / 2; // Начинаем сверху
    const endAngle = startAngle + progress * Math.PI * 2;

    this.progressArc.lineStyle(3, 0x4fc3f7, 0.8);
    this.progressArc.beginPath();
    this.progressArc.arc(indicatorX, indicatorY, radius, startAngle, endAngle, false);
    this.progressArc.strokePath();
  }

  /**
   * Показать обратную связь по качеству попадания
   */
  showHitFeedback(quality: 'perfect' | 'good' | 'miss'): void {
    const colors = {
      perfect: 0x81c784, // Зелёный
      good: 0xffd54f,    // Жёлтый
      miss: 0xe57373,    // Красный
    };

    // Останавливаем предыдущие твины чтобы избежать конфликтов
    this.scene.tweens.killTweensOf(this.pulseOverlay);

    // Сбрасываем состояние
    this.pulseOverlay.setAlpha(0);
    this.pulseOverlay.setFillStyle(colors[quality]);

    this.scene.tweens.add({
      targets: this.pulseOverlay,
      alpha: 0.25,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.pulseOverlay.setAlpha(0);
        this.pulseOverlay.setFillStyle(0xffffff);
      },
    });
  }
}
