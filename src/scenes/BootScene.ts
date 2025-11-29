import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { BpmDetector } from '../systems/BpmDetector';

const SPRITES_PATH = '/assets/sprites/0x72_DungeonTilesetII_v1.7/frames';

// Все доступные герои
export const HERO_TYPES = [
  'wizzard_m', 'wizzard_f', 'knight_m', 'knight_f',
  'elf_m', 'elf_f', 'dwarf_m', 'dwarf_f',
  'lizard_m', 'lizard_f', 'angel',
] as const;
export type HeroType = typeof HERO_TYPES[number];

// Все доступные враги (только те, у кого есть idle/run анимации)
export const ENEMY_TYPES = [
  'imp', 'goblin', 'skelet', 'tiny_zombie', 'chort',
  'orc_warrior', 'orc_shaman', 'masked_orc', 'wogol',
  'big_zombie', 'big_demon', 'ogre', 'pumpkin_dude',
] as const;
export type EnemyType = typeof ENEMY_TYPES[number];

// Типы пола
export const FLOOR_TYPES = [
  'floor_1', 'floor_2', 'floor_3', 'floor_4',
  'floor_5', 'floor_6', 'floor_7', 'floor_8',
] as const;

// Декор стен
export const BANNER_COLORS = ['blue', 'green', 'red', 'yellow'] as const;
export const FOUNTAIN_COLORS = ['blue', 'red'] as const;

export interface Track {
  key: string;
  path: string;
  title: string;
  artist: string;
  bpm?: number;  // Если указан - пропускаем автодетекцию
}

