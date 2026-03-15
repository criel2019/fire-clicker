/**
 * fire-engine.js
 * Enhanced Doom-fire pixel simulation — premium campfire for 불멍
 * Features: multi-frequency turbulence, blue base glow, ember bed,
 * flame breathing, center-biased diffusion for pointed flame tips
 */

// ── 37-step fire palette: deeply saturated, vivid campfire spectrum ──
// Real campfire color mapping: dark ember → deep crimson → vivid orange → amber → gold → warm white
const PALETTE = [
  [  7,   7,   7,   0],  //  0 — fully transparent (no fire)
  [ 20,   4,   2,   0],  //  1 — invisible
  [ 36,   6,   2,  45],  //  2 — faintest ember glow
  [ 52,  10,   2,  80],  //  3
  [ 68,  14,   2, 115],  //  4
  [ 86,  18,   2, 148],  //  5 — warm ember
  [106,  22,   4, 178],  //  6
  [126,  28,   4, 202],  //  7
  [146,  36,   4, 220],  //  8 — deep crimson
  [166,  44,   6, 234],  //  9
  [184,  54,   6, 244],  // 10 — cherry red
  [200,  62,   6, 250],  // 11
  [214,  72,   8, 255],  // 12 — red-orange
  [226,  84,   8, 255],  // 13
  [236,  96,  10, 255],  // 14
  [244, 108,  10, 255],  // 15 — vivid orange
  [250, 122,  12, 255],  // 16
  [254, 136,  16, 255],  // 17 — rich orange
  [255, 150,  20, 255],  // 18
  [255, 164,  26, 255],  // 19 — amber
  [255, 176,  34, 255],  // 20
  [255, 188,  42, 255],  // 21 — golden amber
  [255, 198,  52, 255],  // 22
  [255, 208,  62, 255],  // 23
  [255, 216,  74, 255],  // 24 — gold
  [255, 224,  88, 255],  // 25
  [255, 230, 104, 255],  // 26
  [255, 236, 120, 255],  // 27 — bright yellow
  [255, 240, 140, 255],  // 28
  [255, 244, 160, 255],  // 29
  [255, 247, 182, 255],  // 30 — pale yellow
  [255, 249, 202, 255],  // 31
  [255, 251, 218, 255],  // 32
  [255, 252, 230, 255],  // 33 — warm white
  [255, 253, 240, 255],  // 34
  [255, 254, 248, 255],  // 35
  [255, 255, 255, 255],  // 36 — white-hot core
];

// Simulation grid dimensions (small → scale up for smooth look)
const SIM_W = 90;
const SIM_H = 140;

// Campfire heat-source radius (fraction of SIM_W from center)
const CAMPFIRE_R = SIM_W * 0.23;

