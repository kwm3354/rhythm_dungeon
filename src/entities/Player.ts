import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { HeroType } from '../scenes/BootScene';

export enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

export class Player extends Phaser.GameObjects.Sprite {
  private gridX: number;
  private gridY: number;
  private isMoving: boolean = false;
  private moveSpeed: number = 150; // пикселей в секунду для анимации
  private heroType: HeroType;

  constructor(scene: Phaser.Scene, gridX: number, gridY: number, heroType: HeroType = 'wizzard_m') {
    const pixelX = GAME_CONFIG.GAME_AREA_X + gridX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
    const pixelY = gridY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;

    super(scene, pixelX, pixelY, `${heroType}_idle_0`);

    this.gridX = gridX;
    this.gridY = gridY;
    this.heroType = heroType;

    // Спрайт выше тайла, якорь снизу
    this.setOrigin(0.5, 0.85);
    this.setDepth(10);
    this.setScale(2); // Масштаб для 32px тайлов

    // Запуск анимации idle
    this.play(`${heroType}_idle`);

    scene.add.existing(this);
  }

  getGridPosition(): { x: number; y: number } {
    return { x: this.gridX, y: this.gridY };
  }

  getTileX(): number {
    return this.gridX;
  }

  getTileY(): number {
    return this.gridY;
  }

  canMove(): boolean {
    return !this.isMoving;
  }

  move(direction: Direction, isWalkable: (x: number, y: number) => boolean): boolean {
    if (this.isMoving) return false;

    let newGridX = this.gridX;
    let newGridY = this.gridY;

    switch (direction) {
      case Direction.UP:
        newGridY--;
        break;
      case Direction.DOWN:
        newGridY++;
        break;
      case Direction.LEFT:
        newGridX--;
        break;
      case Direction.RIGHT:
        newGridX++;
        break;
    }

    // Проверяем можно ли туда идти
    if (!isWalkable(newGridX, newGridY)) {
      return false;
    }

    // Поворот спрайта
    if (direction === Direction.LEFT) {
      this.setFlipX(true);
    } else if (direction === Direction.RIGHT) {
      this.setFlipX(false);
    }

    // Начинаем движение
    this.isMoving = true;
    this.gridX = newGridX;
    this.gridY = newGridY;

    // Анимация бега
    this.play(`${this.heroType}_run`);

    const targetX = GAME_CONFIG.GAME_AREA_X + newGridX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
    const targetY = newGridY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;

    // Анимация перемещения
    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      duration: 100, // Быстрое движение для ритм-игры
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false;
        this.play(`${this.heroType}_idle`);
      },
    });

    return true;
  }

  // Пульсация для визуализации бита
  pulse(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 2.4,
      scaleY: 2.4,
      duration: 50,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }
}
