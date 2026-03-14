/**
 * toothpick-layer.js
 * Canvas 2D layer showing toothpicks piling up in front of the fire.
 * 불키우기 (Fire Clicker)
 */

const MAX_TOOTHPICKS = 20;
const BURN_DURATION = 0.6; // seconds

export class ToothpickLayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._resize();

    this.toothpicks = []; // { x, y, angle, length, alpha, burning, burnTimer }

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.dpr = dpr;
  }

  /**
   * Called when a toothpick is thrown into the fire.
   * Adds a new toothpick to the pile.
   */
  addToothpick() {
    const dpr = this.dpr;
    const cx = (window.innerWidth / 2) * dpr;
    // Fire base is roughly at 68-75% screen height
    const baseY = window.innerHeight * 0.71 * dpr;

    const length = (20 + Math.random() * 15) * dpr;
    const angle = (Math.random() - 0.5) * (Math.PI / 3); // -30 to +30 degrees
    const xOffset = (Math.random() - 0.5) * 120 * dpr;
    // Stack vertically: slight y variation based on pile height
    const yOffset = (Math.random() - 0.5) * 10 * dpr;

    const toothpick = {
      x: cx + xOffset,
      y: baseY + yOffset,
      angle,
      length,
      alpha: 1,
      burning: false,
      burnTimer: 0,
    };

    this.toothpicks.push(toothpick);

    // FIFO: remove oldest if over max
    if (this.toothpicks.length > MAX_TOOTHPICKS) {
      this.toothpicks.shift();
    }
  }

  /**
   * Animate one toothpick (the oldest non-burning one) catching fire and disappearing.
   */
  burnToothpick() {
    // Find the oldest non-burning toothpick
    const target = this.toothpicks.find(tp => !tp.burning);
    if (target) {
      target.burning = true;
      target.burnTimer = 0;
    }
  }

  /**
   * Draw the toothpick pile. Called every frame.
   * @param {number} dt - delta time in seconds
   */
  render(dt) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Update burn animations and remove fully burned toothpicks
    this.toothpicks = this.toothpicks.filter(tp => {
      if (tp.burning) {
        tp.burnTimer += dt;
        const t = tp.burnTimer / BURN_DURATION; // 0 -> 1

        if (t >= 1) return false; // fully gone

        // Color lerp: brown -> orange -> white, with fade
        if (t < 0.4) {
          // brown to orange
          const p = t / 0.4;
          tp._drawColor = _lerpColor([139, 69, 19], [255, 140, 0], p);
          tp.alpha = 1;
        } else if (t < 0.7) {
          // orange to white
          const p = (t - 0.4) / 0.3;
          tp._drawColor = _lerpColor([255, 140, 0], [255, 255, 240], p);
          tp.alpha = 1;
        } else {
          // white fading out
          const p = (t - 0.7) / 0.3;
          tp._drawColor = [255, 255, 240];
          tp.alpha = 1 - p;
        }
      } else {
        tp._drawColor = [139, 69, 19]; // #8B4513 brown
        tp.alpha = 1;
      }
      return true;
    });

    // Draw all toothpicks
    for (const tp of this.toothpicks) {
      ctx.save();
      ctx.globalAlpha = tp.alpha;
      ctx.strokeStyle = tp._drawColor
        ? `rgb(${tp._drawColor[0]}, ${tp._drawColor[1]}, ${tp._drawColor[2]})`
        : '#8B4513';
      ctx.lineWidth = 1.8 * this.dpr;
      ctx.lineCap = 'round';

      ctx.translate(tp.x, tp.y);
      ctx.rotate(tp.angle);

      ctx.beginPath();
      ctx.moveTo(-tp.length / 2, 0);
      ctx.lineTo(tp.length / 2, 0);
      ctx.stroke();

      // Small pointed tip (one end slightly tapered — just a brighter dot)
      if (!tp.burning) {
        ctx.beginPath();
        ctx.arc(tp.length / 2, 0, 1.5 * this.dpr, 0, Math.PI * 2);
        ctx.fillStyle = '#c8a060';
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

/**
 * Linear interpolation between two RGB colors.
 * @param {number[]} a - [r, g, b]
 * @param {number[]} b - [r, g, b]
 * @param {number} t - 0..1
 * @returns {number[]} interpolated [r, g, b]
 */
function _lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
