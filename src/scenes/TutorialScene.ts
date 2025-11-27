import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

interface TutorialStep {
  title: string;
  text: string;
  icon?: string;
}

export class TutorialScene extends Phaser.Scene {
  private currentStep: number = 0;
  private steps: TutorialStep[] = [
    {
      title: 'RHYTHM DUNGEON',
      text: 'Добро пожаловать!\n\nЭто ритм-игра, где ты должен\nдвигаться в такт музыке.',
    },
    {
      title: 'УПРАВЛЕНИЕ',
      text: 'Используй WASD или стрелки\nдля движения.\n\n↑ ← ↓ →  или  W A S D',
    },
    {
      title: 'РИТМ',
      text: 'Двигайся ТОЛЬКО на бит!\n\nСледи за индикатором справа вверху.\nПопадай в такт для комбо!',
    },
    {
      title: 'ЦЕЛЬ',
      text: 'Собери все монеты,\nчтобы открыть выход.\n\nОсторожно: после сбора всех монет\nвраги начнут охоту на тебя!',
    },
    {
      title: 'ГОТОВ?',
      text: 'Нажми чтобы начать игру!\n\nУдачи!',
    },
  ];

  private titleText!: Phaser.GameObjects.Text;
  private contentText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private progressDots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super({ key: 'TutorialScene' });
  }

  create(): void {
    const width = GAME_CONFIG.GAME_WIDTH;
    const height = GAME_CONFIG.GAME_HEIGHT;

    // Фон
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // Заголовок
    this.titleText = this.add.text(width / 2, 60, '', {
      fontSize: '28px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    });
    this.titleText.setOrigin(0.5);

    // Контент
    this.contentText = this.add.text(width / 2, height / 2, '', {
      fontSize: '16px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 8,
    });
    this.contentText.setOrigin(0.5);

    // Подсказка внизу
    this.hintText = this.add.text(width / 2, height - 50, 'Нажми для продолжения...', {
      fontSize: '14px',
      color: '#888888',
    });
    this.hintText.setOrigin(0.5);

    // Пульсация подсказки
    this.tweens.add({
      targets: this.hintText,
      alpha: 0.5,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Прогресс-точки
    const dotSpacing = 20;
    const dotsWidth = (this.steps.length - 1) * dotSpacing;
    const startX = width / 2 - dotsWidth / 2;

    for (let i = 0; i < this.steps.length; i++) {
      const dot = this.add.circle(startX + i * dotSpacing, height - 25, 5, 0x666666);
      this.progressDots.push(dot);
    }

    // Показываем первый шаг
    this.showStep(0);

    // Обработка кликов
    this.input.on('pointerdown', () => this.nextStep());
    this.input.keyboard?.on('keydown', () => this.nextStep());
  }

  private showStep(index: number): void {
    const step = this.steps[index];

    // Анимация появления
    this.titleText.setAlpha(0);
    this.contentText.setAlpha(0);

    this.titleText.setText(step.title);
    this.contentText.setText(step.text);

    this.tweens.add({
      targets: [this.titleText, this.contentText],
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });

    // Обновляем прогресс-точки
    this.progressDots.forEach((dot, i) => {
      dot.setFillStyle(i === index ? 0x4fc3f7 : 0x666666);
    });

    // На последнем шаге меняем подсказку
    if (index === this.steps.length - 1) {
      this.hintText.setText('Нажми чтобы играть!');
      this.hintText.setColor('#81c784');
    }
  }

  private nextStep(): void {
    this.currentStep++;

    if (this.currentStep >= this.steps.length) {
      // Переход к игре
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(300, () => {
        this.scene.start('GameScene');
      });
    } else {
      this.showStep(this.currentStep);
    }
  }
}