const TRACKS: Track[] = [
  { key: 'Shadowed abyss', path: '/assets/audio/track_2.mp3', title: 'Shadowed abyss', artist: 'Suno AI', bpm: 100 },
  { key: 'Into the abyss', path: '/assets/audio/Into the Abyss.mp3', title: 'Into the Abyss', artist: 'Suno AI', bpm: 90 },
  { key: 'Through the shadowed gates', path: '/assets/audio/Through the Shadowed Gates.mp3', title: 'Through the Shadowed Gates', artist: 'Suno AI', bpm: 100 },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Показываем прогресс загрузки
    this.showLoadingProgress();

    // Загружаем спрайты
    this.loadSprites();

    // Загружаем SFX
    this.loadSfx();

    // Загружаем все треки
    TRACKS.forEach(track => {
      this.load.audio(track.key, track.path);
    });
  }

  async create(): Promise<void> {
    // Создаём анимации
    this.createAnimations();

    // Выбираем случайный трек
    const selectedTrack = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    this.registry.set('selectedTrack', selectedTrack);

    // Анализируем BPM выбранного трека
    await this.analyzeBpm(selectedTrack);

    // Переходим к обучению
    this.scene.start('TutorialScene');
  }

  private async analyzeBpm(track: Track): Promise<void> {
    // Если BPM указан в треке — используем его, пропускаем детекцию
    if (track.bpm) {
      this.registry.set('bpmResult', {
        bpm: track.bpm,
        offset: 0,
        confidence: 'high',
      });
      console.log(`Track: "${track.title}" by ${track.artist}`);
      console.log(`BPM preset: ${track.bpm}`);
      return;
    }

    // Иначе — автодетекция
    try {
      const audioBuffer = await BpmDetector.getAudioBuffer(track.path);
      const bpmResult = await BpmDetector.detect(audioBuffer);

      this.registry.set('bpmResult', bpmResult);
      console.log(`Track: "${track.title}" by ${track.artist}`);
      console.log(`BPM detected: ${bpmResult.bpm} (confidence: ${bpmResult.confidence}, offset: ${bpmResult.offset.toFixed(3)}s)`);
    } catch (error) {
      console.warn('BPM analysis failed, using default:', error);
      this.registry.set('bpmResult', {
        bpm: GAME_CONFIG.DEFAULT_BPM,
        offset: 0,
        confidence: 'low',
      });
    }
  }

  private loadSfx(): void {
    this.load.audio('sfx_kick', '/assets/audio/sfx/kick_electronic.wav');
    this.load.audio('sfx_snare', '/assets/audio/sfx/snare.wav');
    this.load.audio('sfx_hihat', '/assets/audio/sfx/hihat.wav');
    this.load.audio('sfx_coin', '/assets/audio/sfx/coin.wav');
  }

  private loadSprites(): void {
    // Загружаем всех героев (idle и run анимации)
    for (const hero of HERO_TYPES) {
      for (let i = 0; i < 4; i++) {
        this.load.image(`${hero}_idle_${i}`, `${SPRITES_PATH}/${hero}_idle_anim_f${i}.png`);
        this.load.image(`${hero}_run_${i}`, `${SPRITES_PATH}/${hero}_run_anim_f${i}.png`);
      }
    }

    // Загружаем всех врагов (idle и run анимации)
    for (const enemy of ENEMY_TYPES) {
      for (let i = 0; i < 4; i++) {
        this.load.image(`${enemy}_idle_${i}`, `${SPRITES_PATH}/${enemy}_idle_anim_f${i}.png`);
        this.load.image(`${enemy}_run_${i}`, `${SPRITES_PATH}/${enemy}_run_anim_f${i}.png`);
      }
    }

    // Монета - анимация
    for (let i = 0; i < 4; i++) {
      this.load.image(`coin_${i}`, `${SPRITES_PATH}/coin_anim_f${i}.png`);
    }

    // Все типы пола
    for (const floor of FLOOR_TYPES) {
      this.load.image(floor, `${SPRITES_PATH}/${floor}.png`);
    }

    // Стены
    this.load.image('wall', `${SPRITES_PATH}/wall_mid.png`);

    // Декор стен - баннеры
    for (const color of BANNER_COLORS) {
      this.load.image(`banner_${color}`, `${SPRITES_PATH}/wall_banner_${color}.png`);
    }

    // Декор стен - фонтаны (анимированные)
    for (const color of FOUNTAIN_COLORS) {
      for (let i = 0; i < 3; i++) {
        this.load.image(`fountain_basin_${color}_${i}`, `${SPRITES_PATH}/wall_fountain_basin_${color}_anim_f${i}.png`);
        this.load.image(`fountain_mid_${color}_${i}`, `${SPRITES_PATH}/wall_fountain_mid_${color}_anim_f${i}.png`);
      }
    }

    // Колонны
    this.load.image('column', `${SPRITES_PATH}/column.png`);

    // Выход (лестница вниз)
    this.load.image('exit', `${SPRITES_PATH}/floor_stairs.png`);
  }

  private createAnimations(): void {
    // Создаём анимации для всех героев
    for (const hero of HERO_TYPES) {
      this.anims.create({
        key: `${hero}_idle`,
        frames: [
          { key: `${hero}_idle_0` },
          { key: `${hero}_idle_1` },
          { key: `${hero}_idle_2` },
          { key: `${hero}_idle_3` },
        ],
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: `${hero}_run`,
        frames: [
          { key: `${hero}_run_0` },
          { key: `${hero}_run_1` },
          { key: `${hero}_run_2` },
          { key: `${hero}_run_3` },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }

    // Создаём анимации для всех врагов
    for (const enemy of ENEMY_TYPES) {
      this.anims.create({
        key: `${enemy}_idle`,
        frames: [
          { key: `${enemy}_idle_0` },
          { key: `${enemy}_idle_1` },
          { key: `${enemy}_idle_2` },
          { key: `${enemy}_idle_3` },
        ],
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: `${enemy}_run`,
        frames: [
          { key: `${enemy}_run_0` },
          { key: `${enemy}_run_1` },
          { key: `${enemy}_run_2` },
          { key: `${enemy}_run_3` },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }

    // Монета
    this.anims.create({
      key: 'coin_spin',
      frames: [
        { key: 'coin_0' },
        { key: 'coin_1' },
        { key: 'coin_2' },
        { key: 'coin_3' },
      ],
      frameRate: 8,
      repeat: -1,
    });

    // Анимации фонтанов
    for (const color of FOUNTAIN_COLORS) {
      this.anims.create({
        key: `fountain_basin_${color}`,
        frames: [
          { key: `fountain_basin_${color}_0` },
          { key: `fountain_basin_${color}_1` },
          { key: `fountain_basin_${color}_2` },
        ],
        frameRate: 6,
        repeat: -1,
      });

      this.anims.create({
        key: `fountain_mid_${color}`,
        frames: [
          { key: `fountain_mid_${color}_0` },
          { key: `fountain_mid_${color}_1` },
          { key: `fountain_mid_${color}_2` },
        ],
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  private showLoadingProgress(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Текст загрузки
    const loadingText = this.add.text(width / 2, height / 2, 'Loading...', {
      fontSize: '16px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5);

    // Прогресс бар
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 4, height / 2 + 20, width / 2, 20);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4fc3f7, 1);
      progressBar.fillRect(width / 4 + 2, height / 2 + 22, (width / 2 - 4) * value, 16);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }
}
