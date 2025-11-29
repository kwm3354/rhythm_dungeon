import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { Player, Direction } from '../entities/Player';
import { Coin } from '../entities/Coin';
import { Enemy } from '../entities/Enemy';
import { Exit } from '../entities/Exit';
import { BeatManager } from '../systems/BeatManager';
import { ComboSystem, LevelStats } from '../systems/ComboSystem';
import { BeatIndicator } from '../ui/BeatIndicator';
import { ComboDisplay } from '../ui/ComboDisplay';
import { AudioManager } from '../systems/AudioManager';
import { AudioVisualizer } from '../ui/AudioVisualizer';
import { BpmResult } from '../systems/BpmDetector';
import { Track, ENEMY_TYPES, FLOOR_TYPES, EnemyType, HeroType, BANNER_COLORS, FOUNTAIN_COLORS } from './BootScene';

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

  // Флаг смерти
  private isDead: boolean = false;

  // Уровень
  private currentLevel: number = 1;
  private levelText!: Phaser.GameObjects.Text;

  // Визуальное разнообразие
  private currentEnemyType: EnemyType = 'imp';
  private currentFloorType: string = 'floor_1';
  private selectedHero: HeroType = 'wizzard_m';

  // UI текст
  private feedbackText!: Phaser.GameObjects.Text;

  // Визуализатор музыки
  private visualizer!: AudioVisualizer;

  // Декорации
  private decorations: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { level?: number }): void {
    this.currentLevel = data.level || 1;
    this.coins = [];
    this.enemies = [];
    this.decorations = [];
    this.exit = null;
    this.isChaseMode = false;
    this.isGameStarted = false;
    this.isDead = false;

    // Случайный тип врага для уровня
    this.currentEnemyType = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];

    // Стиль пола по уровню (циклически)
    this.currentFloorType = FLOOR_TYPES[(this.currentLevel - 1) % FLOOR_TYPES.length];

    // Получаем выбранного героя из registry
    const hero = this.registry.get('selectedCharacter') as HeroType | undefined;
    this.selectedHero = hero || 'wizzard_m';
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
    this.player = new Player(this, centerX, centerY, this.selectedHero);

    // Спавним монеты и врагов (выход появится после сбора всех монет)
    this.spawnCoins();
    this.spawnEnemies();

    // Получаем BPM и выбранный трек из registry (определены в BootScene)
    const bpmResult = this.registry.get('bpmResult') as BpmResult | undefined;
    const selectedTrack = this.registry.get('selectedTrack') as Track | undefined;
    this.currentBPM = bpmResult?.bpm ?? GAME_CONFIG.DEFAULT_BPM;
    const beatOffset = bpmResult?.offset ?? 0;

    // Инициализируем системы с определённым BPM и offset
    this.beatManager = new BeatManager(this, this.currentBPM, beatOffset);
    this.beatIndicator = new BeatIndicator(this, this.beatManager);
    this.audioManager = new AudioManager(this);

    // Восстанавливаем счёт и maxCombo из registry (сохранены при переходе на уровень)
    const savedScore = this.registry.get('savedScore') as number | undefined;
    const savedMaxCombo = this.registry.get('savedMaxCombo') as number | undefined;
    this.comboSystem = new ComboSystem(savedScore ?? 0, savedMaxCombo ?? 0);

    // Создаём музыку (загружена в BootScene)
    const trackKey = selectedTrack?.key ?? 'glacier';
    this.music = this.sound.add(trackKey, { loop: true, volume: 0.5 });

    // Создаём ComboDisplay с панелью (передаём level, track, BPM)
    this.comboDisplay = new ComboDisplay(this, this.comboSystem, {
      level: this.currentLevel,
      track: selectedTrack,
      bpm: this.currentBPM,
    });

    // Подписываемся на бит
    this.beatManager.onBeat(() => this.onBeat());

    // Настраиваем управление
    this.setupInput();

    // UI
    this.createFeedbackUI();

    // На уровне 1 автостарт (звук уже разблокирован в туториале)
    // На уровнях 2+ показываем overlay с подтверждением
    if (this.currentLevel === 1) {
      this.startGame();
    } else {
      this.createStartOverlay();
    }
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
      if (!this.isGameStarted && !this.isDead) {
        this.startGame();
      }
    });
  }

  private async startGame(): Promise<void> {
    if (this.isGameStarted || this.isDead) return;

    // Разблокируем звуковую систему Phaser (критично для Firefox)
    await new Promise<void>((resolve) => {
      if (!this.sound.locked) {
        resolve();
      } else {
        this.sound.once(Phaser.Sound.Events.UNLOCKED, () => resolve());
      }
    });

    await this.audioManager.init();

    // Убираем overlay если он был создан
    if (this.startOverlay) {
      this.tweens.add({
        targets: this.startOverlay,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.startOverlay.destroy();
        },
      });
    }

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
    const offsetX = GAME_CONFIG.GAME_AREA_X;

    for (let y = 0; y < this.roomMap.length; y++) {
      for (let x = 0; x < this.roomMap[y].length; x++) {
        const pixelX = offsetX + x * tileSize + tileSize / 2;
        const pixelY = y * tileSize + tileSize / 2;

        if (this.roomMap[y][x] === 1) {
          const wall = this.add.sprite(pixelX, pixelY, 'wall');
          wall.setScale(2);
          wall.setDepth(1);
        } else {
          const floor = this.add.sprite(pixelX, pixelY, this.currentFloorType);
          floor.setScale(2);
          floor.setDepth(0);
        }
      }
    }

    // Добавляем декор на верхнюю стену
    this.addWallDecorations();
  }

  private addWallDecorations(): void {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const offsetX = GAME_CONFIG.GAME_AREA_X;
    const topWallY = 0;

    // Собираем позиции верхней стены (не угловые)
    const wallPositions: number[] = [];
    for (let x = 1; x < GAME_CONFIG.ROOM_WIDTH - 1; x++) {
      if (this.roomMap[topWallY][x] === 1) {
        wallPositions.push(x);
      }
    }

    // Перемешиваем позиции
    Phaser.Utils.Array.Shuffle(wallPositions);

    // Добавляем 1-2 фонтана
    const fountainCount = Phaser.Math.Between(1, 2);
    const fountainColor = FOUNTAIN_COLORS[Math.floor(Math.random() * FOUNTAIN_COLORS.length)];

    for (let i = 0; i < fountainCount && i < wallPositions.length; i++) {
      const x = wallPositions[i];
      const pixelX = offsetX + x * tileSize + tileSize / 2;
      const pixelY = topWallY * tileSize + tileSize / 2;

      // Верхняя часть фонтана (вода)
      const fountainMid = this.add.sprite(pixelX, pixelY - 8, `fountain_mid_${fountainColor}_0`);
      fountainMid.setScale(2);
      fountainMid.setDepth(2);
      fountainMid.play(`fountain_mid_${fountainColor}`);
      this.decorations.push(fountainMid);

      // Нижняя часть (бассейн) - рисуется на следующем ряду
      if (this.roomMap[topWallY + 1] && this.roomMap[topWallY + 1][x] === 0) {
        const basinPixelY = (topWallY + 1) * tileSize + tileSize / 2 - 8;
        const fountainBasin = this.add.sprite(pixelX, basinPixelY, `fountain_basin_${fountainColor}_0`);
        fountainBasin.setScale(2);
        fountainBasin.setDepth(2);
        fountainBasin.play(`fountain_basin_${fountainColor}`);
        this.decorations.push(fountainBasin);
      }
    }

    // Добавляем 2-4 баннера на оставшиеся позиции
    const bannerCount = Phaser.Math.Between(2, 4);
    const startIdx = fountainCount;

    for (let i = 0; i < bannerCount && startIdx + i < wallPositions.length; i++) {
      const x = wallPositions[startIdx + i];
      const pixelX = offsetX + x * tileSize + tileSize / 2;
      const pixelY = topWallY * tileSize + tileSize / 2 + 4;

      const bannerColor = BANNER_COLORS[Math.floor(Math.random() * BANNER_COLORS.length)];
      const banner = this.add.sprite(pixelX, pixelY, `banner_${bannerColor}`);
      banner.setScale(2);
      banner.setDepth(2);
      this.decorations.push(banner);
    }

    // Добавляем колонны по углам
    const cornerPositions = [
      { x: 1, y: 1 },
      { x: GAME_CONFIG.ROOM_WIDTH - 2, y: 1 },
    ];

    for (const pos of cornerPositions) {
      if (this.roomMap[pos.y]?.[pos.x] === 0) {
        const pixelX = offsetX + pos.x * tileSize + tileSize / 2;
        const pixelY = pos.y * tileSize + tileSize / 2;

        const column = this.add.sprite(pixelX, pixelY, 'column');
        column.setScale(2);
        column.setDepth(3);
        this.decorations.push(column);
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
        this.enemies.push(new Enemy(this, config.start.x, config.start.y, config.patrol, this.currentEnemyType));
      }
    });
  }

  private spawnExit(): void {
    const playerX = this.player.getTileX();
    const playerY = this.player.getTileY();
    const minDistance = 3;

    // Собираем все свободные клетки достаточно далеко от игрока
    const validPositions: { x: number; y: number }[] = [];

    for (let y = 1; y < GAME_CONFIG.ROOM_HEIGHT - 1; y++) {
      for (let x = 1; x < GAME_CONFIG.ROOM_WIDTH - 1; x++) {
        if (this.roomMap[y][x] === 0) {
          const distance = Math.abs(x - playerX) + Math.abs(y - playerY);
          if (distance >= minDistance) {
            validPositions.push({ x, y });
          }
        }
      }
    }

    // Выбираем случайную позицию
    const pos = Phaser.Utils.Array.GetRandom(validPositions);
    this.exit = new Exit(this, pos.x, pos.y);
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
      // Snare при активации режима погони
      this.sound.play('sfx_snare', { volume: 0.3 });
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

  private calculateGrade(accuracy: number): { grade: string; color: string; message: string } {
    if (accuracy >= 95) return { grade: '★★★', color: '#ffd700', message: 'ИДЕАЛЬНО!' };
    if (accuracy >= 85) return { grade: '★★', color: '#81c784', message: 'Отлично!' };
    if (accuracy >= 70) return { grade: '★', color: '#4fc3f7', message: 'Хорошо!' };
    if (accuracy >= 50) return { grade: '—', color: '#ffd54f', message: 'Неплохо' };
    return { grade: '✗', color: '#e57373', message: 'Тренируйся!' };
  }

  private getSoCloseMessage(accuracy: number): string | null {
    const thresholds = [
      { min: 92, target: 95, label: '★★★' },
      { min: 82, target: 85, label: '★★' },
      { min: 67, target: 70, label: '★' },
      { min: 47, target: 50, label: 'зачёта' },
    ];

    for (const t of thresholds) {
      if (accuracy >= t.min && accuracy < t.target) {
        const diff = Math.ceil(t.target - accuracy);
        return `Почти до ${t.label}! Ещё ${diff}%!`;
      }
    }
    return null;
  }

  private showLevelComplete(onComplete: () => void): void {
    const stats = this.comboSystem.getStats();
    const gradeInfo = this.calculateGrade(stats.accuracy);
    const soCloseMsg = this.getSoCloseMessage(stats.accuracy);

    const width = GAME_CONFIG.GAME_WIDTH;
    const height = GAME_CONFIG.GAME_HEIGHT;

    // Затемнение
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    overlay.setDepth(199);
    overlay.setAlpha(0);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
    });

    // Контейнер для всех текстов
    const container = this.add.container(0, 0);
    container.setDepth(200);

    // Заголовок
    const titleText = this.add.text(width / 2, 35, `УРОВЕНЬ ${this.currentLevel} ПРОЙДЕН`, {
      fontSize: '16px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    });
    titleText.setOrigin(0.5);
    titleText.setAlpha(0);
    container.add(titleText);

    // Линии статистики
    const lines: { text: Phaser.GameObjects.Text; delay: number }[] = [];
    let startY = 70;
    const lineHeight = 22;

    // Accuracy
    const accuracyText = this.add.text(width / 2, startY, `Точность: ${stats.accuracy.toFixed(1)}%`, {
      fontSize: '14px',
      color: '#ffffff',
    });
    accuracyText.setOrigin(0.5);
    accuracyText.setAlpha(0);
    container.add(accuracyText);
    lines.push({ text: accuracyText, delay: 200 });
    startY += lineHeight;

    // Разделитель
    const divider1 = this.add.text(width / 2, startY, '───────────────', {
      fontSize: '10px',
      color: '#666666',
    });
    divider1.setOrigin(0.5);
    divider1.setAlpha(0);
    container.add(divider1);
    lines.push({ text: divider1, delay: 300 });
    startY += lineHeight - 5;

    // Perfect
    const perfectText = this.add.text(width / 2, startY, `Идеально: ${stats.perfect}`, {
      fontSize: '12px',
      color: '#81c784',
    });
    perfectText.setOrigin(0.5);
    perfectText.setAlpha(0);
    container.add(perfectText);
    lines.push({ text: perfectText, delay: 400 });
    startY += lineHeight - 4;

    // Good
    const goodText = this.add.text(width / 2, startY, `Хорошо: ${stats.good}`, {
      fontSize: '12px',
      color: '#ffd54f',
    });
    goodText.setOrigin(0.5);
    goodText.setAlpha(0);
    container.add(goodText);
    lines.push({ text: goodText, delay: 500 });
    startY += lineHeight - 4;

    // Miss
    const missText = this.add.text(width / 2, startY, `Промах: ${stats.miss}`, {
      fontSize: '12px',
      color: '#e57373',
    });
    missText.setOrigin(0.5);
    missText.setAlpha(0);
    container.add(missText);
    lines.push({ text: missText, delay: 600 });
    startY += lineHeight;

    // Разделитель
    const divider2 = this.add.text(width / 2, startY, '───────────────', {
      fontSize: '10px',
      color: '#666666',
    });
    divider2.setOrigin(0.5);
    divider2.setAlpha(0);
    container.add(divider2);
    lines.push({ text: divider2, delay: 700 });
    startY += lineHeight - 5;

    // Max Combo
    const comboText = this.add.text(width / 2, startY, `Макс. комбо: ${stats.maxCombo}`, {
      fontSize: '12px',
      color: '#ba68c8',
    });
    comboText.setOrigin(0.5);
    comboText.setAlpha(0);
    container.add(comboText);
    lines.push({ text: comboText, delay: 800 });
    startY += lineHeight + 10;

    // Грейд (большой)
    const gradeText = this.add.text(width / 2, startY + 5, gradeInfo.grade, {
      fontSize: '40px',
      color: gradeInfo.color,
      fontStyle: 'bold',
    });
    gradeText.setOrigin(0.5);
    gradeText.setAlpha(0);
    gradeText.setScale(0.3);
    container.add(gradeText);

    // Сообщение грейда
    const messageText = this.add.text(width / 2, startY + 40, gradeInfo.message, {
      fontSize: '12px',
      color: gradeInfo.color,
    });
    messageText.setOrigin(0.5);
    messageText.setAlpha(0);
    container.add(messageText);

    // Анимируем заголовок
    this.tweens.add({
      targets: titleText,
      alpha: 1,
      duration: 300,
    });

    // Анимируем строки
    lines.forEach(({ text, delay }) => {
      this.tweens.add({
        targets: text,
        alpha: 1,
        duration: 200,
        delay,
      });
    });

    // Анимируем грейд (последний, с эффектом scale)
    this.time.delayedCall(1000, () => {
      this.tweens.add({
        targets: gradeText,
        alpha: 1,
        scale: 1,
        duration: 400,
        ease: 'Back.out',
      });
      this.tweens.add({
        targets: messageText,
        alpha: 1,
        duration: 300,
        delay: 200,
      });
    });

    // "So close!" сообщение
    if (soCloseMsg) {
      const soCloseText = this.add.text(width / 2, height - 45, soCloseMsg, {
        fontSize: '11px',
        color: '#ffab91',
        fontStyle: 'italic',
      });
      soCloseText.setOrigin(0.5);
      soCloseText.setAlpha(0);
      container.add(soCloseText);

      this.time.delayedCall(1600, () => {
        this.tweens.add({
          targets: soCloseText,
          alpha: 1,
          duration: 300,
        });
        // Пульсация
        this.tweens.add({
          targets: soCloseText,
          scale: 1.05,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      });
    }

    // Подсказка продолжения
    const continueText = this.add.text(width / 2, height - 20, 'Нажми чтобы продолжить...', {
      fontSize: '10px',
      color: '#888888',
    });
    continueText.setOrigin(0.5);
    continueText.setAlpha(0);
    container.add(continueText);

    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: continueText,
        alpha: 1,
        duration: 300,
      });
      this.tweens.add({
        targets: continueText,
        alpha: 0.5,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });

      // Включаем интерактивность overlay
      overlay.setInteractive();
      overlay.on('pointerdown', () => {
        container.destroy();
        overlay.destroy();
        onComplete();
      });
    });
  }

  private nextLevel(): void {
    // Останавливаем и уничтожаем музыку (иначе при рестарте будет дублироваться)
    this.music.stop();
    this.music.destroy();
    this.beatManager.stop();
    this.isGameStarted = false;

    // Сохраняем счёт и maxCombo для следующего уровня
    this.registry.set('savedScore', this.comboSystem.getScore());
    this.registry.set('savedMaxCombo', this.comboSystem.getMaxCombo());

    // Показываем статистику уровня
    this.showLevelComplete(() => {
      // После просмотра статистики — переход на следующий уровень
      this.currentLevel++;
      this.comboSystem.resetLevelStats();
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
    this.isDead = true;
    this.music.stop();
    this.music.destroy();
    this.beatManager.stop();

    // Очищаем сохранённый счёт (новая игра начнётся с нуля)
    this.registry.set('savedScore', 0);
    this.registry.set('savedMaxCombo', 0);

    // Затемнение (СНАЧАЛА overlay для корректной обработки кликов)
    const overlay = this.add.rectangle(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0x000000,
      0.7
    );
    overlay.setDepth(199);
    overlay.setInteractive();
    overlay.on('pointerdown', () => {
      this.scene.restart();
    });

    // Показываем сообщение о смерти (ПОТОМ текст поверх)
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

        // Играем kick на чётных битах музыки (чтобы не частило)
        if (timing.isMainBeat && this.beatManager.getBeatCount() % 2 === 0) {
          this.sound.play('sfx_kick', { volume: timing.quality === 'perfect' ? 0.3 : 0.2 });
        }

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
      // При промахе — тишина (игрок не "достраивает" ритм)
    }
  }

  private isWalkable(x: number, y: number): boolean {
    if (y < 0 || y >= this.roomMap.length) return false;
    if (x < 0 || x >= this.roomMap[0].length) return false;
    return this.roomMap[y][x] === 0;
  }

  // showControls и showTrackAttribution удалены - всё в ComboDisplay

  private createFeedbackUI(): void {
    this.feedbackText = this.add.text(
      GAME_CONFIG.GAME_AREA_X + GAME_CONFIG.GAME_FIELD_WIDTH / 2,
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
    this.feedbackText.setStroke('#000000', 3);
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
