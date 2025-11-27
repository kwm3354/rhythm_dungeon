import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class Coin {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private tileX: number;
  private tileY: number;
  private collected: boolean = false;

  readonly value: number = 10;

  constructor(scene: Phaser.Scene, tileX: number, tileY: number) {
    this.scene = scene;
    this.tileX = tileX;
    this.tileY = tileY;

    const pixelX = tileX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
    const pixelY = tileY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;

    this.sprite = scene.add.sprite(pixelX, pixelY, 'coin_0');
    this.sprite.setDepth(5);
    this.sprite.setScale(2); // Масштаб для 32px тайлов

    // Анимация вращения монеты
    this.sprite.play('coin_spin');
  }

  getTileX(): number {
    return this.tileX;
  }

  getTileY(): number {
    return this.tileY;
  }

  isCollected(): boolean {
    return this.collected;
  }

  collect(): void {
    if (this.collected) return;
    this.collected = true;

    // Анимация сбора
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 20,
      alpha: 0,
      scaleX: 3,
      scaleY: 3,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.sprite.destroy();
      },
    });
  }

  pulse(): void {
    if (this.collected) return;

    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 50,
      yoyo: true,
    });
  }
}
