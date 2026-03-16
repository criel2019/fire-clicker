/**
 * cooking.js
 * Campfire cooking system - roast marshmallows, potatoes, etc.
 * Healing / chill feature for 불키우기
 */

import { floatingNumber } from './effects.js';

// ── Constants ──
const MAX_SLOTS = 2;
const COOK_SPEED_BASE = 0.5;
const COOK_SPEED_SCALE = 0.8;
const BURN_SPEED_MULT = 0.5;
const PERFECT_THRESHOLD = 0.4;
const MIN_FIRE_TEMP = 30;
const MIN_COOK_INTENSITY = 0.05;

// ── Cooking item definitions ──
export const COOKING_ITEMS = [
  {
    id: 'marshmallow',
    name: '마시멜로',
    icon: '🍡',
    cookTime: 8,
    burnTime: 5,
    reward: { ash: 50, xp: 20 },
    perfectReward: { ash: 120, xp: 60, ember: 1 },
    burntReward: { ash: 10, xp: 5 },
    description: '노릇노릇 구우면 꿀맛',
    unlockLevel: 1,
  },
  {
    id: 'sweet_potato',
    name: '고구마',
    icon: '🍠',
    cookTime: 18,
    burnTime: 8,
    reward: { ash: 150, xp: 50 },
    perfectReward: { ash: 350, xp: 120, ember: 3 },
    burntReward: { ash: 30, xp: 10 },
    description: '겨울 캠핑의 로망',
    unlockLevel: 2,
  },
  {
    id: 'corn',
    name: '옥수수',
    icon: '🌽',
    cookTime: 12,
    burnTime: 6,
    reward: { ash: 80, xp: 30 },
    perfectReward: { ash: 200, xp: 80, ember: 2 },
    burntReward: { ash: 15, xp: 8 },
    description: '불에 구운 간식의 정석',
    unlockLevel: 3,
  },
  {
    id: 'sausage',
    name: '소시지',
    icon: '🌭',
    cookTime: 10,
    burnTime: 4,
    reward: { ash: 60, xp: 25 },
    perfectReward: { ash: 150, xp: 65, ember: 1 },
    burntReward: { ash: 12, xp: 6 },
    description: '캠프파이어 필수템',
    unlockLevel: 1,
  },
  {
    id: 'potato',
    name: '감자',
    icon: '🥔',
    cookTime: 20,
    burnTime: 10,
    reward: { ash: 130, xp: 45 },
    perfectReward: { ash: 300, xp: 110, ember: 2 },
    burntReward: { ash: 25, xp: 8 },
    description: '호일에 싸서 묻어두면',
    unlockLevel: 4,
  },
  {
    id: 'chestnut',
    name: '밤',
    icon: '🌰',
    cookTime: 14,
    burnTime: 5,
    reward: { ash: 90, xp: 35 },
    perfectReward: { ash: 220, xp: 90, ember: 2 },
    burntReward: { ash: 18, xp: 7 },
    description: '톡! 하고 터지면 완성',
    unlockLevel: 5,
  },
];

export class CookingSystem {
  constructor(gameState, soundManager) {
    this.game = gameState;
    this.sound = soundManager;
    this.slots = []; // { item, state, timer, cookTime, burnTime }
    this.menuOpen = false;

    this._restoreSlots();
    this._initUI();
    this._setupOutsideClick();
  }

  // ── Save / Load ──

  _restoreSlots() {
    const saved = this.game.cookingSlots;
    if (!saved || !saved.length) return;

    for (const s of saved) {
      const item = COOKING_ITEMS.find(i => i.id === s.itemId);
      if (item) {
        this.slots.push({
          item,
          state: s.state || 'cooking',
          timer: s.timer || 0,
          cookTime: item.cookTime,
          burnTime: item.burnTime,
        });
      }
    }

    // Defer render until DOM is ready
    requestAnimationFrame(() => this._renderSlots());
  }

  _syncSave() {
    this.game.cookingSlots = this.slots.map(s => ({
      itemId: s.item.id,
      state: s.state,
      timer: s.timer,
    }));
  }

  // ── UI Init ──

