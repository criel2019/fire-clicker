/**
 * effects.js
 * Special visual effects: fireworks, screen shake, camera zoom, flash, etc.
 */

import { Fireworks } from 'fireworks-js';

let fireworksInstance = null;
let shakeTimers = [];

/**
 * Initialize fireworks container
 */
export function initFireworks(container) {
  fireworksInstance = new Fireworks(container, {
    autoresize: true,
    opacity: 0.5,
    acceleration: 1.05,
    friction: 0.97,
    gravity: 1.5,
    particles: 80,
    traceLength: 3,
    traceSpeed: 10,
    explosion: 5,
    intensity: 30,
    flickering: 50,
    lineStyle: 'round',
    hue: { min: 0, max: 360 },
    delay: { min: 30, max: 60 },
    rocketsPoint: { min: 30, max: 70 },
    lineWidth: {
      explosion: { min: 1, max: 3 },
      trace: { min: 1, max: 2 },
    },
    brightness: { min: 50, max: 80 },
    decay: { min: 0.015, max: 0.03 },
    mouse: { click: false, move: false, max: 1 },
    sound: { enabled: false },
  });
}

/**
 * Launch fireworks display
 * @param {number} duration - milliseconds
 * @param {Function} onStart - called when fireworks start
 * @param {Function} onEnd - called when fireworks end
 */
export function launchFireworks(duration = 4000, onStart, onEnd) {
  if (!fireworksInstance) return;

  fireworksInstance.start();
  if (onStart) onStart();

  // Camera zoom effect
  const app = document.getElementById('app');
  app.classList.add('firework-zoom');

  setTimeout(() => {
    fireworksInstance.stop();
    app.classList.remove('firework-zoom');
    if (onEnd) onEnd();
  }, duration);

  // Cleanup animation class after animation ends
  setTimeout(() => {
    app.classList.remove('firework-zoom');
  }, duration + 500);
}

/**
 * Screen shake effect
 * @param {string} type - 'light', 'medium', 'heavy'
 */
export function screenShake(type = 'medium') {
  const app = document.getElementById('app');

  // Remove existing shake classes
  app.classList.remove('shaking', 'heavy-shake');

  // Force reflow
  void app.offsetWidth;

  switch (type) {
    case 'light':
      app.style.animation = 'none';
      void app.offsetWidth;
      app.classList.add('shaking');
      setTimeout(() => app.classList.remove('shaking'), 500);
      break;
    case 'heavy':
      app.classList.add('heavy-shake');
      setTimeout(() => app.classList.remove('heavy-shake'), 800);
      break;
    case 'medium':
    default:
      app.classList.add('shaking');
      setTimeout(() => app.classList.remove('shaking'), 500);
      break;
  }

  // Haptic feedback
  triggerHaptic(type);
}

/**
 * Flash effect
 * @param {string} color - 'white', 'red', 'gold'
 */
export function flash(color = 'white') {
  const overlay = document.createElement('div');
  overlay.className = 'flash-overlay';

  switch (color) {
    case 'red':
      overlay.classList.add('flash-red');
      break;
    case 'gold':
      overlay.style.animation = 'none';
      overlay.style.background = 'rgba(255,215,0,0.4)';
      overlay.style.animation = 'flashAnim 0.8s ease-out forwards';
      break;
  }

  document.getElementById('app').appendChild(overlay);
  setTimeout(() => overlay.remove(), 1000);
}

/**
 * Floating number animation
 * @param {number} value - the number to display
 * @param {number} x - screen X position
 * @param {number} y - screen Y position
 * @param {string} size - 'normal', 'big', 'mega'
 */
