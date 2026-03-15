/**
 * main.js
 * Entry point - orchestrates all systems
 * 불키우기 (Fire Clicker) - A healing fire-gazing clicker game
 */

import './style.css';
import { FireEngine } from './fire-engine.js';
import { ParticleSystem } from './particles.js';
import { Background } from './background.js';
import { GameState } from './game-state.js';
import { SoundManager } from './sound-manager.js';
import { UI } from './ui.js';
import {
  initFireworks, launchFireworks, screenShake, flash,
  floatingNumber, showCombo, showAchievement, throwItem,
  tapRipple, updateFireGlow,
} from './effects.js';
import { Intro } from './intro.js';
import { NPCSystem } from './npc.js';
import { ToothpickLayer } from './toothpick-layer.js';
import { ITEMS, CATEGORIES } from './items-data.js';

// ============ GLOBALS ============
let fireEngine, particles, background, gameState, soundManager, ui;
let npcSystem;
let toothpickLayer;
let lastTime = 0;
let isRunning = false;

// Fire center position (screen coordinates)
let fireCenterX = window.innerWidth / 2;
let fireCenterY = window.innerHeight * 0.55;

// ============ INITIALIZATION ============
async function init() {
  // Get canvas elements
  const fireCanvas = document.getElementById('fireCanvas');
  const particleCanvas = document.getElementById('particleCanvas');
  const bgCanvas = document.getElementById('bgCanvas');
  const groundCanvas = document.getElementById('groundCanvas');
  const fwContainer = document.getElementById('fireworksContainer');

  // Initialize systems
  fireEngine = new FireEngine(fireCanvas);
  particles = new ParticleSystem(particleCanvas);
  background = new Background(bgCanvas, groundCanvas);
  gameState = new GameState().init();
  soundManager = new SoundManager();

  // Initialize effects
  initFireworks(fwContainer);

  // Initialize NPC silhouette system
  npcSystem = new NPCSystem(document.getElementById('npcCanvas'), gameState);

  // Initialize toothpick layer
  toothpickLayer = new ToothpickLayer(document.getElementById('toothpickCanvas'));

  // Initialize UI
  ui = new UI(gameState, handleBurnItem);

  // Game state callbacks
  gameState.onLevelUp = handleLevelUp;
  gameState.onAchievement = handleAchievement;
  gameState.onCategoryUnlock = handleCategoryUnlock;

  // Setup tap-to-fuel interaction
  setupInteractions(fireCanvas, particleCanvas);

  // Handle resize
  window.addEventListener('resize', handleResize);
  handleResize();

  // Initial fire intensity (campfire always starts at a good baseline)
  const initIntensity = gameState.getFireIntensity();
  fireEngine.setBaseIntensity(initIntensity);
  particles.setIntensity(initIntensity);

  // Start sound on first interaction (intro taps bubble up and trigger this)
  const startSound = () => {
    soundManager.init();
    document.removeEventListener('pointerdown', startSound);
    document.removeEventListener('touchstart', startSound);
  };
  document.addEventListener('pointerdown', startSound, { once: true });
  document.addEventListener('touchstart', startSound, { once: true });

  // Setup mute button
  const muteBtn = document.getElementById('muteToggle');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const muted = soundManager.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
      muteBtn.classList.toggle('muted', muted);
    });
  }

  // Run intro sequence, then start game loop on completion
  const intro = new Intro(soundManager);
  intro.start(() => {
    // Intro complete — begin game
    isRunning = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  });
}

