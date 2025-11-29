export type ComboCallback = (combo: number, multiplier: number) => void;

export interface LevelStats {
  perfect: number;
  good: number;
  miss: number;
  total: number;
  accuracy: number;
  maxCombo: number;
}

export class ComboSystem {
  private combo: number = 0;
  private maxCombo: number = 0;
  private score: number = 0;

  // Трекинг попаданий для статистики уровня
  private perfectHits: number = 0;
  private goodHits: number = 0;
  private totalMoves: number = 0;

  private onComboChangeCallbacks: ComboCallback[] = [];
  private onComboBreakCallbacks: (() => void)[] = [];

  constructor(initialScore: number = 0, initialMaxCombo: number = 0) {
    this.score = initialScore;
    this.maxCombo = initialMaxCombo;
    // combo сбрасывается на новом уровне (начинаем с 0)
  }

  // Очки за попадание
  private readonly PERFECT_POINTS = 100;
  private readonly GOOD_POINTS = 50;

  /**
   * Регистрирует успешное попадание
   */
  hit(quality: 'perfect' | 'good'): void {
    this.combo++;
    this.totalMoves++;

    if (quality === 'perfect') {
      this.perfectHits++;
    } else {
      this.goodHits++;
    }

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    const multiplier = this.getMultiplier();
    const basePoints = quality === 'perfect' ? this.PERFECT_POINTS : this.GOOD_POINTS;
    this.score += Math.floor(basePoints * multiplier);

    this.onComboChangeCallbacks.forEach(cb => cb(this.combo, multiplier));
  }

  /**
   * Регистрирует промах - сбрасывает комбо
   */
  miss(): void {
    this.totalMoves++;

    if (this.combo > 0) {
      this.onComboBreakCallbacks.forEach(cb => cb());
    }
    this.combo = 0;
    this.onComboChangeCallbacks.forEach(cb => cb(0, 1));
  }

  /**
   * Множитель очков на основе комбо
   */
  getMultiplier(): number {
    if (this.combo >= 50) return 4;
    if (this.combo >= 25) return 3;
    if (this.combo >= 10) return 2;
    if (this.combo >= 5) return 1.5;
    return 1;
  }

  getCombo(): number {
    return this.combo;
  }

  getMaxCombo(): number {
    return this.maxCombo;
  }

  getScore(): number {
    return this.score;
  }

  addScore(points: number): void {
    this.score += points;
  }

  /**
   * Подписка на изменение комбо
   */
  onComboChange(callback: ComboCallback): void {
    this.onComboChangeCallbacks.push(callback);
  }

  /**
   * Подписка на сброс комбо
   */
  onComboBreak(callback: () => void): void {
    this.onComboBreakCallbacks.push(callback);
  }

  reset(): void {
    this.combo = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.perfectHits = 0;
    this.goodHits = 0;
    this.totalMoves = 0;
  }

  /**
   * Возвращает статистику уровня
   */
  getStats(): LevelStats {
    const total = this.totalMoves;
    const hits = this.perfectHits + this.goodHits;
    return {
      perfect: this.perfectHits,
      good: this.goodHits,
      miss: total - hits,
      total,
      accuracy: total > 0 ? (hits / total) * 100 : 100,
      maxCombo: this.maxCombo,
    };
  }

  /**
   * Сбрасывает статистику уровня (но не score и maxCombo)
   */
  resetLevelStats(): void {
    this.perfectHits = 0;
    this.goodHits = 0;
    this.totalMoves = 0;
    this.combo = 0;
    // НЕ сбрасываем score и maxCombo — они накопительные
  }
}
