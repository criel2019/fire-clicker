/**
 * cooking.js
 * Campfire cooking system - roast marshmallows, potatoes, etc.
 * Healing / chill feature for 불키우기
 */

import { floatingNumber, showAchievement } from './effects.js';

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

const MAX_SLOTS = 2;

export class CookingSystem {
  constructor(gameState, soundManager) {
    this.game = gameState;
    this.sound = soundManager;
    this.slots = []; // { item, state, timer, cookTime, burnTime }
    this.menuOpen = false;

    this._initUI();
  }

  _initUI() {
    // Menu button
    const menuBtn = document.getElementById('cookingMenuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu();
      });
    }

    // Menu close
    const closeBtn = document.getElementById('cookingMenuClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeMenu());
    }

    // Render menu items
    this._renderMenu();
  }

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

  startCooking(itemDef) {
    if (this.slots.length >= MAX_SLOTS) {
      // All slots full
      floatingNumber('가득 참!', window.innerWidth / 2, window.innerHeight * 0.4, 'normal');
      return;
    }

    // Fire must be alive
    if (this.game.temperature < 30) {
      floatingNumber('불이 약해요', window.innerWidth / 2, window.innerHeight * 0.4, 'normal');
      return;
    }

    const slot = {
      item: itemDef,
      state: 'cooking', // 'cooking' | 'done' | 'burnt'
      timer: 0,
      cookTime: itemDef.cookTime,
      burnTime: itemDef.burnTime,
    };

    this.slots.push(slot);
    this._renderSlots();

    if (this.sound) {
      this.sound.playClick();
    }
  }

  /**
   * Called each frame
   */
  update(dt) {
    if (this.slots.length === 0) return;

    // Fire intensity affects cooking speed
    const intensity = this.game.getFireIntensity();
    if (intensity < 0.05) return; // fire is out, cooking stops

    const speedMult = 0.5 + intensity * 0.8; // 0.5x at low fire, 1.7x at max

    let changed = false;
    for (const slot of this.slots) {
      if (slot.state === 'cooking') {
        slot.timer += dt * speedMult;
        if (slot.timer >= slot.cookTime) {
          slot.state = 'done';
          slot.timer = 0;
          changed = true;

          // Notify
          floatingNumber(`${slot.item.icon} 완성!`, 60, window.innerHeight * 0.45, 'big');
          if (this.sound) this.sound.playClick();
        }
      } else if (slot.state === 'done') {
        slot.timer += dt * speedMult * 0.5; // burns slower
        if (slot.timer >= slot.burnTime) {
          slot.state = 'burnt';
          changed = true;
          floatingNumber(`${slot.item.icon} 탔다...`, 60, window.innerHeight * 0.45, 'normal');
        }
      }
    }

    if (changed) {
      this._renderSlots();
    } else {
      // Update progress bars smoothly
      this._updateSlotProgress();
    }
  }

  /**
   * Harvest a cooking slot (tap to collect)
   */
  harvest(slotIndex) {
    const slot = this.slots[slotIndex];
    if (!slot) return;

    let reward;
    let label;
    let size;

    if (slot.state === 'done') {
      // Perfect cook within the first 40% of burn window = perfect
      const burnProgress = slot.timer / slot.burnTime;
      if (burnProgress < 0.4) {
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
    } else if (slot.state === 'cooking') {
      // Too early - still raw
      floatingNumber('아직 덜 익었어요', 60, window.innerHeight * 0.42, 'normal');
      return;
    }

    // Apply rewards
    this.game.ash += reward.ash;
    this.game.addXP(reward.xp);
    if (reward.ember) this.game.ember += reward.ember;

    // Visual feedback
    floatingNumber(`${slot.item.icon} ${label} +${reward.ash}`, 60, window.innerHeight * 0.40, size);

    // Track cooking stats
    const cookKey = `cook_${slot.item.id}`;
    this.game.itemsBurned[cookKey] = (this.game.itemsBurned[cookKey] || 0) + 1;

    // Sound
    if (this.sound) this.sound.playClick();

    // Remove slot
    this.slots.splice(slotIndex, 1);
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
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.harvest(i);
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
        // Show burn progress (green → red)
        const burnPct = Math.min(100, (slot.timer / slot.burnTime) * 100);
        fill.style.height = '100%';
        if (burnPct > 60) {
          fill.style.background = `linear-gradient(0deg, rgba(255,${Math.round(160 - burnPct * 1.2)},40,0.35), rgba(255,80,20,0.15))`;
        }
      }
    });
  }
}
