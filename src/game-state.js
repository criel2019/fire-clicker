/**
 * game-state.js
 * Game state management, progression, and save/load
 */

import { CATEGORIES, ITEMS, RARITY_NAMES } from './items-data.js';

const SAVE_KEY = 'fire_clicker_save';
const AUTO_SAVE_INTERVAL = 15000; // 15 seconds

// Level XP requirements (exponential curve)
function xpForLevel(level) {
  return Math.floor(50 * Math.pow(1.15, level - 1));
}

// Temperature decay rate per second
const TEMP_DECAY_RATE = 0.8;
const BASE_TEMP = 0;     // No auto-recovery — fire must be fed
const MAX_TEMP = 1000;   // Max reachable temperature

export class GameState {
  constructor() {
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpForLevel(1);
    this.totalXp = 0;
    this.ash = 0; // basic currency
    this.ember = 0; // premium currency
    this.temperature = 200; // Small fire right after striking a match
    this.baseIntensity = 0.4;
    this.totalBurned = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboDecay = 5; // seconds until combo resets (was 3, too tight)
    this.maxCombo = 0;
    this.itemsBurned = {}; // { itemKey: count }
    this.unlockedCategories = ['paper', 'wood']; // start with basic categories
    this.achievements = [];
    this.totalPlayTime = 0;
    this.lastSaveTime = Date.now();
    this.lastActiveTime = Date.now();
    this.burnLog = []; // Array of { name, icon, timestamp, burnValue, rarity, effectType }
    this.stats = {
      totalClicks: 0,
      highestTemp: 200,
      longestCombo: 0,
      itemsBurnedTotal: 0,
      explosionsTriggered: 0,
      fireworksLaunched: 0,
    };

    // Category unlock levels
    this.categoryUnlockLevels = {
      paper: 1, wood: 1,
      food: 2, clothing: 4,
      flammable: 6, firework: 8,
      electronics: 10, furniture: 12,
      work: 5, emotion: 7,
      luxury: 15, sports: 9,
      vehicle: 18, building: 22,
      fantasy: 14, history: 16,
      toy: 11, music: 13,
      animal: 17, gag: 3,
    };

    // Callbacks
    this.onLevelUp = null;
    this.onAchievement = null;
    this.onCategoryUnlock = null;

    this._autoSaveTimer = null;
  }

  /**
   * Initialize: load save and start auto-save
   */
  init() {
    this.load();
    this._startAutoSave();
    this._processIdleGains();
    return this;
  }

  /**
   * Get current fire intensity based on temperature
   * temp 0 = 0.0 (extinguished), temp 1000 = 1.5 (max)
   * Ember state (temp < 50): 0.0~0.15 (barely visible)
   */
  getFireIntensity() {
    const t = Math.max(0, Math.min(1, this.temperature / MAX_TEMP));
    return t * 1.5;
  }

  /**
   * True when fire is a dying ember (not yet out)
   */
  isEmber() {
    return this.temperature > 0 && this.temperature < 50;
  }

  /**
   * True when fire is completely extinguished
   */
  isExtinguished() {
    return this.temperature <= 0;
  }

  /**
   * Revive a dying ember by blowing on it / tapping
   */
  reviveFromEmber() {
    if (this.temperature > 0 && this.temperature < 80) {
      this.temperature = Math.min(150, this.temperature + 40);
      return true;
    }
    return false;
  }

  /**
   * Add fuel (from clicking fire) — small nudge that keeps embers alive
   */
  addClickFuel() {
    // Re-strike: if fire is extinguished, tapping lights a new match
    if (this.temperature <= 0) {
      this.temperature = 100;
      this.ash += 1;
      this.stats.totalClicks++;
      if (this.temperature > this.stats.highestTemp) {
        this.stats.highestTemp = this.temperature;
      }
      this.combo = 0;
      this.comboTimer = 0;
      return 100;
    }

    const fuelValue = 2 + this.level * 0.05;
    this.temperature = Math.min(MAX_TEMP, this.temperature + fuelValue);
    this.ash += 1;
    this.stats.totalClicks++;
    if (this.temperature > this.stats.highestTemp) {
      this.stats.highestTemp = this.temperature;
    }
    this._updateCombo();
    return fuelValue;
  }

