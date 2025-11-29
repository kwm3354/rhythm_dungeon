import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { HERO_TYPES, HeroType } from './BootScene';

// Названия героев для отображения
const HERO_NAMES: Record<HeroType, string> = {
  wizzard_m: 'Wizard',
  wizzard_f: 'Witch',
  knight_m: 'Knight',
  knight_f: 'Valkyrie',
  elf_m: 'Elf',
  elf_f: 'Elf Girl',
  dwarf_m: 'Dwarf',
  dwarf_f: 'Dwarf Girl',
  lizard_m: 'Lizard',
  lizard_f: 'Lizard Girl',
  angel: 'Angel',
};

export class CharacterSelectScene extends Phaser.Scene {
  private selectedIndex: number = 0;
  private characterSprites: Phaser.GameObjects.Sprite[] = [];
  private selectionFrame!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    const width = GAME_CONFIG.GAME_WIDTH;
    const height = GAME_CONFIG.GAME_HEIGHT;

    // Заголовок
    const title = this.add.text(width / 2, 20, 'SELECT CHARACTER', {
      fontSize: '14px',
      color: '#ffd54f',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // Сетка персонажей 4x3
    const cols = 4;
    const rows = 3;
    const cellWidth = 60;
    const cellHeight = 70;
    const startX = (width - cols * cellWidth) / 2 + cellWidth / 2;
    const startY = 60;

    // Создаём спрайты персонажей
    HERO_TYPES.forEach((hero, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * cellWidth;
      const y = startY + row * cellHeight;

      const sprite = this.add.sprite(x, y, `${hero}_idle_0`);
      sprite.setScale(2);
      sprite.play(`${hero}_idle`);
      sprite.setInteractive();

      // Клик по персонажу
      sprite.on('pointerdown', () => {
        this.selectCharacter(index);
        this.confirmSelection();
      });

      // Hover эффект
      sprite.on('pointerover', () => {
        this.selectCharacter(index);
      });

      this.characterSprites.push(sprite);
    });

    // Рамка выбора
    const firstSprite = this.characterSprites[0];
    this.selectionFrame = this.add.rectangle(
      firstSprite.x,
      firstSprite.y,
      50,
      60,
      0x4fc3f7,
      0
    );
    this.selectionFrame.setStrokeStyle(2, 0x4fc3f7);

    // Имя выбранного персонажа
    this.nameText = this.add.text(width / 2, height - 50, HERO_NAMES[HERO_TYPES[0]], {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.nameText.setOrigin(0.5);

    // Подсказка
    const hint = this.add.text(width / 2, height - 25, 'Click or press ENTER to select', {
      fontSize: '10px',
      color: '#888888',
    });
    hint.setOrigin(0.5);

    // Пульсация подсказки
    this.tweens.add({
      targets: hint,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Управление клавиатурой
    this.setupKeyboardControls();

    // Обновляем выбор
    this.updateSelection();
  }

  private setupKeyboardControls(): void {
    if (!this.input.keyboard) return;

    const cols = 4;

    this.input.keyboard.on('keydown-LEFT', () => {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.updateSelection();
    });

    this.input.keyboard.on('keydown-RIGHT', () => {
      this.selectedIndex = Math.min(HERO_TYPES.length - 1, this.selectedIndex + 1);
      this.updateSelection();
    });

    this.input.keyboard.on('keydown-UP', () => {
      if (this.selectedIndex >= cols) {
        this.selectedIndex -= cols;
        this.updateSelection();
      }
    });

    this.input.keyboard.on('keydown-DOWN', () => {
      if (this.selectedIndex + cols < HERO_TYPES.length) {
        this.selectedIndex += cols;
        this.updateSelection();
      }
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      this.confirmSelection();
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      this.confirmSelection();
    });
  }

  private selectCharacter(index: number): void {
    this.selectedIndex = index;
    this.updateSelection();
  }

  private updateSelection(): void {
    const sprite = this.characterSprites[this.selectedIndex];
    const hero = HERO_TYPES[this.selectedIndex];

    // Двигаем рамку
    this.selectionFrame.setPosition(sprite.x, sprite.y);

    // Обновляем имя
    this.nameText.setText(HERO_NAMES[hero]);

    // Эффект выбора
    this.tweens.add({
      targets: this.selectionFrame,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
    });
  }

  private confirmSelection(): void {
    const selectedHero = HERO_TYPES[this.selectedIndex];

    // Сохраняем выбор в registry
    this.registry.set('selectedCharacter', selectedHero);

    // Эффект подтверждения
    const sprite = this.characterSprites[this.selectedIndex];
    this.tweens.add({
      targets: sprite,
      scaleX: 3,
      scaleY: 3,
      duration: 200,
      ease: 'Power2',
    });

    // Затемнение и переход
    const overlay = this.add.rectangle(
      GAME_CONFIG.GAME_WIDTH / 2,
      GAME_CONFIG.GAME_HEIGHT / 2,
      GAME_CONFIG.GAME_WIDTH,
      GAME_CONFIG.GAME_HEIGHT,
      0x000000,
      0
    );

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 300,
      onComplete: () => {
        this.scene.start('GameScene');
      },
    });
  }
}
