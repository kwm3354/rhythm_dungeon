import Phaser from 'phaser';
import { PHASER_CONFIG } from './config';
import { BootScene } from './scenes/BootScene';
import { TutorialScene } from './scenes/TutorialScene';
import { GameScene } from './scenes/GameScene';

// Добавляем сцены в конфигурацию
const config: Phaser.Types.Core.GameConfig = {
  ...PHASER_CONFIG,
  scene: [BootScene, TutorialScene, GameScene],
};

// Запускаем игру
new Phaser.Game(config);