  /**
   * Burn an item
   * @param {string} categoryId
   * @param {number} itemIndex
   * @returns {object} burn result with effects info
   */
  burnItem(categoryId, itemIndex) {
    const items = ITEMS[categoryId];
    if (!items || !items[itemIndex]) return null;

    const [name, rarity, burnValue, effectType, description] = items[itemIndex];

    // Combo bonus
    this._updateCombo();
    const comboMultiplier = 1 + (this.combo - 1) * 0.15;
    const actualBurnValue = Math.floor(burnValue * comboMultiplier);

    // Apply burn — toothpick (burnValue=1): +2.5 temp, fades in 5~6 seconds
    this.temperature = Math.min(MAX_TEMP, this.temperature + actualBurnValue * 2.5);

    // XP gain
    const xpGain = Math.floor(burnValue * 0.5 * comboMultiplier);
    this.addXP(xpGain);

    // Currency gain
    const ashGain = Math.floor(burnValue * 0.8 * comboMultiplier);
    const emberGain = rarity >= 4 ? Math.floor(rarity * comboMultiplier) : 0;
    this.ash += ashGain;
    this.ember += emberGain;

    // Stats
    this.totalBurned++;
    this.stats.itemsBurnedTotal++;
    const itemKey = `${categoryId}_${itemIndex}`;
    this.itemsBurned[itemKey] = (this.itemsBurned[itemKey] || 0) + 1;

    if (effectType === 'explosion' || effectType === 'inferno') {
      this.stats.explosionsTriggered++;
    }
    if (effectType === 'firework') {
      this.stats.fireworksLaunched++;
    }
    if (this.temperature > this.stats.highestTemp) {
      this.stats.highestTemp = this.temperature;
    }

    // Check achievements
    this._checkAchievements();

    const result = {
      name,
      rarity,
      burnValue: actualBurnValue,
      effectType,
      description,
      xpGain,
      ashGain,
      emberGain,
      combo: this.combo,
      comboMultiplier,
    };

    // Record in burn log
    this.addBurnLog({
      name: result.name,
      icon: categoryId,
      burnValue: result.burnValue,
      rarity: result.rarity,
      effectType: result.effectType,
    });

    return result;
  }

  /**
   * Add an entry to the burn log (most recent first, max 100)
   */
  addBurnLog(entry) {
    this.burnLog.unshift({ ...entry, timestamp: Date.now() });
    if (this.burnLog.length > 100) this.burnLog.pop(); // max 100 entries
  }

  /**
   * Get the burn log
   */
  getBurnLog() {
    return this.burnLog;
  }

