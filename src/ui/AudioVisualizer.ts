import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class AudioVisualizer {
  private scene: Phaser.Scene;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array;
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private barCount: number = 8; // Меньше баров для панели

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.dataArray = new Uint8Array(this.barCount);

    // Вертикальные бары на правой панели
    const panelX = GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.PANEL_WIDTH / 2;
    const barWidth = 10;
    const gap = 2;
    const totalWidth = this.barCount * (barWidth + gap) - gap;
    const startX = panelX - totalWidth / 2;
    const baseY = 280; // Основание баров (растут вверх)

    for (let i = 0; i < this.barCount; i++) {
      const bar = scene.add.rectangle(
        startX + i * (barWidth + gap) + barWidth / 2,
        baseY,
        barWidth,
        5, // начальная высота
        0x4fc3f7,
        0.7
      );
      bar.setOrigin(0.5, 1); // растёт вверх
      bar.setDepth(100);
      this.bars.push(bar);
    }

    // Подпись под эквалайзером
    scene.add.text(panelX, baseY + 8, '♪', {
      fontSize: '12px',
      color: '#4fc3f7',
    }).setOrigin(0.5, 0).setDepth(100);
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
      this.analyser.fftSize = 64; // 32 бина частот
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

    const maxHeight = 60; // максимальная высота бара

    // Обновляем высоту столбиков
    // Берём каждый 4-й бин для 8 баров из 32 бинов
    this.bars.forEach((bar, i) => {
      const binIndex = i * 4; // разреженная выборка частот
      const value = this.dataArray[binIndex] / 255;
      const targetHeight = Math.max(5, value * maxHeight);

      // Плавное изменение высоты
      bar.height = bar.height + (targetHeight - bar.height) * 0.3;
    });
  }

  destroy(): void {
    this.bars.forEach(bar => bar.destroy());
    this.bars = [];
  }
}