// ============ GAME LOOP ============
function gameLoop(timestamp) {
  if (!isRunning) return;

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap at 100ms
  lastTime = timestamp;

  // Update game state
  gameState.update(dt);

  // Update fire intensity from game state
  const intensity = gameState.getFireIntensity();
  fireEngine.setBaseIntensity(intensity);
  particles.setIntensity(intensity);
  particles.setWind(fireEngine.wind);
  particles.fireCenter = { x: 0.5, y: 0.72 };

  // Update sound ambiance
  soundManager.updateAmbiance(intensity);

  // Render
  background.renderBackground(timestamp);
  background.renderGround(intensity);
  fireEngine.render(dt);
  toothpickLayer.render(dt);
  particles.update(dt);
  particles.render();
  npcSystem.update(dt, timestamp);
  npcSystem.render();
  updateFireGlow(intensity);

  // Update HUD (throttled)
  if (Math.floor(timestamp / 200) !== Math.floor((timestamp - dt * 1000) / 200)) {
    ui.updateHUD();

    // Show/hide restart hint when fire is extinguished
    const hint = document.getElementById('restartHint');
    if (hint) {
      if (gameState.isExtinguished()) {
        hint.classList.add('show');
      } else {
        hint.classList.remove('show');
      }
    }
  }

  requestAnimationFrame(gameLoop);
}

// ============ INTERACTIONS ============
function setupInteractions(fireCanvas, particleCanvas) {
  const app = document.getElementById('app');

  // Tap on fire area to add fuel
  let lastTapTime = 0;

  app.addEventListener('pointerdown', (e) => {
    // Don't interact when drawer/burn log is open or clicking UI
    if (ui.isDrawerOpen || ui.isAmbientMode || ui.burnLogOpen) {
      // In ambient mode, tap to exit
      if (ui.isAmbientMode) {
        ui.toggleAmbientMode();
      }
      return;
    }

    const target = e.target;
    if (target.closest('#inventoryDrawer') ||
        target.closest('#hud') ||
        target.closest('#itemModal') ||
        target.closest('#ambientToggle') ||
        target.closest('#muteToggle') ||
        target.closest('#burnLogPanel')) {
      return;
    }

    const now = performance.now();
    if (now - lastTapTime < 50) return; // debounce
    lastTapTime = now;

    // Ember state — tapping revives the dying fire
    if (gameState.isEmber()) {
      const revived = gameState.reviveFromEmber();
      if (revived) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        particles.sparkBurst(fireCenterX * dpr, fireCenterY * dpr, 8);
        soundManager.playClick();
      }
      return; // skip normal click processing
    }

    // Completely extinguished — tap to re-strike a match
    if (gameState.isExtinguished()) {
      const fuelValue = gameState.addClickFuel();
      tapRipple(e.clientX, e.clientY);
      floatingNumber('🔥 점화!', e.clientX, e.clientY - 20, 'big');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      particles.sparkBurst(fireCenterX * dpr, fireCenterY * dpr, 20);
      fireEngine.boost(0.4, 2);
      soundManager.playFireball();
      // Hide restart hint
      const hint = document.getElementById('restartHint');
      if (hint) hint.classList.remove('show');
      return;
    }

    // Add fuel
    const fuelValue = gameState.addClickFuel();

    // Visual feedback
    tapRipple(e.clientX, e.clientY);

    // Floating number
    const displayValue = Math.ceil(fuelValue);
    floatingNumber(displayValue, e.clientX, e.clientY - 20);

    // Combo display
    if (gameState.combo >= 3) {
      showCombo(gameState.combo);
    }

    // Spark particles at tap position
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    particles.sparkBurst(
      e.clientX * dpr,
      e.clientY * dpr,
      3 + Math.floor(gameState.combo * 0.5)
    );

    // Fire boost from clicking — very subtle
    fireEngine.boost(0.02 + gameState.combo * 0.004, 0.4);

    // Sound
    soundManager.playClick();
  });
}

