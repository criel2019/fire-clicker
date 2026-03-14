/**
 * fire-engine.js
 * Doom-fire pixel simulation — reliable on all devices, beautiful campfire
 * Heat diffusion algorithm: elliptical bottom heat source → spreads upward
 */

// ── 37-step fire palette: invisible → dark ember → red → orange → yellow → white ──
const PALETTE = [
  [ 7,   7,   7,   0],  //  0 — fully transparent (no fire)
  [31,   7,   7,   0],  //  1 — transparent
  [47,  15,   7,  70],  //  2 — barely-visible dark ember
  [71,  15,   7, 110],  //  3
  [87,  23,   7, 145],  //  4
  [103, 31,   7, 175],  //  5
  [119, 31,   7, 200],  //  6
  [143, 39,   7, 220],  //  7
  [159, 47,   7, 235],  //  8
  [175, 63,   7, 248],  //  9
  [191, 71,   7, 255],  // 10
  [199, 71,   7, 255],  // 11
  [223, 79,   7, 255],  // 12
  [223, 87,   7, 255],  // 13
  [223, 87,   7, 255],  // 14
  [215, 95,   7, 255],  // 15
  [215, 95,   7, 255],  // 16
  [215, 103, 15, 255],  // 17
  [207, 111, 15, 255],  // 18
  [207, 119, 15, 255],  // 19
  [207, 127, 15, 255],  // 20
  [207, 135, 23, 255],  // 21
  [199, 135, 23, 255],  // 22
  [199, 143, 23, 255],  // 23
  [199, 151, 31, 255],  // 24
  [191, 159, 31, 255],  // 25
  [191, 159, 31, 255],  // 26
  [191, 167, 39, 255],  // 27
  [191, 167, 39, 255],  // 28
  [191, 175, 47, 255],  // 29
  [183, 175, 47, 255],  // 30
  [183, 183, 47, 255],  // 31
  [183, 183, 55, 255],  // 32
  [207, 207, 111, 255], // 33
  [223, 223, 159, 255], // 34
  [239, 239, 199, 255], // 35
  [255, 255, 255, 255], // 36 — white-hot core
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

    // Heat pixel buffer (Uint8Array of heat indices 0–36)
    this.pixels = new Uint8Array(SIM_W * SIM_H);

    // Offscreen canvas used to convert heat → RGBA → drawImage
    this._off    = document.createElement('canvas');
    this._off.width  = SIM_W;
    this._off.height = SIM_H;
    this._offCtx = this._off.getContext('2d');
    this._img    = this._offCtx.createImageData(SIM_W, SIM_H);

    // Warm up simulation a bit so fire is visible immediately
    this._seedHeat(0.80);
    for (let i = 0; i < 60; i++) this._simStep();
  }

  // ── Seed the campfire heat source at the bottom rows ──
  _seedHeat(intensity) {
    // Completely extinguished — zero out the bottom seed rows
    if (intensity < 0.01) {
      for (let x = 0; x < SIM_W; x++) {
        this.pixels[(SIM_H - 1) * SIM_W + x] = 0;
        this.pixels[(SIM_H - 2) * SIM_W + x] = 0;
        this.pixels[(SIM_H - 3) * SIM_W + x] = 0;
      }
      return;
    }

    const maxHeat = Math.round(36 * Math.min(1.0, intensity * 0.98));
    const cx = SIM_W * 0.5;

    for (let x = 0; x < SIM_W; x++) {
      const dist = Math.abs(x - cx) / CAMPFIRE_R;
      const heat = dist >= 1 ? 0 : Math.round(maxHeat * (1 - dist * dist));
      this.pixels[(SIM_H - 1) * SIM_W + x] = heat;
      this.pixels[(SIM_H - 2) * SIM_W + x] = Math.round(heat * 0.88);
      this.pixels[(SIM_H - 3) * SIM_W + x] = Math.round(heat * 0.72);
    }
  }

  // ── One step of the Doom-fire diffusion algorithm ──
  _simStep() {
    const px      = this.pixels;
    const windInt = Math.round(this.wind * 1.8);

    // Iterate top→bottom; for each pixel, pull heat from the row below
    for (let y = 0; y < SIM_H - 1; y++) {
      for (let x = 0; x < SIM_W; x++) {
        const heat = px[(y + 1) * SIM_W + x];
        if (heat === 0) {
          px[y * SIM_W + x] = 0;
        } else {
          const rnd  = (Math.random() * 4) | 0;          // 0–3
          const dstX = Math.max(0, Math.min(SIM_W - 1, x - rnd + 1 + windInt));
          px[y * SIM_W + dstX] = Math.max(0, heat - (rnd & 1));
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
    this.targetIntensity = Math.max(0, Math.min(val, 1.5)); // 0.80 floor removed — fire can die
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

    // Natural gentle wind sway
    const natWind = Math.sin(performance.now() / 1400) * 0.10;
    this.wind += (natWind - this.wind) * 0.025;

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

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw glow layers for volumetric depth
    // Outer soft halo
    ctx.globalAlpha = 0.18 * glowMult;
    ctx.drawImage(this._off,
      fireX - fireW * 0.25, fireY - fireH * 0.18,
      fireW * 1.5,          fireH * 1.36);

    // Mid glow
    ctx.globalAlpha = 0.42 * glowMult;
    ctx.drawImage(this._off,
      fireX - fireW * 0.10, fireY - fireH * 0.06,
      fireW * 1.2,          fireH * 1.12);

    // Core fire — scales with intensity, minimum visibility when ember
    ctx.globalAlpha = Math.max(0.1, 1.0 * this.intensity / 0.8);
    ctx.drawImage(this._off, fireX, fireY, fireW, fireH);

    ctx.restore();
  }
}
