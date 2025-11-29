import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { BpmDetector } from '../systems/BpmDetector';

const SPRITES_PATH = '/assets/sprites/0x72_DungeonTilesetII_v1.7/frames';

export interface Track {
  key: string;
  path: string;
  title: string;
  artist: string;
  bpm?: number;  // Если указан - пропускаем автодетекцию
}

const TRACKS: Track[] = [
  { key: 'track_2', path: '/assets/audio/track_2.mp3', title: 'Track 2', artist: 'Suno AI' },
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
    // Игрок (wizzard_m) - idle и run анимации
    for (let i = 0; i < 4; i++) {
      this.load.image(`wizzard_m_idle_${i}`, `${SPRITES_PATH}/wizzard_m_idle_anim_f${i}.png`);
      this.load.image(`wizzard_m_run_${i}`, `${SPRITES_PATH}/wizzard_m_run_anim_f${i}.png`);
    }

    // Враг (imp) - idle и run анимации
    for (let i = 0; i < 4; i++) {
      this.load.image(`imp_idle_${i}`, `${SPRITES_PATH}/imp_idle_anim_f${i}.png`);
      this.load.image(`imp_run_${i}`, `${SPRITES_PATH}/imp_run_anim_f${i}.png`);
    }

    // Монета - анимация
    for (let i = 0; i < 4; i++) {
      this.load.image(`coin_${i}`, `${SPRITES_PATH}/coin_anim_f${i}.png`);
    }

    // Пол
    this.load.image('floor', `${SPRITES_PATH}/floor_1.png`);

    // Стены
    this.load.image('wall', `${SPRITES_PATH}/wall_mid.png`);

    // Выход (лестница вниз)
    this.load.image('exit', `${SPRITES_PATH}/floor_stairs.png`);
  }

  private createAnimations(): void {
    // Игрок idle
    this.anims.create({
      key: 'player_idle',
      frames: [
        { key: 'wizzard_m_idle_0' },
        { key: 'wizzard_m_idle_1' },
        { key: 'wizzard_m_idle_2' },
        { key: 'wizzard_m_idle_3' },
      ],
      frameRate: 8,
      repeat: -1,
    });

    // Игрок run
    this.anims.create({
      key: 'player_run',
      frames: [
        { key: 'wizzard_m_run_0' },
        { key: 'wizzard_m_run_1' },
        { key: 'wizzard_m_run_2' },
        { key: 'wizzard_m_run_3' },
      ],
      frameRate: 10,
      repeat: -1,
    });

    // Враг idle
    this.anims.create({
      key: 'enemy_idle',
      frames: [
        { key: 'imp_idle_0' },
        { key: 'imp_idle_1' },
        { key: 'imp_idle_2' },
        { key: 'imp_idle_3' },
      ],
      frameRate: 8,
      repeat: -1,
    });

    // Враг run
    this.anims.create({
      key: 'enemy_run',
      frames: [
        { key: 'imp_run_0' },
        { key: 'imp_run_1' },
        { key: 'imp_run_2' },
        { key: 'imp_run_3' },
      ],
      frameRate: 10,
      repeat: -1,
    });

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
