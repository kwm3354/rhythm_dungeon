import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class SidePanel {
  private scene: Phaser.Scene;
  private background: Phaser.GameObjects.Rectangle;
  private x: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const width = GAME_CONFIG.PANEL_WIDTH;
    const height = GAME_CONFIG.GAME_HEIGHT;

    // Только правая панель
    this.x = GAME_CONFIG.GAME_WIDTH - width / 2;

    // Фон панели
    this.background = scene.add.rectangle(
      this.x,
      height / 2,
      width,
      height,
      0x1a1a2e,
      0.95
    );
    this.background.setDepth(90);

    // Рамка
    const border = scene.add.rectangle(
      this.x,
      height / 2,
      width,
      height
    );
    border.setStrokeStyle(1, 0x3d3d5c);
    border.setDepth(91);
  }

  /**
   * Добавляет текст на панель
   */
  addText(
    y: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {}
  ): Phaser.GameObjects.Text {
    const defaultStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontSize: '10px',
      color: '#ffffff',
      align: 'center',
    };

    const textObj = this.scene.add.text(this.x, y, text, { ...defaultStyle, ...style });
    textObj.setOrigin(0.5, 0);
    textObj.setDepth(100);

    return textObj;
  }

  getX(): number {
    return this.x;
  }
}