// ============ ITEM BURN HANDLER ============
function handleBurnItem(categoryId, itemIndex) {
  const result = gameState.burnItem(categoryId, itemIndex);
  if (!result) return;

  const { name, rarity, burnValue, effectType, xpGain, ashGain, emberGain, combo, comboMultiplier } = result;

  // Look up flameColor from item data (6th element)
  const itemRow = ITEMS[categoryId] && ITEMS[categoryId][itemIndex];
  const flameColor = itemRow ? (itemRow[5] || null) : null;

  // Toothpick: add to visual pile before throwing
  const isToothpick = (categoryId === 'wood' && name === '이쑤시개');
  if (isToothpick) {
    toothpickLayer.addToothpick();
  }

  // Throw animation
  const startX = window.innerWidth / 2;
  const startY = window.innerHeight * 0.85;
  const category = CATEGORIES.find(c => c.id === categoryId);
  const icon = category ? category.icon : '🔥';

  throwItem(icon, startX, startY, fireCenterX, fireCenterY, () => {
    // After throw animation completes, trigger effects
    executeItemEffect(effectType, burnValue, rarity, flameColor);

    // Toothpick: animate the burn
    if (isToothpick) {
      toothpickLayer.burnToothpick();
    } else {
      // All items visually burn in the fire
      toothpickLayer.burnItem(icon, rarity, burnValue);
    }

    // Floating numbers
    const size = rarity >= 5 ? 'mega' : rarity >= 3 ? 'big' : 'normal';
    floatingNumber(burnValue, fireCenterX + (Math.random() - 0.5) * 60, fireCenterY - 30, size);

    if (xpGain > 10) {
      setTimeout(() => {
        floatingNumber(`XP ${xpGain}`, fireCenterX + 40, fireCenterY - 60, 'normal');
      }, 200);
    }

    // Combo
    if (combo >= 2) {
      showCombo(combo);
    }

    // Sound
    soundManager.playWhoosh();
    setTimeout(() => soundManager.playEffectSound(effectType), 400);

    // Fire boost — toothpick (burnValue=1) gives a brief tiny flare
    const boostAmount = Math.min(0.08 + burnValue * 0.003, 0.25);
    fireEngine.boost(boostAmount, 1.0 + rarity * 0.4);
  });
}