export class FireEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Intensity / wind / tint state
    this.intensity       = 0.80;
    this.targetIntensity = 0.80;
    this.wind            = 0;
    this.targetWind      = 0;
    this.tint            = [1, 1, 1];
    this.targetTint      = [1, 1, 1];
    this.boostTimer      = 0;
    this.boostIntensity  = 0;

    // Breathing rhythm state (slow, organic pulsation)
    this._breathPhase = Math.random() * Math.PI * 2;
    this._breathSpeed = 0.7 + Math.random() * 0.3; // slightly varied per session

    // Turbulence / gust state
    this._gustTimer    = 2 + Math.random() * 4;
    this._gustStrength = 0;

    // Heat pixel buffer (Uint8Array of heat indices 0–36)
    this.pixels = new Uint8Array(SIM_W * SIM_H);

    // Pre-compute center distance map for variable decay
    this._centerDist = new Float32Array(SIM_W);
    const cx = SIM_W * 0.5;
    for (let x = 0; x < SIM_W; x++) {
      this._centerDist[x] = Math.abs(x - cx) / (SIM_W * 0.5);
    }

    // Pre-compute ember bed positions (glowing coals at base)
    this._embers = [];
    for (let i = 0; i < 14; i++) {
      this._embers.push({
        rx: Math.sin(42 + i * 127.1) * 0.5 + 0.5,   // 0..1 relative x
        ry: Math.sin(42 + i * 311.7) * 0.3 + 0.5,    // 0..1 relative y offset
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        size: 1.5 + Math.random() * 3,
      });
    }

    // Offscreen canvas used to convert heat → RGBA → drawImage
    this._off    = document.createElement('canvas');
    this._off.width  = SIM_W;
    this._off.height = SIM_H;
    this._offCtx = this._off.getContext('2d');
    this._img    = this._offCtx.createImageData(SIM_W, SIM_H);

    // Warm up simulation so fire is visible immediately
    this._seedHeat(0.80);
    for (let i = 0; i < 80; i++) this._simStep();
  }

  // ── Seed the campfire heat source at the bottom rows ──
  _seedHeat(intensity) {
    // Completely extinguished — zero out the bottom seed rows
    if (intensity < 0.01) {
      for (let x = 0; x < SIM_W; x++) {
        for (let row = 1; row <= 5; row++) {
          this.pixels[(SIM_H - row) * SIM_W + x] = 0;
        }
      }
      return;
    }

    // Breathing rhythm modulates intensity organically
    const breathMod = 1.0
      + Math.sin(this._breathPhase) * 0.06
      + Math.sin(this._breathPhase * 2.3 + 0.5) * 0.03;
    const effIntensity = intensity * breathMod;

    const maxHeat = Math.round(36 * Math.min(1.0, effIntensity * 0.98));
    const cx = SIM_W * 0.5;

    // Seed 5 rows at bottom (thicker base than 3 rows)
    for (let x = 0; x < SIM_W; x++) {
      const dist = Math.abs(x - cx) / CAMPFIRE_R;
      if (dist >= 1) {
        for (let row = 1; row <= 5; row++) {
          this.pixels[(SIM_H - row) * SIM_W + x] = 0;
        }
        continue;
      }

      // Quadratic falloff with slight noise for organic edge
      const noise = 1.0 + (Math.random() - 0.5) * 0.12;
      const baseHeat = Math.round(maxHeat * (1 - dist * dist) * noise);

      this.pixels[(SIM_H - 1) * SIM_W + x] = Math.min(36, baseHeat);
      this.pixels[(SIM_H - 2) * SIM_W + x] = Math.min(36, Math.round(baseHeat * 0.92));
      this.pixels[(SIM_H - 3) * SIM_W + x] = Math.min(36, Math.round(baseHeat * 0.80));
      this.pixels[(SIM_H - 4) * SIM_W + x] = Math.min(36, Math.round(baseHeat * 0.62));
      this.pixels[(SIM_H - 5) * SIM_W + x] = Math.min(36, Math.round(baseHeat * 0.40));
    }

    // Random hot spots (flame tongue seeds) — creates irregular flame tips
    if (Math.random() < 0.35 * effIntensity) {
      const hotX = Math.round(cx + (Math.random() - 0.5) * CAMPFIRE_R * 1.4);
      if (hotX >= 0 && hotX < SIM_W) {
        const hotVal = Math.min(36, maxHeat + Math.round(Math.random() * 3));
        for (let row = 1; row <= 3; row++) {
          this.pixels[(SIM_H - row) * SIM_W + hotX] = hotVal;
          // Spread to neighbors for wider tongue
          if (hotX > 0) this.pixels[(SIM_H - row) * SIM_W + hotX - 1] = Math.max(
            this.pixels[(SIM_H - row) * SIM_W + hotX - 1], Math.round(hotVal * 0.7));
          if (hotX < SIM_W - 1) this.pixels[(SIM_H - row) * SIM_W + hotX + 1] = Math.max(
            this.pixels[(SIM_H - row) * SIM_W + hotX + 1], Math.round(hotVal * 0.7));
        }
      }
    }
  }

  // ── One step of enhanced Doom-fire diffusion ──
  _simStep() {
    const px      = this.pixels;
    const windInt = Math.round(this.wind * 2.0);
    const cDist   = this._centerDist;

    // Iterate top→bottom; for each pixel, pull heat from the row below
    for (let y = 0; y < SIM_H - 1; y++) {
      for (let x = 0; x < SIM_W; x++) {
        const heat = px[(y + 1) * SIM_W + x];
        if (heat === 0) {
          px[y * SIM_W + x] = 0;
        } else {
          const rnd  = (Math.random() * 4) | 0;          // 0–3
          const dstX = Math.max(0, Math.min(SIM_W - 1, x - rnd + 1 + windInt));

          // Center-biased decay: edge pixels cool faster → pointed flame tips
          const edgeFactor = cDist[x]; // 0 at center, 1 at edges
          const extraDecay = Math.random() < edgeFactor * 0.32 ? 1 : 0;

          px[y * SIM_W + dstX] = Math.max(0, heat - (rnd & 1) - extraDecay);
        }
      }
    }
  }

  // ── Convert heat buffer → RGBA image data ──
  _blit() {
    const d    = this._img.data;
    const px   = this.pixels;
    const tint = this.tint;

    for (let i = 0; i < SIM_W * SIM_H; i++) {
      const p   = PALETTE[px[i]];
      const idx = i * 4;
      d[idx]   = Math.min(255, (p[0] * tint[0]) | 0);
      d[idx+1] = Math.min(255, (p[1] * tint[1]) | 0);
      d[idx+2] = Math.min(255, (p[2] * tint[2]) | 0);
      d[idx+3] = p[3];
    }
    this._offCtx.putImageData(this._img, 0, 0);
  }

  // ── Canvas resize handling ──
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w   = this.canvas.clientWidth  * dpr;
    const h   = this.canvas.clientHeight * dpr;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w;
      this.canvas.height = h;
    }
  }

  // ── Public API (same interface as before) ──

  boost(amount, duration = 1.5) {
    this.boostIntensity = Math.min(this.boostIntensity + amount, 0.55);
    this.boostTimer     = Math.max(this.boostTimer, duration);
  }

  setBaseIntensity(val) {
    this.targetIntensity = Math.max(0, Math.min(val, 1.5));
  }

  setWind(val) {
    this.targetWind = Math.max(-1, Math.min(val, 1));
  }

  setTint(rgb, duration = 3) {
    this.targetTint = [...rgb];
    if (duration > 0) {
      setTimeout(() => { this.targetTint = [1, 1, 1]; }, duration * 1000);
    }
  }

  render(dt) {
    this.resize();

    // ── Update boost ──
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
    } else {
      this.boostIntensity *= Math.pow(0.12, dt);
    }

    // ── Smooth lerp toward targets ──
    const ls  = Math.min(2.5 * dt, 1);
    const tgt = this.targetIntensity + this.boostIntensity;
    this.intensity += (tgt - this.intensity) * ls;
    this.wind      += (this.targetWind - this.wind) * (ls * 0.4);
    for (let i = 0; i < 3; i++) {
      this.tint[i] += (this.targetTint[i] - this.tint[i]) * ls;
    }

    // ── Update breathing phase ──
    this._breathPhase += dt * this._breathSpeed * Math.PI * 2;

    // ── Multi-frequency natural wind turbulence ──
    const t = performance.now();
    const wind1 = Math.sin(t / 1800) * 0.08;           // slow sway
    const wind2 = Math.sin(t / 750)  * 0.05;            // medium flutter
    const wind3 = Math.sin(t / 330 + 1.7) * 0.025;      // fast flicker
    const wind4 = Math.sin(t / 5200) * 0.12;             // very slow drift
    const natWind = wind1 + wind2 + wind3 + wind4;

    // Random gusts (sudden short wind bursts)
    this._gustTimer -= dt;
    if (this._gustTimer <= 0) {
      this._gustStrength = (Math.random() - 0.5) * 0.25;
      this._gustTimer = 2 + Math.random() * 5;
    }
    this._gustStrength *= Math.pow(0.06, dt);

    this.wind += (natWind + this._gustStrength - this.wind) * 0.03;

    // ── Simulate ──
    this._seedHeat(this.intensity);
    this._simStep();
    this._simStep();
    this._blit();

    // ── Draw to screen ──
    const ctx = this.ctx;
    const cw  = this.canvas.width;
    const ch  = this.canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Fire size scales with intensity (0.5 at zero → 1.0 at full)
    const sizeScale = 0.5 + Math.min(1, this.intensity / 1.0) * 0.5;
    const fireW = cw * 0.38 * sizeScale;
    const fireH = ch * 0.36 * (0.6 + sizeScale * 0.4);
    const fireX = (cw - fireW) * 0.5;
    const fireY = ch * 0.72 - fireH;

    // Glow multiplier: ember state gets almost no glow; active fire gets full glow
    const glowMult = Math.min(1, this.intensity / 0.8);

    // Pulsing glow synced to breathing
    const glowPulse = 1.0
      + Math.sin(this._breathPhase * 1.1) * 0.07
      + Math.sin(this._breathPhase * 2.7 + 0.8) * 0.035;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // ── Layer 1: Outer soft halo (very wide, dim) ──
    ctx.globalAlpha = 0.13 * glowMult * glowPulse;
    ctx.drawImage(this._off,
      fireX - fireW * 0.30, fireY - fireH * 0.22,
      fireW * 1.60,         fireH * 1.44);

    // ── Layer 2: Mid warm glow ──
    ctx.globalAlpha = 0.30 * glowMult * glowPulse;
    ctx.drawImage(this._off,
      fireX - fireW * 0.16, fireY - fireH * 0.10,
      fireW * 1.32,         fireH * 1.20);

    // ── Layer 3: Inner glow (new — adds depth) ──
    ctx.globalAlpha = 0.48 * glowMult * glowPulse;
    ctx.drawImage(this._off,
      fireX - fireW * 0.06, fireY - fireH * 0.03,
      fireW * 1.12,         fireH * 1.06);

    // ── Layer 4: Core fire — scales with intensity ──
    ctx.globalAlpha = Math.max(0.1, 1.0 * this.intensity / 0.8);
    ctx.drawImage(this._off, fireX, fireY, fireW, fireH);

    // ── Blue base glow (complete combustion zone) ──
    if (this.intensity > 0.15) {
      const blueAlpha = Math.min(0.30, this.intensity * 0.22) * glowPulse;
      const baseY = fireY + fireH * 0.82;
      const baseW = fireW * 0.45;
      const baseCx = cw * 0.5;

      const grd = ctx.createRadialGradient(
        baseCx, baseY + fireH * 0.06, 0,
        baseCx, baseY + fireH * 0.06, baseW * 0.65
      );
      grd.addColorStop(0, `rgba(90, 130, 255, ${blueAlpha * 0.7})`);
      grd.addColorStop(0.25, `rgba(70, 110, 230, ${blueAlpha * 0.45})`);
      grd.addColorStop(0.55, `rgba(50, 80, 190, ${blueAlpha * 0.2})`);
      grd.addColorStop(1, 'rgba(30, 50, 140, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 1;
      ctx.fillStyle = grd;
      ctx.fillRect(
        baseCx - baseW, baseY - fireH * 0.06,
        baseW * 2,      fireH * 0.24
      );
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── Ember/coal bed at base (glowing coals) ──
    if (this.intensity > 0.1) {
      this._renderEmberBed(ctx, cw, ch, fireX, fireY, fireW, fireH, glowPulse);
    }

    ctx.restore();
  }

  // ── Render pulsing ember coals at the fire base ──
  _renderEmberBed(ctx, cw, ch, fireX, fireY, fireW, fireH, pulse) {
    const baseY = fireY + fireH * 0.86;
    const cx    = cw * 0.5;
    const emberW = fireW * 0.52;
    const t      = performance.now();

    ctx.globalCompositeOperation = 'screen';

    for (const ember of this._embers) {
      const ex = cx + (ember.rx - 0.5) * emberW;
      const ey = baseY + ember.ry * fireH * 0.08;

      // Individual pulse per ember (multiple frequencies for organic feel)
      const emberPulse = 0.35 + 0.65 * (
        Math.sin(t / 800 * ember.speed + ember.phase) * 0.3 +
        Math.sin(t / 1500 * ember.speed + ember.phase * 1.7) * 0.2 +
        0.5
      );

      const alpha = Math.min(0.65, this.intensity * 0.45) * emberPulse * pulse;
      const size = ember.size * (0.8 + this.intensity * 0.4);

      const grd = ctx.createRadialGradient(ex, ey, 0, ex, ey, size * 2.2);
      grd.addColorStop(0,   `rgba(255, 170, 50, ${alpha})`);
      grd.addColorStop(0.25, `rgba(255, 110, 25, ${alpha * 0.7})`);
      grd.addColorStop(0.6,  `rgba(210, 55, 10, ${alpha * 0.3})`);
      grd.addColorStop(1,    'rgba(130, 25, 5, 0)');

      ctx.globalAlpha = 1;
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(ex, ey, size * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  }
}
