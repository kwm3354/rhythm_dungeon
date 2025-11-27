import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class AudioVisualizer {
  private scene: Phaser.Scene;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array;
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private barCount: number = 32;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.dataArray = new Uint8Array(this.barCount);

    // Создаём столбики на фоне
    const barWidth = GAME_CONFIG.GAME_WIDTH / this.barCount;

    for (let i = 0; i < this.barCount; i++) {
      const bar = scene.add.rectangle(
        i * barWidth + barWidth / 2,
        GAME_CONFIG.GAME_HEIGHT,
        barWidth - 1,
        10, // начальная высота
        0x4fc3f7,
        0.6 // ярче
      );
      bar.setOrigin(0.5, 1);
      bar.setDepth(2); // поверх пола (0), но под персонажами (10)
      this.bars.push(bar);
    }
  }

  /**
   * Подключает анализатор к мастер-выходу Phaser Sound
   */
  connectToSound(sound: Phaser.Sound.WebAudioSound): void {
    try {
      // Получаем Web Audio контекст из Phaser
      const soundManager = this.scene.sound as Phaser.Sound.WebAudioSoundManager;
      const audioContext = soundManager.context;

      // Создаём AnalyserNode
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 128; // 64 бина частот
      this.analyser.smoothingTimeConstant = 0.7;

      // Подключаем мастер-выход Phaser к анализатору
      // masterVolumeNode -> analyser -> destination
      const masterVolumeNode = (soundManager as any).masterVolumeNode as GainNode;
      if (masterVolumeNode) {
        masterVolumeNode.disconnect();
        masterVolumeNode.connect(this.analyser);
        this.analyser.connect(audioContext.destination);
        console.log('Audio visualizer connected to master output');
      } else {
        console.warn('masterVolumeNode not found');
      }

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (error) {
      console.warn('Failed to connect audio visualizer:', error);
    }
  }

  update(): void {
    if (!this.analyser) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Обновляем высоту столбиков
    this.bars.forEach((bar, i) => {
      const value = this.dataArray[i] / 255;
      const targetHeight = value * GAME_CONFIG.GAME_HEIGHT * 0.7;

      // Плавное изменение высоты
      bar.height = bar.height + (targetHeight - bar.height) * 0.3;
    });
  }

  destroy(): void {
    this.bars.forEach(bar => bar.destroy());
    this.bars = [];
  }
}
