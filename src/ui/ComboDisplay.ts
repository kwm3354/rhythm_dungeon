import Phaser from 'phaser';
import { ComboSystem } from '../systems/ComboSystem';
import { GAME_CONFIG } from '../config';

export class ComboDisplay {
  private scene: Phaser.Scene;
  private comboSystem: ComboSystem;

  private comboText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private multiplierText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, comboSystem: ComboSystem) {
    this.scene = scene;
    this.comboSystem = comboSystem;

    // Счёт в правом верхнем углу (показываем начальный счёт)
    this.scoreText = scene.add.text(GAME_CONFIG.GAME_WIDTH - 5, 5, comboSystem.getScore().toString(), {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.scoreText.setOrigin(1, 0);
    this.scoreText.setDepth(100);

    // Комбо под счётом
    this.comboText = scene.add.text(GAME_CONFIG.GAME_WIDTH - 5, 20, '', {
      fontSize: '10px',
      color: '#4fc3f7',
    });
    this.comboText.setOrigin(1, 0);
    this.comboText.setDepth(100);

    // Множитель
    this.multiplierText = scene.add.text(GAME_CONFIG.GAME_WIDTH - 5, 33, '', {
      fontSize: '8px',
      color: '#ffd54f',
    });
    this.multiplierText.setOrigin(1, 0);
    this.multiplierText.setDepth(100);

    // Подписываемся на события
    comboSystem.onComboChange((combo, multiplier) => {
      this.updateDisplay(combo, multiplier);
    });

    comboSystem.onComboBreak(() => {
      this.showComboBreak();
    });
  }

  private updateDisplay(combo: number, multiplier: number): void {
    this.scoreText.setText(this.comboSystem.getScore().toString());

    if (combo > 0) {
      this.comboText.setText(`${combo} combo`);
      this.comboText.setAlpha(1);

      // Пульсация при росте комбо
      this.scene.tweens.add({
        targets: this.comboText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 50,
        yoyo: true,
      });

      if (multiplier > 1) {
        this.multiplierText.setText(`x${multiplier}`);
        this.multiplierText.setAlpha(1);
      } else {
        this.multiplierText.setAlpha(0);
      }
    } else {
      this.comboText.setAlpha(0);
      this.multiplierText.setAlpha(0);
    }
  }

  private showComboBreak(): void {
    // Визуальный эффект сброса комбо
    this.scene.tweens.add({
      targets: this.comboText,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 200,
      onComplete: () => {
        this.comboText.setScale(1);
      },
    });
  }

  update(): void {
    // Обновляем счёт каждый кадр (на случай если добавились очки за монеты)
    this.scoreText.setText(this.comboSystem.getScore().toString());
  }
}
