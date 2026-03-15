/**
 * toothpick-layer.js  →  Item Burn Layer
 * Canvas 2D layer showing items burning in the fire.
 * Items appear, glow, char, shrink, and crumble to ash.
 */

const MAX_ITEMS = 15;

export class ToothpickLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resize();
    this.items = []; // burning items
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.dpr = dpr;
  }

  /**
   * Add a toothpick (legacy API - still used by main.js)
   */
  addToothpick() {
    this.addItem('🪥', 1, 1, true);
  }

  /**
   * Burn a toothpick (legacy API)
   */
  burnToothpick() {
    // Find oldest non-burning toothpick-type item
    const target = this.items.find(it => !it.burning && it.isToothpick);
    if (target) {
      target.burning = true;
      target.burnTimer = 0;
    }
  }

  /**
   * Add any item to the fire for burning visualization
   * @param {string} icon - emoji or text to display
   * @param {number} rarity - 1-6, affects size
   * @param {number} burnValue - affects burn duration
   * @param {boolean} isToothpick - legacy flag
   */
  addItem(icon, rarity = 1, burnValue = 1, isToothpick = false) {
    const dpr = this.dpr;
    const cx = (window.innerWidth / 2) * dpr;
    const baseY = window.innerHeight * 0.70 * dpr;

    // Size based on rarity
    const baseSize = (18 + rarity * 8) * dpr;

    // Burn duration based on burnValue (min 0.8s, max 4s)
    const burnDuration = Math.min(4.0, Math.max(0.8, 0.5 + burnValue * 0.015));

    // Random position near the fire center
    const xSpread = (40 + rarity * 10) * dpr;
    const xOffset = (Math.random() - 0.5) * xSpread;
    const yOffset = (Math.random() - 0.5) * 12 * dpr;

    // Random rotation
    const angle = (Math.random() - 0.5) * 0.6;

    const item = {
      icon: isToothpick ? null : icon,
      isToothpick,
      x: cx + xOffset,
      y: baseY + yOffset - (rarity > 3 ? 8 * dpr : 0),
      angle,
      size: baseSize,
      originalSize: baseSize,
      rarity,
      burnValue,
      burnDuration,
      alpha: 1,
      burning: !isToothpick, // non-toothpick items start burning immediately
      burnTimer: 0,
      // Visual state
      charLevel: 0,    // 0 = fresh, 1 = fully charred
      glowLevel: 0,    // ember glow intensity
      shrinkLevel: 0,  // 0 = full size, 1 = gone
      crumbleParticles: [],
    };

    this.items.push(item);

    // FIFO: remove oldest if over max
    if (this.items.length > MAX_ITEMS) {
      this.items.shift();
    }
  }

  /**
   * Called by main.js when an item is burned
   * @param {string} icon - category emoji
   * @param {number} rarity - item rarity
   * @param {number} burnValue - item burn value
   */
  burnItem(icon, rarity, burnValue) {
    this.addItem(icon, rarity, burnValue, false);
  }

  render(dt) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update and filter items
    this.items = this.items.filter(item => {
      if (!item.burning) {
        // Not burning yet (toothpick waiting)
        return true;
      }

      item.burnTimer += dt;
      const t = item.burnTimer / item.burnDuration; // 0→1

      if (t >= 1) return false; // fully consumed

      if (item.isToothpick) {
        // Legacy toothpick burn
        this._updateToothpickBurn(item, t);
      } else {
        // General item burn phases
        this._updateItemBurn(item, t, dt);
      }

      return true;
    });

    // Draw all items
    for (const item of this.items) {
      if (item.isToothpick) {
        this._drawToothpick(ctx, item, dpr);
      } else {
        this._drawBurningItem(ctx, item, dpr);
      }
    }
  }

  // ── Toothpick (legacy) ──────────────────────────────

  _updateToothpickBurn(item, t) {
    if (t < 0.4) {
      const p = t / 0.4;
      item._drawColor = _lerpColor([139, 69, 19], [255, 140, 0], p);
      item.alpha = 1;
    } else if (t < 0.7) {
      const p = (t - 0.4) / 0.3;
      item._drawColor = _lerpColor([255, 140, 0], [255, 255, 240], p);
      item.alpha = 1;
    } else {
      item._drawColor = [255, 255, 240];
      item.alpha = 1 - (t - 0.7) / 0.3;
    }
  }

  _drawToothpick(ctx, item, dpr) {
    ctx.save();
    ctx.globalAlpha = item.alpha;

    if (!item.burning) {
      item._drawColor = [139, 69, 19];
    }

    const color = item._drawColor || [139, 69, 19];
    ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    ctx.lineWidth = 1.8 * dpr;
    ctx.lineCap = 'round';

    const length = item.size || 25 * dpr;
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);

    ctx.beginPath();
    ctx.moveTo(-length / 2, 0);
    ctx.lineTo(length / 2, 0);
    ctx.stroke();

    if (!item.burning) {
      ctx.beginPath();
      ctx.arc(length / 2, 0, 1.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#c8a060';
      ctx.fill();
    }

    ctx.restore();
  }

  // ── General item burn ───────────────────────────────

  _updateItemBurn(item, t, dt) {
    // Phase 1 (0-0.15): Item appears, starts glowing at edges
    // Phase 2 (0.15-0.5): Charring, color shifts to orange/red, edges glow
    // Phase 3 (0.5-0.8): Shrinking, turning black, crumbling
    // Phase 4 (0.8-1.0): Final ash fade

    if (t < 0.15) {
      // Appear and start edge glow
      item.charLevel = 0;
      item.glowLevel = t / 0.15;
      item.shrinkLevel = 0;
      item.alpha = Math.min(1, t / 0.05); // fade in quickly
    } else if (t < 0.5) {
      // Charring phase
      const p = (t - 0.15) / 0.35;
      item.charLevel = p;
      item.glowLevel = 1.0 - p * 0.3;
      item.shrinkLevel = p * 0.15;
      item.alpha = 1;
    } else if (t < 0.8) {
      // Shrinking and blackening
      const p = (t - 0.5) / 0.3;
      item.charLevel = 1;
      item.glowLevel = (1 - p) * 0.7;
      item.shrinkLevel = 0.15 + p * 0.6;
      item.alpha = 1 - p * 0.3;

      // Spawn crumble particles
      if (Math.random() < 0.3) {
        item.crumbleParticles.push({
          x: (Math.random() - 0.5) * item.size * 0.5,
          y: (Math.random() - 0.5) * item.size * 0.5,
          vx: (Math.random() - 0.5) * 30,
          vy: Math.random() * 20 + 10,
          life: 0.5 + Math.random() * 0.5,
          size: 1 + Math.random() * 3,
        });
      }
    } else {
      // Final ash fade
      const p = (t - 0.8) / 0.2;
      item.charLevel = 1;
      item.glowLevel = 0;
      item.shrinkLevel = 0.75 + p * 0.25;
      item.alpha = (1 - p) * 0.7;
    }

    // Update crumble particles using actual dt
    const actualDt = dt || 0.016;
    item.crumbleParticles = item.crumbleParticles.filter(p => {
      p.x += p.vx * actualDt;
      p.y += p.vy * actualDt;
      p.vy += 40 * actualDt;
      p.life -= actualDt;
      return p.life > 0;
    });
  }

  _drawBurningItem(ctx, item, dpr) {
    ctx.save();

    const scale = 1 - item.shrinkLevel;
    const currentSize = item.originalSize * scale;

    if (currentSize < 2) {
      ctx.restore();
      return;
    }

    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle + item.charLevel * 0.1); // slight rotation as it burns
    ctx.globalAlpha = item.alpha;

    // ── Ember glow behind the item ──
    if (item.glowLevel > 0.1) {
      const glowSize = currentSize * 1.8;
      const glowGrad = ctx.createRadialGradient(0, 0, currentSize * 0.3, 0, 0, glowSize);
      glowGrad.addColorStop(0, `rgba(255, 120, 20, ${item.glowLevel * 0.4})`);
      glowGrad.addColorStop(0.5, `rgba(255, 60, 0, ${item.glowLevel * 0.2})`);
      glowGrad.addColorStop(1, 'rgba(255, 30, 0, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Item body (rounded rectangle) ──
    const half = currentSize / 2;
    const radius = Math.min(half * 0.3, 8 * dpr);

    // Color transitions: original → orange glow → dark char → black ash
    let bodyR, bodyG, bodyB;
    if (item.charLevel < 0.5) {
      // Original brownish → orange
      const p = item.charLevel / 0.5;
      bodyR = Math.round(80 + 175 * p);
      bodyG = Math.round(60 + 80 * p * (1 - p));
      bodyB = Math.round(40 * (1 - p));
    } else {
      // Orange → dark char
      const p = (item.charLevel - 0.5) / 0.5;
      bodyR = Math.round(255 * (1 - p * 0.85));
      bodyG = Math.round(60 * (1 - p));
      bodyB = 0;
    }

    // Draw body shape
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-half, -half, currentSize, currentSize, radius);
    } else {
      ctx.rect(-half, -half, currentSize, currentSize);
    }

    // Body gradient (hotter at bottom)
    const bodyGrad = ctx.createLinearGradient(0, -half, 0, half);
    bodyGrad.addColorStop(0, `rgb(${Math.max(0, bodyR - 30)}, ${Math.max(0, bodyG - 20)}, ${bodyB})`);
    bodyGrad.addColorStop(1, `rgb(${bodyR}, ${bodyG}, ${bodyB})`);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // ── Edge burn glow (orange-white edges) ──
    if (item.glowLevel > 0.2 && item.charLevel < 0.9) {
      ctx.strokeStyle = `rgba(255, ${Math.round(140 + 80 * (1 - item.charLevel))}, ${Math.round(40 * (1 - item.charLevel))}, ${item.glowLevel * 0.7})`;
      ctx.lineWidth = (1.5 + item.glowLevel * 2) * dpr;
      ctx.stroke();
    }

    // ── Burn crack lines ──
    if (item.charLevel > 0.3) {
      ctx.strokeStyle = `rgba(255, 80, 0, ${(item.charLevel - 0.3) * 0.5})`;
      ctx.lineWidth = 1 * dpr;
      const crackCount = Math.floor(item.charLevel * 5);
      for (let i = 0; i < crackCount; i++) {
        const seed = i * 7919 + item.x; // deterministic from position
        const cx1 = (Math.sin(seed) * 0.5) * half;
        const cy1 = (Math.cos(seed * 1.3) * 0.5) * half;
        const cx2 = cx1 + (Math.sin(seed * 2.7) * 0.4) * half;
        const cy2 = cy1 + (Math.cos(seed * 3.1) * 0.4) * half;
        ctx.beginPath();
        ctx.moveTo(cx1, cy1);
        ctx.lineTo(cx2, cy2);
        ctx.stroke();
      }
    }

    // ── Item emoji/icon ──
    if (item.icon && item.charLevel < 0.8) {
      const fontSize = currentSize * 0.5;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = item.alpha * (1 - item.charLevel * 1.2);
      ctx.fillText(item.icon, 0, 0);
      ctx.globalAlpha = item.alpha;
    }

    // ── Crumble particles ──
    for (const p of item.crumbleParticles) {
      const pa = Math.max(0, p.life / 0.8);
      ctx.fillStyle = `rgba(60, 30, 10, ${pa * 0.8})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function _lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