export function floatingNumber(value, x, y, size = 'normal') {
  const container = document.getElementById('floatingNumbers');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `float-num ${size}`;
  const text = String(value);
  el.textContent = text.startsWith('+') || text.startsWith('-') || text.startsWith('🔥') || text.startsWith('X') ? text : `+${text}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/**
 * Show combo indicator
 * @param {number} combo - combo count
 */
let comboTimeout = null;
export function showCombo(combo) {
  const display = document.getElementById('comboDisplay');
  const countEl = document.getElementById('comboCount');
  if (!display || !countEl) return;

  countEl.textContent = `x${combo}`;
  display.classList.remove('hidden');
  display.classList.remove('show');
  void display.offsetWidth;
  display.classList.add('show');

  // Scale based on combo
  const scale = Math.min(1 + combo * 0.05, 1.5);
  countEl.style.transform = `scale(${scale})`;

  clearTimeout(comboTimeout);
  comboTimeout = setTimeout(() => {
    display.classList.add('hidden');
    display.classList.remove('show');
  }, 2000);
}

/**
 * Achievement toast
 */
let achieveTimeout = null;
export function showAchievement(icon, text) {
  const toast = document.getElementById('achievementToast');
  const iconEl = document.getElementById('achievementIcon');
  const textEl = document.getElementById('achievementText');
  if (!toast || !iconEl || !textEl) return;

  iconEl.textContent = icon;
  textEl.textContent = text;

  toast.classList.remove('hidden');
  toast.classList.add('show');

  clearTimeout(achieveTimeout);
  achieveTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 3000);
}

/**
 * Item throw animation
 * @param {string} icon - item visual representation
 * @param {number} startX - start X
 * @param {number} startY - start Y
 * @param {number} targetX - fire center X
 * @param {number} targetY - fire center Y
 * @param {Function} onComplete - called when animation completes
 */
export function throwItem(icon, startX, startY, targetX, targetY, onComplete) {
  const layer = document.getElementById('throwLayer');
  if (!layer) {
    if (onComplete) onComplete();
    return;
  }
  const el = document.createElement('div');
  el.className = 'throw-item';
  el.textContent = icon;
  el.style.left = `${startX}px`;
  el.style.top = `${startY}px`;

  const dx = targetX - startX;
  const dy = targetY - startY;
  el.style.setProperty('--dx', `${dx}px`);
  el.style.setProperty('--dy', `${dy}px`);

  layer.appendChild(el);

  setTimeout(() => {
    el.remove();
    if (onComplete) onComplete();
  }, 800);
}

/**
 * Haptic feedback (Capacitor)
 */
async function triggerHaptic(type = 'medium') {
  try {
    if (window.Capacitor?.Plugins?.Haptics) {
      const Haptics = window.Capacitor.Plugins.Haptics;
      switch (type) {
        case 'light':
          await Haptics.impact({ style: 'LIGHT' });
          break;
        case 'heavy':
          await Haptics.impact({ style: 'HEAVY' });
          break;
        default:
          await Haptics.impact({ style: 'MEDIUM' });
      }
    } else if (navigator.vibrate) {
      switch (type) {
        case 'light': navigator.vibrate(10); break;
        case 'heavy': navigator.vibrate([50, 30, 80]); break;
        default: navigator.vibrate(20); break;
      }
    }
  } catch (e) { /* ignore */ }
}

/**
 * Tap ripple effect at position
 */
export function tapRipple(x, y) {
  const ripple = document.getElementById('tapRipple');
  if (!ripple) return;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  ripple.classList.remove('active');
  void ripple.offsetWidth;
  ripple.classList.add('active');
  setTimeout(() => ripple.classList.remove('active'), 600);

  triggerHaptic('light');
}

/**
 * Fire glow intensity update — stronger ambient light at campfire baseline
 */
export function updateFireGlow(intensity) {
  const glow = document.getElementById('fireGlow');
  if (!glow) return;
  // At intensity 0.8 (baseline) alpha=0.18 — always a visible warm glow
  const alpha = Math.min(0.38, intensity * 0.22);
  const spread = 65 + intensity * 12;
  glow.style.background = `radial-gradient(ellipse at 50% 80%,
    rgba(255,110,20,${alpha}) 0%,
    rgba(220,65,12,${alpha * 0.55}) 28%,
    rgba(140,35,5,${alpha * 0.28}) 50%,
    transparent ${spread}%
  )`;
}
