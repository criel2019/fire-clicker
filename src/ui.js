/**
 * ui.js
 * Inventory drawer, HUD updates, item interactions
 */

import { CATEGORIES, ITEMS, RARITY_NAMES, RARITY_COLORS } from './items-data.js';

export class UI {
  constructor(gameState, onBurnItem) {
    this.game = gameState;
    this.onBurnItem = onBurnItem;
    this.isDrawerOpen = false;
    this.isAmbientMode = false;
    this.currentCategory = null;
    this.selectedItem = null;
    this._touchStartY = 0;
    this._drawerStartTranslate = 0;

    this._init();
  }

  _init() {
    this._setupDrawer();
    this._setupAmbientToggle();
    this._setupModal();
    this._setupToothpick();
    this._renderCategories();
  }

  /**
   * Setup the toothpick quick-throw button
   */
  _setupToothpick() {
    const btn = document.getElementById('toothpickThrowBtn');
    if (!btn) return;

    // Find toothpick in wood category
    const woodItems = this.game.getAvailableItems('wood');
    const toothpick = woodItems.find(it => it.name === '이쑤시개');

    btn.addEventListener('click', () => {
      btn.classList.remove('throw-flash');
      void btn.offsetWidth;
      btn.classList.add('throw-flash');

      // Close drawer first so the throw arc is fully visible
      this.closeDrawer();

      const targetItem = toothpick || woodItems.find(it => it.rarity === 1);
      if (targetItem) {
        setTimeout(() => this.onBurnItem('wood', targetItem.index), 320);
      }
    });
  }