  _initUI() {
    const menuBtn = document.getElementById('cookingMenuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu();
      });
    }

    const closeBtn = document.getElementById('cookingMenuClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeMenu());
    }

    this._renderMenu();
  }

  _setupOutsideClick() {
    document.addEventListener('pointerdown', (e) => {
      if (!this.menuOpen) return;
      if (!e.target.closest('#cookingMenu') && !e.target.closest('#cookingMenuBtn')) {
        this.closeMenu();
      }
    });
  }

  // ── Menu ──

  toggleMenu() {
    if (this.menuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    const menu = document.getElementById('cookingMenu');
    if (menu) {
      menu.classList.remove('hidden');
      this.menuOpen = true;
      this._renderMenu();
    }
  }

  closeMenu() {
    const menu = document.getElementById('cookingMenu');
    if (menu) {
      menu.classList.add('hidden');
      this.menuOpen = false;
    }
  }

  _renderMenu() {
    const list = document.getElementById('cookingMenuList');
    if (!list) return;

    list.innerHTML = '';
    for (const item of COOKING_ITEMS) {
      const unlocked = this.game.level >= item.unlockLevel;
      const el = document.createElement('div');
      el.className = `cooking-menu-item ${unlocked ? '' : 'locked'}`;
      el.innerHTML = `
        <span class="cm-icon">${item.icon}</span>
        <div class="cm-info">
          <div class="cm-name">${item.name}</div>
          <div class="cm-time">${item.cookTime}초 ${unlocked ? '' : `(Lv.${item.unlockLevel})`}</div>
        </div>
        <span class="cm-reward">+${item.perfectReward.ash}</span>
      `;

      if (unlocked) {
        el.addEventListener('click', () => {
          this.startCooking(item);
          this.closeMenu();
        });
      }

      list.appendChild(el);
    }
  }

  // ── Helpers ──

  _getCookingAreaX() {
    const area = document.getElementById('cookingArea');
    if (area) {
      const rect = area.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }
    return 60;
  }

  // ── Cooking Logic ──

  startCooking(itemDef) {
    if (this.slots.length >= MAX_SLOTS) {
      floatingNumber('가득 참!', window.innerWidth / 2, window.innerHeight * 0.4, 'normal');
      return;
    }

    if (this.game.temperature < MIN_FIRE_TEMP) {
      floatingNumber('불이 약해요', window.innerWidth / 2, window.innerHeight * 0.4, 'normal');
      return;
    }

    const slot = {
      item: itemDef,
      state: 'cooking',
      timer: 0,
      cookTime: itemDef.cookTime,
      burnTime: itemDef.burnTime,
    };

    this.slots.push(slot);
    this._syncSave();
    this._renderSlots();

    if (this.sound) {
      this.sound.playWhoosh();
    }
  }

  /**
   * Called each frame
   */
  update(dt) {
    if (this.slots.length === 0) return;

    const intensity = this.game.getFireIntensity();
    const firePaused = intensity < MIN_COOK_INTENSITY;

    // Visual feedback when fire is out (M-1)
    const container = document.getElementById('cookingSlots');
    if (container) {
      container.classList.toggle('fire-out', firePaused);
    }

    if (firePaused) return;

    const speedMult = COOK_SPEED_BASE + intensity * COOK_SPEED_SCALE;

    let changed = false;
    const x = this._getCookingAreaX();

    for (const slot of this.slots) {
      if (slot.state === 'cooking') {
        slot.timer += dt * speedMult;
        if (slot.timer >= slot.cookTime) {
          slot.state = 'done';
          slot.timer = 0;
          changed = true;

          floatingNumber(`${slot.item.icon} 완성!`, x, window.innerHeight * 0.45, 'big');
          if (this.sound) this.sound.playFireball();
        }
      } else if (slot.state === 'done') {
        slot.timer += dt * speedMult * BURN_SPEED_MULT;
        if (slot.timer >= slot.burnTime) {
          slot.state = 'burnt';
          changed = true;
          floatingNumber(`${slot.item.icon} 탔다...`, x, window.innerHeight * 0.45, 'normal');
        }
      }
    }

    if (changed) {
      this._syncSave();
      this._renderSlots();
    } else {
      this._updateSlotProgress();
    }
  }

  /**
   * Harvest a cooking slot (tap to collect)
   */
  harvest(slotIndex) {
    const slot = this.slots[slotIndex];
    if (!slot) return;

    const x = this._getCookingAreaX();
    let reward;
    let label;
    let size;

    if (slot.state === 'done') {
      const burnProgress = slot.timer / slot.burnTime;
      if (burnProgress < PERFECT_THRESHOLD) {
        reward = slot.item.perfectReward;
        label = '완벽!';
        size = 'big';
      } else {
        reward = slot.item.reward;
        label = '맛있다';
        size = 'normal';
      }
    } else if (slot.state === 'burnt') {
      reward = slot.item.burntReward;
      label = '탔지만...';
      size = 'normal';
    } else {
      // cooking state - too early
      floatingNumber('아직 덜 익었어요', x, window.innerHeight * 0.42, 'normal');
      return;
    }

    // Safety: reward should never be undefined here, but guard just in case
    if (!reward) {
      reward = { ash: 0, xp: 0 };
    }

    // Apply rewards
    this.game.ash += reward.ash;
    this.game.addXP(reward.xp);
    if (reward.ember) this.game.ember += reward.ember;

    // Visual feedback
    floatingNumber(`${slot.item.icon} ${label} +${reward.ash}`, x, window.innerHeight * 0.40, size);

    // Track cooking stats
    const cookKey = `cook_${slot.item.id}`;
    this.game.itemsBurned[cookKey] = (this.game.itemsBurned[cookKey] || 0) + 1;

    // Sound - differentiate by result quality (M-4)
    if (this.sound) {
      if (size === 'big') {
        this.sound.playFireball();
      } else {
        this.sound.playWhoosh();
      }
    }

    // Remove slot
    this.slots.splice(slotIndex, 1);
    this._syncSave();
    this._renderSlots();
  }

  _renderSlots() {
    const container = document.getElementById('cookingSlots');
    if (!container) return;

    container.innerHTML = '';
    this.slots.forEach((slot, i) => {
      const el = document.createElement('div');
      el.className = 'cooking-slot';
      el.dataset.state = slot.state;
      el.dataset.index = i;

      const fill = document.createElement('div');
      fill.className = 'cooking-fill';
      el.appendChild(fill);

      const icon = document.createElement('span');
      icon.className = 'cooking-icon';
      icon.textContent = slot.item.icon;
      el.appendChild(icon);

      if (slot.state === 'done') {
        const label = document.createElement('span');
        label.className = 'cooking-label';
        label.textContent = '완성!';
        el.appendChild(label);
      } else if (slot.state === 'burnt') {
        const label = document.createElement('span');
        label.className = 'cooking-label';
        label.textContent = '탔다';
        el.appendChild(label);
      }

      // Update progress
      if (slot.state === 'cooking') {
        const pct = Math.min(100, (slot.timer / slot.cookTime) * 100);
        fill.style.height = `${pct}%`;
      } else if (slot.state === 'done') {
        // Show remaining time as decreasing fill (burn countdown)
        const burnPct = Math.min(100, (slot.timer / slot.burnTime) * 100);
        fill.style.height = `${100 - burnPct}%`;
      }

      // Use dataset index for click handler to avoid closure bugs (C-3)
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(el.dataset.index, 10);
        this.harvest(idx);
      });

      container.appendChild(el);
    });
  }

  _updateSlotProgress() {
    const container = document.getElementById('cookingSlots');
    if (!container) return;

    const slotEls = container.querySelectorAll('.cooking-slot');
    slotEls.forEach((el, i) => {
      const slot = this.slots[i];
      if (!slot) return;
      const fill = el.querySelector('.cooking-fill');
      if (!fill) return;

      if (slot.state === 'cooking') {
        const pct = Math.min(100, (slot.timer / slot.cookTime) * 100);
        fill.style.height = `${pct}%`;
      } else if (slot.state === 'done') {
        // Burn countdown: fill shrinks as burn progresses, color shifts to red
        const burnPct = Math.min(100, (slot.timer / slot.burnTime) * 100);
        fill.style.height = `${100 - burnPct}%`;
        if (burnPct > 60) {
          const g = Math.round(255 - burnPct * 2);
          fill.style.background = `linear-gradient(0deg, rgba(255,${g},40,0.35), rgba(255,80,20,0.15))`;
        }
      }
    });
  }
}
