import Phaser from 'phaser';
import { ComboSystem } from '../systems/ComboSystem';
import { GAME_CONFIG } from '../config';
import { SidePanel } from './SidePanel';
import { Track } from '../scenes/BootScene';

export interface ComboDisplayOptions {
  level: number;
  track?: Track;
  bpm: number;
}

export class ComboDisplay {
  private scene: Phaser.Scene;
  private comboSystem: ComboSystem;

  private levelText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private comboText: Phaser.GameObjects.Text;
  private multiplierText: Phaser.GameObjects.Text;
  private bpmText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, comboSystem: ComboSystem, options: ComboDisplayOptions) {
    this.scene = scene;
    this.comboSystem = comboSystem;

    // Создаём правую панель
    const panel = new SidePanel(scene);
    const panelX = panel.getX();

    // === УРОВЕНЬ (сверху) ===
    scene.add.text(panelX, 10, 'Уровень', {
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5, 0).setDepth(100);

    this.levelText = scene.add.text(panelX, 25, `${options.level}`, {
      fontSize: '20px',
      color: '#4fc3f7',
      fontStyle: 'bold',
    });
    this.levelText.setOrigin(0.5, 0).setDepth(100);

    // === СЧЁТ ===
    scene.add.text(panelX, 55, 'Счёт', {
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5, 0).setDepth(100);

    this.scoreText = scene.add.text(panelX, 70, comboSystem.getScore().toString(), {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.scoreText.setOrigin(0.5, 0).setDepth(100);

    // === КОМБО ===
    this.comboText = scene.add.text(panelX, 100, '', {
      fontSize: '12px',
      color: '#4fc3f7',
    });
    this.comboText.setOrigin(0.5, 0).setDepth(100);

    // Множитель
    this.multiplierText = scene.add.text(panelX, 118, '', {
      fontSize: '14px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    this.multiplierText.setOrigin(0.5, 0).setDepth(100);

    // === BPM (под beat indicator) ===
    this.bpmText = scene.add.text(panelX, 190, `${options.bpm} BPM`, {
      fontSize: '12px',
      color: '#4fc3f7',
    });
    this.bpmText.setOrigin(0.5, 0).setDepth(100);

    // === ТРЕК (внизу панели) ===
    if (options.track) {
      scene.add.text(panelX, GAME_CONFIG.GAME_HEIGHT - 45, options.track.title, {
        fontSize: '9px',
        color: '#ffffff',
        wordWrap: { width: 90 },
        align: 'center',
      }).setOrigin(0.5, 0).setDepth(100);

      scene.add.text(panelX, GAME_CONFIG.GAME_HEIGHT - 25, options.track.artist, {
        fontSize: '8px',
        color: '#888888',
      }).setOrigin(0.5, 0).setDepth(100);
    }

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

  /**
   * Обновить отображение уровня
   */
  setLevel(level: number): void {
    this.levelText.setText(`${level}`);
  }
}