  /**
   * Setup drawer touch/click interactions
   */
  _setupDrawer() {
    const drawer = document.getElementById('inventoryDrawer');
    const handle = document.getElementById('drawerHandle');

    // Click to toggle
    handle.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleDrawer();
    });

    // Touch drag to open/close
    let startY = 0, startTranslate = 0, isDragging = false;

    handle.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
      drawer.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dy = e.touches[0].clientY - startY;
      if (!this.isDrawerOpen && dy < -20) {
        this.openDrawer();
        isDragging = false;
        drawer.style.transition = '';
      } else if (this.isDrawerOpen && dy > 30) {
        this.closeDrawer();
        isDragging = false;
        drawer.style.transition = '';
      }
    }, { passive: true });

    handle.addEventListener('touchend', () => {
      isDragging = false;
      drawer.style.transition = '';
    }, { passive: true });
  }

  /**
   * Setup ambient mode toggle
   */
  _setupAmbientToggle() {
    const btn = document.getElementById('ambientToggle');
    btn.addEventListener('click', () => {
      this.toggleAmbientMode();
    });
  }

  /**
   * Setup modal
   */
  _setupModal() {
    const modal = document.getElementById('itemModal');
    const backdrop = document.getElementById('modalBackdrop');
    const closeBtn = document.getElementById('modalClose');
    const burnBtn = document.getElementById('burnBtn');

    backdrop.addEventListener('click', () => this.closeModal());
    closeBtn.addEventListener('click', () => this.closeModal());
    burnBtn.addEventListener('click', () => {
      if (this.selectedItem) {
        this.onBurnItem(this.selectedItem.categoryId, this.selectedItem.index);
        this.closeModal();
        this.closeDrawer();
      }
    });
  }

  /**
   * Toggle drawer open/close
   */
  toggleDrawer() {
    if (this.isDrawerOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    const drawer = document.getElementById('inventoryDrawer');
    drawer.classList.add('open');
    this.isDrawerOpen = true;

    // Load first unlocked category if none selected
    if (!this.currentCategory) {
      const unlocked = this.game.getUnlockedCategories();
      if (unlocked.length > 0) {
        this.selectCategory(unlocked[0].id);
      }
    }
  }

  closeDrawer() {
    const drawer = document.getElementById('inventoryDrawer');
    drawer.classList.remove('open');
    this.isDrawerOpen = false;
  }

  /**
   * Toggle ambient mode (hide all UI)
   */
  toggleAmbientMode() {
    this.isAmbientMode = !this.isAmbientMode;
    document.getElementById('app').classList.toggle('ambient-mode', this.isAmbientMode);
    if (this.isAmbientMode) {
      this.closeDrawer();
    }
  }

  /**
   * Render category tabs
   */
  _renderCategories() {
    const container = document.getElementById('categoryTabs');
    const allCats = this.game.getAllCategories();

    container.innerHTML = '';
    for (const cat of allCats) {
      const tab = document.createElement('div');
      tab.className = `cat-tab ${cat.unlocked ? '' : 'locked'} ${this.currentCategory === cat.id ? 'active' : ''}`;
      tab.dataset.catId = cat.id;

      if (cat.unlocked) {
        tab.textContent = `${cat.icon} ${cat.name}`;
        tab.addEventListener('click', () => this.selectCategory(cat.id));
      } else {
        tab.textContent = `🔒 Lv.${cat.unlockLevel}`;
        tab.style.opacity = '0.4';
      }

      container.appendChild(tab);
    }
  }

  /**
   * Select a category and render its items
   */
  selectCategory(categoryId) {
    this.currentCategory = categoryId;

    // Update active tab
    document.querySelectorAll('.cat-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.catId === categoryId);
    });

    // Render items
    this._renderItems(categoryId);
  }

  /**
   * Render items for a category
   * — 2-column layout, category emoji icon, direct-throw for rarity ≤ 2
   */
  _renderItems(categoryId) {
    const grid = document.getElementById('itemGrid');
    const items = this.game.getAvailableItems(categoryId);
    const category = CATEGORIES.find(c => c.id === categoryId);
    const catIcon = category ? category.icon : '📦';

    grid.innerHTML = '';
    for (const item of items) {
      const rarityLabel = ['', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'][item.rarity];
      const card = document.createElement('div');
      card.className = `item-card rarity-${rarityLabel} ${item.unlocked ? '' : 'locked'}`;

      // Rarity dot
      const dot = document.createElement('div');
      dot.className = 'item-rarity-dot';
      dot.style.backgroundColor = RARITY_COLORS[item.rarity];
      dot.style.color = RARITY_COLORS[item.rarity];
      card.appendChild(dot);

      // Icon — category emoji
      const icon = document.createElement('div');
      icon.className = 'item-icon';
      icon.textContent = catIcon;
      card.appendChild(icon);

      // Info (name + description)
      const info = document.createElement('div');
      info.className = 'item-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'item-name';
      nameEl.textContent = item.name;
      info.appendChild(nameEl);

      const descEl = document.createElement('div');
      descEl.className = 'item-desc';
      descEl.textContent = item.description;
      info.appendChild(descEl);

      card.appendChild(info);

      // Click handler
      if (item.unlocked) {
        card.addEventListener('click', () => {
          if (item.rarity <= 2) {
            // Direct throw for common/uncommon
            this.onBurnItem(categoryId, item.index);
            card.classList.remove('burning-flash');
            void card.offsetWidth;
            card.classList.add('burning-flash');
            setTimeout(() => card.classList.remove('burning-flash'), 300);
            this.closeDrawer();
          } else {
            // Modal for rare+
            this.showItemModal(categoryId, item);
          }
        });
      }

      grid.appendChild(card);
    }
  }

  /**
   * Show item detail modal
   */
  showItemModal(categoryId, item) {
    const modal = document.getElementById('itemModal');
    const iconEl = document.getElementById('modalIcon');
    const nameEl = document.getElementById('modalName');
    const descEl = document.getElementById('modalDesc');
    const rarityEl = document.getElementById('modalRarity');
    const burnEl = document.getElementById('modalBurn');

    iconEl.textContent = item.name.substring(0, 2);
    iconEl.style.borderColor = RARITY_COLORS[item.rarity];
    iconEl.style.color = RARITY_COLORS[item.rarity];
    iconEl.style.fontSize = '20px';

    nameEl.textContent = item.name;
    descEl.textContent = item.description;

    rarityEl.textContent = RARITY_NAMES[item.rarity];
    rarityEl.style.color = RARITY_COLORS[item.rarity];
    rarityEl.style.borderColor = RARITY_COLORS[item.rarity];

    burnEl.textContent = `🔥 ${item.burnValue}`;

    this.selectedItem = { categoryId, index: item.index, ...item };

    modal.classList.remove('hidden');
  }

  /**
   * Close item modal
   */
  closeModal() {
    document.getElementById('itemModal').classList.add('hidden');
    this.selectedItem = null;
  }

  /**
   * Update HUD display
   */
  updateHUD() {
    // Level
    document.getElementById('fireLevelText').textContent = `Lv.${this.game.level}`;

    // XP bar
    const xpPct = (this.game.xp / this.game.xpToNext) * 100;
    document.getElementById('xpFill').style.width = `${xpPct}%`;

    // Currency
    document.getElementById('ashValue').textContent = this._formatNumber(Math.floor(this.game.ash));
    document.getElementById('emberValue').textContent = this._formatNumber(this.game.ember);

    // Temperature
    const temp = Math.floor(this.game.temperature);
    document.getElementById('tempText').textContent = `${temp}°C`;
    const tempPct = Math.min(100, ((temp - 100) / 1900) * 100);
    document.getElementById('tempFill').style.height = `${tempPct}%`;
  }

  /**
   * Refresh categories (after unlock)
   */
  refreshCategories() {
    this._renderCategories();
    if (this.currentCategory) {
      this._renderItems(this.currentCategory);
    }
  }

  /**
   * Format large numbers
   */
  _formatNumber(num) {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
  }
}
