import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { EnemyType } from '../scenes/BootScene';

interface PatrolPoint {
  x: number;
  y: number;
}

export class Enemy {
  private scene: Phaser.Scene;
  private sprite: Phaser.GameObjects.Sprite;
  private tileX: number;
  private tileY: number;
  private isMoving: boolean = false;
  private enemyType: EnemyType;

  // Патрулирование
  private patrolPoints: PatrolPoint[] = [];
  private currentPatrolIndex: number = 0;
  private patrolDirection: number = 1; // 1 = вперёд, -1 = назад

  constructor(scene: Phaser.Scene, startX: number, startY: number, patrolPoints: PatrolPoint[], enemyType: EnemyType = 'imp') {
    this.scene = scene;
    this.tileX = startX;
    this.tileY = startY;
    this.patrolPoints = patrolPoints;
    this.enemyType = enemyType;

    const pixelX = GAME_CONFIG.GAME_AREA_X + startX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
    const pixelY = startY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;

    this.sprite = scene.add.sprite(pixelX, pixelY, `${enemyType}_idle_0`);
    this.sprite.setOrigin(0.5, 0.85);
    this.sprite.setDepth(10);
    this.sprite.setScale(2); // Масштаб для 32px тайлов
    this.sprite.play(`${enemyType}_idle`);
  }

  getTileX(): number {
    return this.tileX;
  }

  getTileY(): number {
    return this.tileY;
  }

  /**
   * Двигается к следующей точке патруля (вызывать на каждый бит)
   */
  patrol(isWalkable: (x: number, y: number) => boolean): void {
    if (this.isMoving || this.patrolPoints.length === 0) return;

    let targetPoint = this.patrolPoints[this.currentPatrolIndex];

    // Если уже на целевой точке - переключаемся на следующую
    if (this.tileX === targetPoint.x && this.tileY === targetPoint.y) {
      this.advancePatrol();
      targetPoint = this.patrolPoints[this.currentPatrolIndex];
    }

    // Вычисляем направление к цели
    const dx = Math.sign(targetPoint.x - this.tileX);
    const dy = Math.sign(targetPoint.y - this.tileY);

    let newX = this.tileX;
    let newY = this.tileY;

    // Приоритет: горизонталь, потом вертикаль
    if (dx !== 0 && isWalkable(this.tileX + dx, this.tileY)) {
      newX = this.tileX + dx;
    } else if (dy !== 0 && isWalkable(this.tileX, this.tileY + dy)) {
      newY = this.tileY + dy;
    }

    // Если не можем двигаться - пропускаем ход
    if (newX === this.tileX && newY === this.tileY) {
      return;
    }

    this.moveTo(newX, newY);

    // Проверяем достижение точки патруля
    if (this.tileX === targetPoint.x && this.tileY === targetPoint.y) {
      this.advancePatrol();
    }
  }

  private moveTo(newX: number, newY: number): void {
    // Поворот спрайта
    if (newX < this.tileX) {
      this.sprite.setFlipX(true);
    } else if (newX > this.tileX) {
      this.sprite.setFlipX(false);
    }

    this.isMoving = true;
    this.tileX = newX;
    this.tileY = newY;

    // Анимация бега
    this.sprite.play(`${this.enemyType}_run`);

    const targetPixelX = GAME_CONFIG.GAME_AREA_X + newX * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;
    const targetPixelY = newY * GAME_CONFIG.TILE_SIZE + GAME_CONFIG.TILE_SIZE / 2;

    this.scene.tweens.add({
      targets: this.sprite,
      x: targetPixelX,
      y: targetPixelY,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        this.isMoving = false;
        this.sprite.play(`${this.enemyType}_idle`);
      },
    });
  }

  private advancePatrol(): void {
    this.currentPatrolIndex += this.patrolDirection;

    // Меняем направление на концах маршрута
    if (this.currentPatrolIndex >= this.patrolPoints.length) {
      this.currentPatrolIndex = this.patrolPoints.length - 2;
      this.patrolDirection = -1;
    } else if (this.currentPatrolIndex < 0) {
      this.currentPatrolIndex = 1;
      this.patrolDirection = 1;
    }

    // Защита от маршрута из 1 точки
    if (this.currentPatrolIndex < 0) this.currentPatrolIndex = 0;
    if (this.currentPatrolIndex >= this.patrolPoints.length) {
      this.currentPatrolIndex = this.patrolPoints.length - 1;
    }
  }

  /**
   * Преследует игрока (вызывать на каждый бит в режиме погони)
   */
  chase(playerX: number, playerY: number, isWalkable: (x: number, y: number) => boolean): void {
    if (this.isMoving) return;

    const dx = Math.sign(playerX - this.tileX);
    const dy = Math.sign(playerY - this.tileY);

    let newX = this.tileX;
    let newY = this.tileY;

    // Приоритет: горизонталь, потом вертикаль (как в patrol)
    if (dx !== 0 && isWalkable(this.tileX + dx, this.tileY)) {
      newX = this.tileX + dx;
    } else if (dy !== 0 && isWalkable(this.tileX, this.tileY + dy)) {
      newY = this.tileY + dy;
    }

    if (newX !== this.tileX || newY !== this.tileY) {
      this.moveTo(newX, newY);
    }
  }

  pulse(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 2.3,
      scaleY: 2.3,
      duration: 50,
      yoyo: true,
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
