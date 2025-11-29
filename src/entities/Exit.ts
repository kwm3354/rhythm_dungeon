import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class Exit {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private glow: Phaser.GameObjects.Rectangle;
  private tileX: number;
  private tileY: number;
  private isActive: boolean = false;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;

    const pixelX = GAME_CONFIG.GAME_AREA_X + tileX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
    const pixelY = tileY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;

    // Свечение под порталом
    this.glow = scene.add.rectangle(pixelX, pixelY, 40, 40, 0x81c784, 0.5);
    this.glow.setDepth(3);

    this.sprite = scene.add.sprite(pixelX, pixelY, 'exit');
    this.sprite.setDepth(4);
    this.sprite.setScale(2); // Масштаб для 32px тайлов
    this.sprite.setTint(0x81c784); // Зелёный оттенок
  }

  getTileX(): number {
    return this.tileX;
  }

  getTileY(): number {
    return this.tileY;
  }

  /**
   * Активировать выход (когда собраны все монеты)
   */
  activate(): void {
    if (this.isActive) return;
    this.isActive = true;

    // Яркое пульсирующее свечение
    this.glow.setAlpha(0.8);
    this.scene.tweens.add({
      targets: this.glow,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Пульсация спрайта
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  isActivated(): boolean {
    return this.isActive;
  }

  pulse(): void {
    if (!this.isActive) return;

    this.scene.tweens.add({
      targets: this.glow,
      alpha: 1,
      duration: 50,
      yoyo: true,
    });
  }

  destroy(): void {
    this.glow.destroy();
    this.sprite.destroy();
  }
}