  /**
   * Add XP and handle level ups
   */
  addXP(amount) {
    this.xp += amount;
    this.totalXp += amount;

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpForLevel(this.level);
      this.baseIntensity = Math.min(2.0, 0.4 + this.level * 0.03);

      // Check for category unlocks
      for (const [catId, unlockLv] of Object.entries(this.categoryUnlockLevels)) {
        if (unlockLv === this.level && !this.unlockedCategories.includes(catId)) {
          this.unlockedCategories.push(catId);
          const cat = CATEGORIES.find(c => c.id === catId);
          if (this.onCategoryUnlock && cat) {
            this.onCategoryUnlock(cat);
          }
        }
      }

      if (this.onLevelUp) {
        this.onLevelUp(this.level);
      }
    }
  }

  /**
   * Update combo system
   */
  _updateCombo() {
    if (this.comboTimer > 0) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.comboTimer = this.comboDecay;

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
      this.stats.longestCombo = this.maxCombo;
    }
  }

  /**
   * Per-frame update
   */
  update(dt) {
    // Temperature decays over time — including ember state
    // Higher temperature decays faster (big fires burn through fuel quickly)
    if (this.temperature > 0) {
      const decayRate = TEMP_DECAY_RATE + (this.temperature / MAX_TEMP) * 1.5;
      this.temperature = Math.max(0, this.temperature - decayRate * dt);
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.comboTimer = 0;
      }
    }

    // Idle ash generation (slow)
    this.ash += 0.1 * this.level * dt;

    // Play time
    this.totalPlayTime += dt;
  }

  /**
   * Get available items for a category (considering level)
   */
  getAvailableItems(categoryId) {
    const items = ITEMS[categoryId];
    if (!items) return [];

    return items.map((item, index) => {
      const [name, rarity, burnValue, effectType, description] = item;
      // Higher rarity items unlock at higher levels
      const requiredLevel = Math.max(1, (rarity - 1) * 5 + 1);
      const unlocked = this.level >= requiredLevel;
      return {
        index,
        name,
        rarity,
        burnValue,
        effectType,
        description,
        unlocked,
        burnCount: this.itemsBurned[`${categoryId}_${index}`] || 0,
      };
    });
  }

  /**
   * Get unlocked categories
   */
  getUnlockedCategories() {
    return CATEGORIES.filter(cat => this.unlockedCategories.includes(cat.id));
  }

  /**
   * Get all categories with lock status
   */
  getAllCategories() {
    return CATEGORIES.map(cat => ({
      ...cat,
      unlocked: this.unlockedCategories.includes(cat.id),
      unlockLevel: this.categoryUnlockLevels[cat.id] || 1,
    }));
  }

  /**
   * Check and grant achievements
   */
  _checkAchievements() {
    const checks = [
      ['first_burn', '첫 불꽃', '첫 아이템을 태웠다!', () => this.totalBurned >= 1],
      ['burn_100', '불장난', '100개의 아이템을 태웠다', () => this.totalBurned >= 100],
      ['burn_500', '방화범', '500개의 아이템을 태웠다', () => this.totalBurned >= 500],
      ['burn_1000', '화염의 군주', '1000개의 아이템을 태웠다', () => this.totalBurned >= 1000],
      ['level_10', '불씨 지킴이', '레벨 10 달성', () => this.level >= 10],
      ['level_25', '화염 술사', '레벨 25 달성', () => this.level >= 25],
      ['level_50', '불의 정령', '레벨 50 달성', () => this.level >= 50],
      ['combo_10', '연쇄 방화', '10 콤보 달성', () => this.maxCombo >= 10],
      ['combo_30', '콤보 마스터', '30 콤보 달성', () => this.maxCombo >= 30],
      ['temp_500', '뜨거운 사나이', '500°C 도달', () => this.stats.highestTemp >= 500],
      ['temp_1000', '용광로', '950°C 도달', () => this.stats.highestTemp >= 950],
      ['temp_max', '태양의 핵', '최고 온도 달성!', () => this.stats.highestTemp >= 990],
      ['ash_10000', '재벌', '재 10,000개 수집', () => this.ash >= 10000],
      ['clicks_1000', '클리커 마스터', '1000번 클릭', () => this.stats.totalClicks >= 1000],
      ['explosions_10', '폭파 전문가', '폭발 10회', () => this.stats.explosionsTriggered >= 10],
      ['fireworks_5', '불꽃놀이 장인', '불꽃놀이 5회', () => this.stats.fireworksLaunched >= 5],
    ];

    for (const [id, title, desc, check] of checks) {
      if (!this.achievements.includes(id) && check()) {
        this.achievements.push(id);
        if (this.onAchievement) {
          this.onAchievement(title, desc);
        }
      }
    }
  }

  /**
   * Process idle gains when returning to the game
   * Calculates offline temperature decay — fire slowly dies but embers linger
   */
  _processIdleGains() {
    const now = Date.now();
    const idleTime = Math.min((now - this.lastActiveTime) / 1000, 3600 * 8); // max 8 hours

    if (idleTime > 10) {
      // Simulate temperature decay over idle period
      // Use average decay rate for simplicity
      const avgDecayRate = TEMP_DECAY_RATE + (this.temperature / MAX_TEMP) * 1.5;
      const idleDecay = avgDecayRate * idleTime;
      // Keep a tiny ember alive — fire doesn't vanish instantly
      this.temperature = Math.max(5, this.temperature - idleDecay);

      // Small idle ash gain
      const idleAsh = Math.floor(idleTime * 0.05 * this.level * 0.5);
      this.ash += idleAsh;
    }

    this.lastActiveTime = now;
  }

  /**
   * Save to localStorage
   */
  save() {
    const data = {
      version: 1,
      level: this.level,
      xp: this.xp,
      totalXp: this.totalXp,
      ash: Math.floor(this.ash),
      ember: this.ember,
      temperature: this.temperature,
      baseIntensity: this.baseIntensity,
      totalBurned: this.totalBurned,
      maxCombo: this.maxCombo,
      itemsBurned: this.itemsBurned,
      unlockedCategories: this.unlockedCategories,
      achievements: this.achievements,
      totalPlayTime: this.totalPlayTime,
      stats: this.stats,
      lastSaveTime: Date.now(),
      lastActiveTime: Date.now(),
      burnLog: this.burnLog,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.version !== 1) return false;

      this.level = data.level || 1;
      this.xp = data.xp || 0;
      this.xpToNext = xpForLevel(this.level);
      this.totalXp = data.totalXp || 0;
      this.ash = data.ash || 0;
      this.ember = data.ember || 0;
      this.temperature = data.temperature ?? 200;
      this.baseIntensity = data.baseIntensity || 0.4;
      this.totalBurned = data.totalBurned || 0;
      this.maxCombo = data.maxCombo || 0;
      this.itemsBurned = data.itemsBurned || {};
      this.unlockedCategories = data.unlockedCategories || ['paper', 'wood'];
      this.achievements = data.achievements || [];
      this.totalPlayTime = data.totalPlayTime || 0;
      this.stats = { ...this.stats, ...data.stats };
      this.lastSaveTime = data.lastSaveTime || Date.now();
      this.lastActiveTime = data.lastActiveTime || Date.now();
      this.burnLog = data.burnLog || [];

      return true;
    } catch (e) {
      console.warn('Load failed:', e);
      return false;
    }
  }

  /**
   * Start auto-save timer
   */
  _startAutoSave() {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
    this._autoSaveTimer = setInterval(() => this.save(), AUTO_SAVE_INTERVAL);

    // Save on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.save();
    });
    window.addEventListener('beforeunload', () => this.save());
  }

  /**
   * Reset all progress
   */
  reset() {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
}
