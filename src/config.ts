import Phaser from 'phaser';

export const GAME_CONFIG = {
  // Размеры тайлов и карты
  TILE_SIZE: 32, // Увеличен для лучшего качества
  ROOM_WIDTH: 13,  // тайлов
  ROOM_HEIGHT: 13, // тайлов

  // Правая панель UI
  PANEL_WIDTH: 100,
  GAME_AREA_X: 0, // Нет сдвига - только правая панель

  // Размеры игрового окна (с учётом панели)
  get GAME_FIELD_WIDTH() {
    return this.TILE_SIZE * this.ROOM_WIDTH; // 416 - только игровое поле
  },
  get GAME_WIDTH() {
    return this.GAME_FIELD_WIDTH + this.PANEL_WIDTH; // 516 - с правой панелью
  },
  get GAME_HEIGHT() {
    return this.TILE_SIZE * this.ROOM_HEIGHT;
  },

  // Ритм настройки
  DEFAULT_BPM: 90,
  HIT_WINDOW_MS: 75, // ±75ms окно

  // Масштаб для пиксельной графики
  SCALE: 2,
};

export const PHASER_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_CONFIG.GAME_WIDTH,
  height: GAME_CONFIG.GAME_HEIGHT,
  pixelArt: false, // Отключено для читаемого текста
  antialias: false, // Но спрайты остаются чёткими
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: GAME_CONFIG.SCALE,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  audio: {
    disableWebAudio: false,
  },
  backgroundColor: '#1a1a2e',
  scene: [], // Сцены добавим позже
};

// Цвета для плейсхолдеров
export const COLORS = {
  FLOOR: 0x3d3d5c,
  WALL: 0x1a1a2e,
  PLAYER: 0x4fc3f7,
  ENEMY: 0xe57373,
  COIN: 0xffd54f,
  EXIT: 0x81c784,
};
