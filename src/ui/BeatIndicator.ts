import Phaser from 'phaser';
import { BeatManager } from '../systems/BeatManager';
import { GAME_CONFIG } from '../config';

export class BeatIndicator {
  private scene: Phaser.Scene;
  private beatManager: BeatManager;

  // Визуальные элементы
  private pulseOverlay: Phaser.GameObjects.Rectangle;

  // Пульсирующий круг
  private beatCircle: Phaser.GameObjects.Arc;
  private circleRing: Phaser.GameObjects.Arc;

  // Константы позиционирования
  private readonly panelX: number;
  private readonly indicatorY: number = 160;

  // Размеры круга
  private readonly minRadius: number = 8;
  private readonly maxRadius: number = 18;

  constructor(scene: Phaser.Scene, beatManager: BeatManager) {
    this.scene = scene;
    this.beatManager = beatManager;
    this.panelX = GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.PANEL_WIDTH / 2;

    // Полупрозрачный оверлей для пульсации игрового поля
    this.pulseOverlay = scene.add.rectangle(
      GAME_CONFIG.GAME_FIELD_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_FIELD_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0xffffff,
      0
    );
    this.pulseOverlay.setDepth(50);

    // Внешнее кольцо (статичное, показывает максимальный размер)
    this.circleRing = scene.add.circle(this.panelX, this.indicatorY, this.maxRadius);
    this.circleRing.setStrokeStyle(2, 0x444444);
    this.circleRing.setFillStyle(0x000000, 0);
    this.circleRing.setDepth(100);

    // Пульсирующий круг (растёт к биту)
    this.beatCircle = scene.add.circle(this.panelX, this.indicatorY, this.minRadius, 0x4fc3f7);
    this.beatCircle.setDepth(101);

    // Подписываемся на бит
    beatManager.onBeat(() => this.onBeat());
  }

  update(): void {
    this.updatePulse();
  }

  private onBeat(): void {
    // Вспышка на бит
    this.beatCircle.setFillStyle(0xffffff);
    this.circleRing.setStrokeStyle(2, 0x4fc3f7);

    this.scene.time.delayedCall(100, () => {
      this.beatCircle.setFillStyle(0x4fc3f7);
      this.circleRing.setStrokeStyle(2, 0x444444);
    });
  }

  private updatePulse(): void {
    const progress = this.beatManager.getBeatProgress();

    // Круг растёт от minRadius до maxRadius по мере приближения к биту
    // progress 0 → minRadius, progress 1 → maxRadius
    const radius = this.minRadius + (this.maxRadius - this.minRadius) * progress;
    this.beatCircle.setRadius(radius);

    // Прозрачность тоже растёт для усиления эффекта
    const alpha = 0.5 + 0.5 * progress;
    this.beatCircle.setAlpha(alpha);
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

    // Останавливаем предыдущие твины
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
