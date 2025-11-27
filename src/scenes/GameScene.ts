import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player, Direction } from '../entities/Player';
import { Coin } from '../entities/Coin';
import { Enemy } from '../entities/Enemy';
import { Exit } from '../entities/Exit';
import { BeatManager } from '../systems/BeatManager';
import { ComboSystem } from '../systems/ComboSystem';
import { BeatIndicator } from '../ui/BeatIndicator';
import { ComboDisplay } from '../ui/ComboDisplay';
import { AudioManager } from '../systems/AudioManager';
import { AudioVisualizer } from '../ui/AudioVisualizer';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  // Ритм-система
  private beatManager!: BeatManager;
  private beatIndicator!: BeatIndicator;
  private audioManager!: AudioManager;
  private comboSystem!: ComboSystem;
  private comboDisplay!: ComboDisplay;
  private music!: Phaser.Sound.BaseSound;
  private lastMoveTime: number = 0;
  private lastSuccessfulHitTime: number = 0;
  private readonly COMBO_TIMEOUT_MS = 3500; // 3.5 секунды без попаданий = сброс комбо
  private readonly MIN_MOVE_INTERVAL_MS = 150; // Минимум между ходами
  private beatCount: number = 0;
  private currentBPM: number = GAME_CONFIG.DEFAULT_BPM;

  // Состояние игры
  private isGameStarted: boolean = false;
  private startOverlay!: Phaser.GameObjects.Container;

  // Карта комнаты: 0 = пол, 1 = стена
  private roomMap: number[][] = [];

  // Сущности
  private coins: Coin[] = [];
  private enemies: Enemy[] = [];
  private exit: Exit | null = null;

  // Режим погони (после сбора всех монет)
  private isChaseMode: boolean = false;

  // Уровень
  private currentLevel: number = 1;
  private levelText!: Phaser.GameObjects.Text;

  // UI текст
  private feedbackText!: Phaser.GameObjects.Text;

  // Визуализатор музыки
  private visualizer!: AudioVisualizer;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { level?: number }): void {
    this.currentLevel = data.level || 1;
    this.coins = [];
    this.enemies = [];
    this.exit = null;
    this.isChaseMode = false;
    this.isGameStarted = false;
  }

  create(): void {
    // Визуализатор музыки (на заднем плане)
    this.visualizer = new AudioVisualizer(this);

    // Генерируем простую комнату
    this.generateRoom();

    // Отрисовываем карту
    this.drawRoom();

    // Создаём игрока в центре
    const centerX = Math.floor(GAME_CONFIG.ROOM_WIDTH / 2);
    const centerY = Math.floor(GAME_CONFIG.ROOM_HEIGHT / 2);
    this.player = new Player(this, centerX, centerY);

    // Спавним монеты и врагов (выход появится после сбора всех монет)
    this.spawnCoins();
    this.spawnEnemies();

    // BPM фиксированный (трек тот же)
    this.currentBPM = GAME_CONFIG.DEFAULT_BPM;

    // Инициализируем системы
    this.beatManager = new BeatManager(this, this.currentBPM);
    this.beatIndicator = new BeatIndicator(this, this.beatManager);
    this.audioManager = new AudioManager(this);
    this.comboSystem = new ComboSystem();
    this.comboDisplay = new ComboDisplay(this, this.comboSystem);

    // Создаём музыку (загружена в BootScene)
    this.music = this.sound.add('music', { loop: true, volume: 0.5 });

    // Подписываемся на бит
    this.beatManager.onBeat(() => this.onBeat());

    // Настраиваем управление
    this.setupInput();

    // UI
    this.showControls();
    this.createFeedbackUI();

    // Показываем стартовый overlay
    this.createStartOverlay();
  }

  update(): void {
    // Визуализатор обновляется всегда
    this.visualizer.update();

    if (!this.isGameStarted) return;

    this.handleInput();
    this.beatIndicator.update();

    // Автосброс комбо при неактивности
    if (this.comboSystem.getCombo() > 0 &&
        performance.now() - this.lastSuccessfulHitTime > this.COMBO_TIMEOUT_MS) {
      this.comboSystem.miss();
    }
  }

  private onBeat(): void {
    this.player.pulse();
    this.beatCount++;

    // Враги двигаются на каждый бит
    const playerX = this.player.getTileX();
    const playerY = this.player.getTileY();

    this.enemies.forEach(enemy => {
      if (this.isChaseMode) {
        // Режим погони - враги преследуют игрока
        enemy.chase(playerX, playerY, (x, y) => this.isWalkable(x, y));
      } else {
        // Обычный режим - патрулирование
        enemy.patrol((x, y) => this.isWalkable(x, y));
      }
      enemy.pulse();
    });

    // Пульсация выхода на бит
    if (this.exit) {
      this.exit.pulse();
    }

    // Проверяем столкновение с врагом после их хода
    if (this.checkEnemyCollision()) {
      this.onPlayerDeath();
    }
  }

  private createStartOverlay(): void {
    const width = GAME_CONFIG.GAME_WIDTH;
    const height = GAME_CONFIG.GAME_HEIGHT;

    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);

    const startText = this.add.text(width / 2, height / 2, 'Нажми чтобы начать', {
      fontSize: '16px',
      color: '#ffffff',
    });
    startText.setOrigin(0.5);

    this.startOverlay = this.add.container(0, 0, [bg, startText]);
    this.startOverlay.setDepth(200);

    this.tweens.add({
      targets: startText,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    bg.setInteractive();
    bg.on('pointerdown', () => this.startGame());

    this.input.keyboard?.on('keydown', () => {
      if (!this.isGameStarted) {
        this.startGame();
      }
    });
  }

  private async startGame(): Promise<void> {
    if (this.isGameStarted) return;

    // Разблокируем звуковую систему Phaser (критично для Firefox)
    await new Promise<void>((resolve) => {
      if (!this.sound.locked) {
        resolve();
      } else {
        this.sound.once(Phaser.Sound.Events.UNLOCKED, () => resolve());
      }
    });

    await this.audioManager.init();

    this.tweens.add({
      targets: this.startOverlay,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.startOverlay.destroy();
      },
    });

    // Запускаем музыку
    this.music.play();

    // Подключаем визуализатор к музыке
    if (this.music instanceof Phaser.Sound.WebAudioSound) {
      this.visualizer.connectToSound(this.music);
    }

    // Запускаем ритм
    this.beatManager.start();
    this.isGameStarted = true;
    this.beatCount = 0;
  }

  private generateRoom(): void {
    const width = GAME_CONFIG.ROOM_WIDTH;
    const height = GAME_CONFIG.ROOM_HEIGHT;

    this.roomMap = [];

    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < width; x++) {
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          row.push(1);
        } else {
          row.push(0);
        }
      }
      this.roomMap.push(row);
    }

    const obstacleCount = 6; // препятствия для комнаты 13x13
    for (let i = 0; i < obstacleCount; i++) {
      const ox = Phaser.Math.Between(2, width - 3);
      const oy = Phaser.Math.Between(2, height - 3);
      if (ox !== Math.floor(width / 2) || oy !== Math.floor(height / 2)) {
        this.roomMap[oy][ox] = 1;
      }
    }
  }

  private drawRoom(): void {
    const tileSize = GAME_CONFIG.TILE_SIZE;

    for (let y = 0; y < this.roomMap.length; y++) {
      for (let x = 0; x < this.roomMap[y].length; x++) {
        const pixelX = x * tileSize + tileSize / 2;
        const pixelY = y * tileSize + tileSize / 2;

        if (this.roomMap[y][x] === 1) {
          const wall = this.add.sprite(pixelX, pixelY, 'wall');
          wall.setScale(2);
          wall.setDepth(1);
        } else {
          const floor = this.add.sprite(pixelX, pixelY, 'floor');
          floor.setScale(2);
          floor.setDepth(0);
        }
      }
    }
  }

  // Зоны патруля врагов (для проверки при спавне монет)
  private getEnemyPatrolZones(): { x: number; y: number }[] {
    const zones: { x: number; y: number }[] = [];

    // Враг 1: горизонтальный патруль y=2, x от 2 до 10
    for (let x = 2; x <= 10; x++) {
      zones.push({ x, y: 2 });
    }

    // Враг 2: вертикальный патруль x=10, y от 4 до 10
    for (let y = 4; y <= 10; y++) {
      zones.push({ x: 10, y });
    }

    // Враг 3: горизонтальный патруль y=10, x от 2 до 8
    for (let x = 2; x <= 8; x++) {
      zones.push({ x, y: 10 });
    }

    return zones;
  }

  private spawnCoins(): void {
    const coinCount = 5; // монеты для комнаты 13x13
    const centerX = Math.floor(GAME_CONFIG.ROOM_WIDTH / 2);
    const centerY = Math.floor(GAME_CONFIG.ROOM_HEIGHT / 2);
    const enemyZones = this.getEnemyPatrolZones();

    for (let i = 0; i < coinCount; i++) {
      let x: number, y: number;
      let attempts = 0;

      // Ищем свободную клетку (не на маршруте врагов)
      do {
        x = Phaser.Math.Between(1, GAME_CONFIG.ROOM_WIDTH - 2);
        y = Phaser.Math.Between(1, GAME_CONFIG.ROOM_HEIGHT - 2);
        attempts++;
      } while (
        (this.roomMap[y][x] !== 0 ||
         (x === centerX && y === centerY) ||
         this.coins.some(c => c.getTileX() === x && c.getTileY() === y) ||
         enemyZones.some(z => z.x === x && z.y === y)) &&
        attempts < 50
      );

      if (attempts < 50) {
        this.coins.push(new Coin(this, x, y));
      }
    }
  }

  private checkCoinCollection(): void {
    const playerX = this.player.getTileX();
    const playerY = this.player.getTileY();

    this.coins.forEach(coin => {
      if (!coin.isCollected() && coin.getTileX() === playerX && coin.getTileY() === playerY) {
        coin.collect();
        this.comboSystem.addScore(coin.value);
        this.audioManager.playPickupSound();
      }
    });
  }

  private spawnEnemies(): void {
    // Враги для комнаты 13x13
    const enemyConfigs = [
      // Враг 1: горизонтальный патруль вверху
      { start: { x: 2, y: 2 }, patrol: [{ x: 2, y: 2 }, { x: 10, y: 2 }] },
      // Враг 2: вертикальный патруль справа
      { start: { x: 10, y: 4 }, patrol: [{ x: 10, y: 4 }, { x: 10, y: 10 }] },
      // Враг 3: горизонтальный патруль внизу
      { start: { x: 2, y: 10 }, patrol: [{ x: 2, y: 10 }, { x: 8, y: 10 }] },
    ];

    enemyConfigs.forEach(config => {
      if (this.roomMap[config.start.y]?.[config.start.x] === 0) {
        this.enemies.push(new Enemy(this, config.start.x, config.start.y, config.patrol));
      }
    });
  }

  private spawnExit(): void {
    // Выход в правом нижнем углу (или рандомно)
    let x = GAME_CONFIG.ROOM_WIDTH - 2;
    let y = GAME_CONFIG.ROOM_HEIGHT - 2;

    // Если занято стеной, ищем свободное место
    if (this.roomMap[y][x] !== 0) {
      for (let iy = GAME_CONFIG.ROOM_HEIGHT - 2; iy >= 1; iy--) {
        for (let ix = GAME_CONFIG.ROOM_WIDTH - 2; ix >= 1; ix--) {
          if (this.roomMap[iy][ix] === 0) {
            x = ix;
            y = iy;
            break;
          }
        }
      }
    }

    this.exit = new Exit(this, x, y);
  }

  private checkExitReached(): void {
    if (!this.exit || !this.exit.isActivated()) return;

    const playerX = this.player.getTileX();
    const playerY = this.player.getTileY();

    if (playerX === this.exit.getTileX() && playerY === this.exit.getTileY()) {
      this.nextLevel();
    }
  }

  private updateExitState(): void {
    // Когда все монеты собраны - спавним выход и включаем режим погони
    const allCoinsCollected = this.coins.every(c => c.isCollected());
    if (allCoinsCollected && !this.isChaseMode) {
      this.isChaseMode = true;
      this.spawnExit();
      this.exit!.activate();
      this.audioManager.playPickupSound(); // Звук активации
      this.showChaseWarning();
    }
  }

  private showChaseWarning(): void {
    const warningText = this.add.text(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2 - 50,
      'ОХОТА НАЧАЛАСЬ!\nБеги к выходу!',
      {
        fontSize: '18px',
        color: '#e57373',
        fontStyle: 'bold',
        align: 'center',
      }
    );
    warningText.setOrigin(0.5);
    warningText.setDepth(150);

    // Анимация появления и исчезновения
    this.tweens.add({
      targets: warningText,
      alpha: 0,
      y: warningText.y - 30,
      duration: 2000,
      delay: 500,
      ease: 'Power2',
      onComplete: () => {
        warningText.destroy();
      },
    });
  }

  private nextLevel(): void {
    // Останавливаем музыку и ритм
    this.music.stop();
    this.beatManager.stop();
    this.isGameStarted = false;

    this.currentLevel++;

    // Показываем сообщение
    const levelText = this.add.text(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      `LEVEL ${this.currentLevel}`,
      {
        fontSize: '20px',
        color: '#81c784',
        fontStyle: 'bold',
      }
    );
    levelText.setOrigin(0.5);
    levelText.setDepth(200);

    // Затемнение
    const overlay = this.add.rectangle(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0x000000,
      0.7
    );
    overlay.setDepth(199);

    // Через секунду перезапускаем сцену
    this.time.delayedCall(1000, () => {
      this.scene.restart({ level: this.currentLevel });
    });
  }

  private checkEnemyCollision(): boolean {
    const playerX = this.player.getTileX();
    const playerY = this.player.getTileY();

    return this.enemies.some(enemy =>
      enemy.getTileX() === playerX && enemy.getTileY() === playerY
    );
  }

  private onPlayerDeath(): void {
    // Останавливаем игру
    this.isGameStarted = false;
    this.music.stop();
    this.beatManager.stop();

    // Показываем сообщение о смерти
    const deathText = this.add.text(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      'GAME OVER\n\nClick to restart',
      {
        fontSize: '16px',
        color: '#e57373',
        align: 'center',
        fontStyle: 'bold',
      }
    );
    deathText.setOrigin(0.5);
    deathText.setDepth(200);

    // Затемнение
    const overlay = this.add.rectangle(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0x000000,
      0.7
    );
    overlay.setDepth(199);

    // Рестарт по клику
    overlay.setInteractive();
    overlay.on('pointerdown', () => {
      this.scene.restart();
    });
  }

  private setupInput(): void {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private handleInput(): void {
    if (!this.player.canMove()) return;

    // Проверяем минимальный интервал между ходами
    const now = performance.now();
    if (now - this.lastMoveTime < this.MIN_MOVE_INTERVAL_MS) return;

    let direction: Direction | null = null;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) {
      direction = Direction.UP;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) {
      direction = Direction.DOWN;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) {
      direction = Direction.LEFT;
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) {
      direction = Direction.RIGHT;
    }

    if (direction !== null) {
      this.tryMove(direction);
    }
  }

  private tryMove(direction: Direction): void {
    const timing = this.beatManager.checkBeatTiming();
    const now = performance.now();

    if (timing.isOnBeat) {
      const moved = this.player.move(direction, (x, y) => this.isWalkable(x, y));

      if (moved) {
        this.lastMoveTime = now;
        this.lastSuccessfulHitTime = now;
        this.comboSystem.hit(timing.quality as 'perfect' | 'good');
        this.showFeedback(timing.quality, timing.offset);
        this.beatIndicator.showHitFeedback(timing.quality);
        this.audioManager.playHitSound(timing.quality);
        this.checkCoinCollection();
        this.updateExitState();
        this.checkExitReached();

        // Проверяем столкновение с врагом после хода игрока
        if (this.checkEnemyCollision()) {
          this.onPlayerDeath();
        }
      }
    } else {
      this.lastMoveTime = now;
      this.comboSystem.miss();
      this.showFeedback('miss', timing.offset);
      this.beatIndicator.showHitFeedback('miss');
      this.audioManager.playHitSound('miss');
    }
  }

  private isWalkable(x: number, y: number): boolean {
    if (y < 0 || y >= this.roomMap.length) return false;
    if (x < 0 || x >= this.roomMap[0].length) return false;
    return this.roomMap[y][x] === 0;
  }

  private showControls(): void {
    const text = this.add.text(5, 5, 'Move on the BEAT!', {
      fontSize: '10px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    text.setDepth(100);

    // Уровень
    this.levelText = this.add.text(5, GAME_CONFIG.GAME_HEIGHT - 15, `Level ${this.currentLevel}`, {
      fontSize: '10px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    });
    this.levelText.setDepth(100);
  }

  private createFeedbackUI(): void {
    this.feedbackText = this.add.text(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT - 30,
      '',
      {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    );
    this.feedbackText.setOrigin(0.5);
    this.feedbackText.setDepth(100);
  }

  private showFeedback(quality: 'perfect' | 'good' | 'miss', offset: number): void {
    const colors = {
      perfect: '#81c784',
      good: '#ffd54f',
      miss: '#e57373',
    };

    const labels = {
      perfect: 'PERFECT!',
      good: 'GOOD',
      miss: 'MISS',
    };

    const offsetMs = Math.round(offset);
    const offsetStr = offsetMs >= 0 ? `+${offsetMs}ms` : `${offsetMs}ms`;

    this.feedbackText.setText(`${labels[quality]} ${offsetStr}`);
    this.feedbackText.setColor(colors[quality]);

    this.feedbackText.setAlpha(1);
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 500,
      delay: 200,
      ease: 'Power2',
    });
  }
}