// ============ EFFECT EXECUTION ============
function executeItemEffect(effectType, burnValue, rarity, flameColor = null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cx = fireCenterX * dpr;
  const cy = fireCenterY * dpr;

  switch (effectType) {
    case 'none':
      particles.emitEmber(3 + rarity);
      break;

    case 'spark':
      particles.sparkBurst(cx, cy, 15 + rarity * 5);
      fireEngine.boost(0.15, 1);
      break;

    case 'explosion':
      particles.explosionBurst(cx, cy, 40 + rarity * 10);
      particles.sparkBurst(cx, cy, 20);
      screenShake(rarity >= 4 ? 'heavy' : 'medium');
      flash('red');
      fireEngine.boost(0.5, 2);
      break;

    case 'firework':
      // Launch fireworks with camera movement
      launchFireworks(
        2000 + rarity * 1000,
        () => {
          particles.colorBurst(cx, cy * 0.5, 60);
          flash('gold');
          screenShake('medium');
        },
        () => {
          particles.emitEmber(10);
        }
      );
      break;

    case 'rainbow':
      particles.colorBurst(cx, cy, 50 + rarity * 10, [
        [255, 0, 0], [255, 127, 0], [255, 255, 0],
        [0, 255, 0], [0, 0, 255], [75, 0, 130], [148, 0, 211],
      ]);
      fireEngine.setTint([1.2, 0.8, 1.2], 3);
      flash('gold');
      break;

    case 'smoke':
      for (let i = 0; i < 8 + rarity * 3; i++) {
        particles.emitSmoke(2);
      }
      fireEngine.setTint([0.7, 0.7, 0.8], 2);
      break;

    case 'chemical':
      particles.colorBurst(cx, cy, 30, [
        [0, 255, 100], [100, 255, 0], [0, 200, 255], [200, 0, 255],
      ]);
      fireEngine.setTint([0.5, 1.5, 0.5], 3);
      flash('white');
      screenShake('light');
      break;

    case 'flash':
      flash('white');
      particles.sparkBurst(cx, cy, 30);
      fireEngine.boost(0.3, 1);
      break;

    case 'inferno':
      particles.explosionBurst(cx, cy, 60, { r: 255, g: 80, b: 0 });
      particles.sparkBurst(cx, cy, 40);
      screenShake('heavy');
      flash('red');
      fireEngine.boost(1.0, 3);
      fireEngine.setTint([1.5, 0.7, 0.3], 4);

      // Secondary explosions
      setTimeout(() => {
        particles.explosionBurst(cx - 30, cy - 20, 30);
        soundManager.playExplosion();
      }, 300);
      setTimeout(() => {
        particles.explosionBurst(cx + 40, cy - 40, 25);
        soundManager.playExplosion();
      }, 600);
      break;

    case 'freeze':
      particles.colorBurst(cx, cy, 40, [
        [150, 200, 255], [200, 230, 255], [100, 180, 255], [255, 255, 255],
      ]);
      fireEngine.setTint([0.5, 0.7, 1.5], 3);
      flash('white');
      break;

    case 'electric':
      // Electric zaps
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          particles.sparkBurst(
            cx + (Math.random() - 0.5) * 100,
            cy + (Math.random() - 0.5) * 100,
            8
          );
          flash('white');
        }, i * 100);
      }
      fireEngine.setTint([0.7, 0.9, 1.5], 2);
      screenShake('light');
      break;

    case 'holy':
      particles.colorBurst(cx, cy, 50, [
        [255, 255, 200], [255, 230, 150], [255, 215, 0], [255, 255, 255],
      ]);
      fireEngine.setTint([1.3, 1.2, 0.8], 4);
      flash('gold');
      fireEngine.boost(0.6, 3);

      // Ascending particles
      for (let i = 0; i < 20; i++) {
        setTimeout(() => {
          particles.emitEmber(2);
        }, i * 50);
      }
      break;

    case 'dark':
      particles.colorBurst(cx, cy, 40, [
        [50, 0, 80], [80, 0, 120], [120, 0, 180], [30, 0, 50],
      ]);
      fireEngine.setTint([0.8, 0.3, 1.2], 3);
      screenShake('medium');
      break;

    case 'cosmic':
      // The most spectacular effect
      particles.colorBurst(cx, cy, 80, [
        [255, 100, 255], [100, 100, 255], [255, 255, 100],
        [100, 255, 255], [255, 100, 100], [255, 255, 255],
      ]);
      screenShake('heavy');
      flash('white');
      fireEngine.boost(1.5, 4);
      fireEngine.setTint([1.0, 0.8, 1.5], 5);

      // Fireworks sequence
      setTimeout(() => {
        launchFireworks(3000);
      }, 500);

      // Multiple explosion waves
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          particles.explosionBurst(
            cx + (Math.random() - 0.5) * 150,
            cy + (Math.random() - 0.5) * 150,
            20
          );
          flash(i % 2 === 0 ? 'gold' : 'white');
        }, 300 + i * 400);
      }
      break;
  }

  // Apply per-item flame color tint (overrides default fire color briefly)
  if (flameColor) {
    const [fr, fg, fb] = flameColor;
    const duration = 2 + rarity * 0.5;
    fireEngine.setTint([fr / 200, fg / 200, fb / 200], duration);
  }
}

// ============ EVENT HANDLERS ============
function handleLevelUp(level) {
  showAchievement('🔥', `레벨 ${level} 달성!`);
  flash('gold');
  screenShake('light');
  fireEngine.boost(0.5, 2);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  particles.colorBurst(
    fireCenterX * dpr,
    fireCenterY * dpr,
    30,
    [[255, 215, 0], [255, 180, 0], [255, 140, 0]]
  );

  soundManager.playFireball();
}

function handleAchievement(title, desc) {
  showAchievement('🏆', `${title}: ${desc}`);
}

function handleCategoryUnlock(category) {
  showAchievement(category.icon, `새 카테고리 해금: ${category.name}`);
  ui.refreshCategories();
}

function handleResize() {
  fireCenterX = window.innerWidth / 2;
  fireCenterY = window.innerHeight * 0.55;
}

// ============ VISIBILITY ============
// (game-state.js handles save on visibility change)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastTime = performance.now();
  }
});

// ============ START ============
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
