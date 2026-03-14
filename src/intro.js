/**
 * intro.js
 * Match-lighting intro sequence for 불키우기
 *
 * State machine:
 *   dark → (1.2s timer) → prompt → (tap) → striking → (4-7 taps) → ignited → (1.4s) → falling → (1.2s) → done
 */

export class Intro {
  constructor(soundManager) {
    this.soundManager = soundManager || null;

    // DOM references — set in start()
    this.overlay = null;
    this.canvas = null;
    this.tapText = null;
    this.ctx = null;

    // State
    this.phase = 'dark'; // 'dark' | 'prompt' | 'striking' | 'ignited' | 'falling' | 'done'

    // Tap tracking
    this.tapCount = 0;
    this.igniteAt = 4 + Math.floor(Math.random() * 4); // 4–7

    // Sparks
    this.sparks = [];

    // Glow builds up with taps (0 → 1)
    this.glowAlpha = 0;

    // Screen shake
    this.shakeOffset = { x: 0, y: 0, decay: 0 };

    // Match head position (set by _resize)
    this.headX = 0;
    this.headY = 0;
    this.dpr = 1;

    // Timestamps for phase transitions
    this.igniteTime = 0;
    this.fallStartTime = 0;

    // RAF handle
    this._rafId = null;

    // Callback
    this._onComplete = null;

    // Bound handlers
    this._boundTap = this._onTap.bind(this);
    this._boundResize = this._resize.bind(this);
    this._boundLoop = this._loop.bind(this);
  }

  // ─── PUBLIC ────────────────────────────────────────────────────────────────

  start(onComplete) {
    this._onComplete = onComplete;

    this.overlay = document.getElementById('introOverlay');
    this.canvas = document.getElementById('introCanvas');
    this.tapText = document.getElementById('introTapText');

    if (!this.overlay || !this.canvas || !this.tapText) {
      // Elements not found — skip intro
      if (onComplete) onComplete();
      return;
    }

    this.ctx = this.canvas.getContext('2d');

    this.overlay.style.display = '';
    this.overlay.style.opacity = '1';

    this._resize();
    window.addEventListener('resize', this._boundResize);
    this.overlay.addEventListener('pointerdown', this._boundTap);

    // Show TAP prompt after 1.2s
    setTimeout(() => {
      if (this.phase === 'dark') {
        this.phase = 'prompt';
        this.tapText.classList.add('show');
      }
    }, 1200);

    // Start RAF loop
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  // ─── PRIVATE ───────────────────────────────────────────────────────────────

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    // Match head at center-x, 38% down
    this.headX = (w / 2) * dpr;
    this.headY = (h * 0.38) * dpr;
  }

  _onTap(e) {
    if (this.phase === 'done') return;

    // Hide TAP text on first tap
    if (this.phase === 'prompt' || this.phase === 'dark') {
      this.tapText.classList.remove('show');
      this.phase = 'striking';
    }

    if (this.phase === 'striking') {
      this._strike();
    }
  }

  _strike() {
    this.tapCount++;

    // Sound
    if (this.soundManager) {
      try { this.soundManager.playClick(); } catch (_) {}
    }

    // Heat up glow
    this.glowAlpha = Math.min(1, this.glowAlpha + 0.18);

    // Screen shake
    this.shakeOffset.x = (Math.random() - 0.5) * 10 * this.dpr;
    this.shakeOffset.y = (Math.random() - 0.5) * 8 * this.dpr;
    this.shakeOffset.decay = 0.82;

    // Sparks burst at match head
    const count = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
      const speed = (60 + Math.random() * 180) * this.dpr;
      const life = 0.3 + Math.random() * 0.4;
      const spark = {
        x: this.headX + (Math.random() - 0.5) * 8 * this.dpr,
        y: this.headY + (Math.random() - 0.5) * 6 * this.dpr,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        r: 220 + Math.floor(Math.random() * 35),
        g: 100 + Math.floor(Math.random() * 120),
        b: 0,
        size: (1 + Math.random() * 2) * this.dpr,
      };
      this.sparks.push(spark);
    }

    // Check ignition
    if (this.tapCount >= this.igniteAt) {
      this._ignite();
    }
  }

  _ignite() {
    this.phase = 'ignited';
    this.igniteTime = performance.now();

    // Sound
    if (this.soundManager) {
      try { this.soundManager.playFireball(); } catch (_) {}
    }

    // Big burst of sparks
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (100 + Math.random() * 300) * this.dpr;
      const life = 0.5 + Math.random() * 0.7;
      this.sparks.push({
        x: this.headX + (Math.random() - 0.5) * 12 * this.dpr,
        y: this.headY + (Math.random() - 0.5) * 12 * this.dpr,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        r: 255,
        g: 160 + Math.floor(Math.random() * 90),
        b: Math.floor(Math.random() * 60),
        size: (1.5 + Math.random() * 3) * this.dpr,
      });
    }

    this.glowAlpha = 1;

    // After 1.4s, start falling
    setTimeout(() => {
      if (this.phase === 'done') return;
      this.phase = 'falling';
      this.fallStartTime = performance.now();
    }, 1400);
  }

  _loop(ts) {
    if (this.phase === 'done') return;

    // Check if fall is complete
    if (this.phase === 'falling') {
      const elapsed = ts - this.fallStartTime;
      if (elapsed >= 1200) {
        this._complete();
        return;
      }
    }

    const dt = 1 / 60; // fixed step approximation (good enough for intro)
    this._update(dt);
    this._draw(ts);

    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  _update(dt) {
    const gravity = 320 * this.dpr;

    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.vy += gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    // Decay shake
    if (Math.abs(this.shakeOffset.x) > 0.1 || Math.abs(this.shakeOffset.y) > 0.1) {
      this.shakeOffset.x *= this.shakeOffset.decay;
      this.shakeOffset.y *= this.shakeOffset.decay;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }

  _draw(ts) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const dpr = this.dpr;

    ctx.clearRect(0, 0, w, h);

    // Nothing to draw in dark/prompt phases
    if (this.phase === 'dark' || this.phase === 'prompt') return;

    ctx.save();
    // Apply shake
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    const hx = this.headX;
    const hy = this.headY;

    // Ambient glow when ignited/falling
    if (this.phase === 'ignited' || this.phase === 'falling') {
      const glowR = 160 * dpr;
      const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, glowR);
      grad.addColorStop(0, `rgba(255, 140, 40, ${0.22 * this.glowAlpha})`);
      grad.addColorStop(0.5, `rgba(255, 80, 10, ${0.10 * this.glowAlpha})`);
      grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Compute fall progress
    let fallT = 0;
    let matchAngle = -20 * Math.PI / 180; // base tilt: -20 degrees
    let matchX = hx;
    let matchY = hy;

    if (this.phase === 'falling') {
      const elapsed = performance.now() - this.fallStartTime;
      fallT = Math.min(elapsed / 1200, 1);
      const ease = fallT * fallT; // ease-in

      const groundY = window.innerHeight * 0.72 * dpr;
      matchY = hy + (groundY - hy) * ease;
      matchX = hx + (Math.random() - 0.5) * 0.5 * dpr; // micro-wobble during fall

      // Rotate ~110 degrees (from -20° to +90°) during fall
      matchAngle = (-20 + 110 * ease) * Math.PI / 180;
    }

    // Draw strike surface during striking phase
    if (this.phase === 'striking') {
      this._drawStrikeSurface(ctx, hx, hy, dpr);
    }

    // Draw the match
    this._drawMatchStick(ctx, matchX, matchY, matchAngle, ts, dpr);

    // Draw sparks
    for (const s of this.sparks) {
      const alpha = Math.max(0, s.life / s.maxLife);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha})`;
      ctx.fill();
    }

    ctx.restore();
  }

  _drawStrikeSurface(ctx, mx, my, dpr) {
    const sw = 36 * dpr;
    const sh = 12 * dpr;
    const sx = mx + 22 * dpr;
    const sy = my + 10 * dpr;

    ctx.save();
    ctx.translate(sx + sw / 2, sy + sh / 2);
    ctx.rotate(0.08);
    ctx.translate(-(sw / 2), -(sh / 2));

    // Base rectangle
    ctx.fillStyle = '#3a2010';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, sw, sh, 2 * dpr);
    } else {
      ctx.rect(0, 0, sw, sh);
    }
    ctx.fill();

    // Rough texture lines
    ctx.strokeStyle = 'rgba(80, 40, 10, 0.7)';
    ctx.lineWidth = 0.8 * dpr;
    for (let i = 0; i < 5; i++) {
      const lx = (4 + i * 6) * dpr;
      ctx.beginPath();
      ctx.moveTo(lx, 1 * dpr);
      ctx.lineTo(lx + (Math.random() - 0.5) * 3 * dpr, sh - 1 * dpr);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawMatchStick(ctx, hx, hy, angle, ts, dpr) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);

    // ── Stick ──
    const stickW = 5.5 * dpr;
    const stickH = 110 * dpr;
    const stickX = -stickW / 2;
    const stickY = 0; // head is at origin; stick goes down

    const stickGrad = ctx.createLinearGradient(stickX, stickY, stickX + stickW, stickY + stickH);
    stickGrad.addColorStop(0, '#a0783a');
    stickGrad.addColorStop(0.4, '#c49448');
    stickGrad.addColorStop(1, '#7a5825');

    ctx.fillStyle = stickGrad;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(stickX, stickY, stickW, stickH, [0, 0, 3 * dpr, 3 * dpr]);
    } else {
      ctx.rect(stickX, stickY, stickW, stickH);
    }
    ctx.fill();

    // ── Match head ──
    const headR = 9 * dpr;

    // Color: dark red (cold) → orange (hot) → charred black (ignited)
    let headColor;
    if (this.phase === 'ignited' || this.phase === 'falling') {
      // Charred
      headColor = '#1a0d00';
    } else {
      // Heat gradient: dark red → orange based on glowAlpha
      const t = this.glowAlpha;
      const r = Math.round(140 + 115 * t);
      const g = Math.round(20 + 80 * t);
      const b = 0;
      headColor = `rgb(${r},${g},${b})`;
    }

    // Head glow
    if (this.glowAlpha > 0 && this.phase !== 'ignited' && this.phase !== 'falling') {
      const hgGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, headR * 2.5);
      hgGrad.addColorStop(0, `rgba(255, 140, 0, ${0.5 * this.glowAlpha})`);
      hgGrad.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = hgGrad;
      ctx.beginPath();
      ctx.arc(0, 0, headR * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = headColor;
    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, Math.PI * 2);
    ctx.fill();

    // ── Flame (ignited / falling) ──
    if (this.phase === 'ignited' || this.phase === 'falling') {
      const flicker = Math.sin(ts * 0.012) * 0.18 + Math.sin(ts * 0.019) * 0.10;
      const flameH = (28 + flicker * 14) * dpr;
      const flameW = (8 + flicker * 4) * dpr;

      ctx.save();

      // Flame teardrop path: base at head center, tip upward
      ctx.beginPath();
      ctx.moveTo(0, 0); // base center (head position)
      ctx.quadraticCurveTo(-flameW, -flameH * 0.5, 0, -flameH); // left curve to tip
      ctx.quadraticCurveTo(flameW, -flameH * 0.5, 0, 0);        // right curve back
      ctx.closePath();

      const flameGrad = ctx.createLinearGradient(0, 0, 0, -flameH);
      flameGrad.addColorStop(0, 'rgba(255, 120, 0, 0.95)');
      flameGrad.addColorStop(0.4, 'rgba(255, 200, 50, 0.85)');
      flameGrad.addColorStop(1, 'rgba(255, 255, 200, 0.5)');

      ctx.fillStyle = flameGrad;
      ctx.fill();

      // Inner bright core
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-flameW * 0.4, -flameH * 0.4, 0, -flameH * 0.7);
      ctx.quadraticCurveTo(flameW * 0.4, -flameH * 0.4, 0, 0);
      ctx.closePath();

      const coreGrad = ctx.createLinearGradient(0, 0, 0, -flameH * 0.7);
      coreGrad.addColorStop(0, 'rgba(255, 255, 160, 0.6)');
      coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
      ctx.fillStyle = coreGrad;
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  _complete() {
    if (this.phase === 'done') return;
    this.phase = 'done';

    // Cancel RAF
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Remove event listeners
    window.removeEventListener('resize', this._boundResize);
    if (this.overlay) {
      this.overlay.removeEventListener('pointerdown', this._boundTap);
    }

    // Fade overlay out
    if (this.overlay) {
      this.overlay.style.transition = 'opacity 0.6s ease';
      this.overlay.style.opacity = '0';
      setTimeout(() => {
        if (this.overlay) this.overlay.style.display = 'none';
        if (this._onComplete) this._onComplete();
      }, 620);
    } else {
      if (this._onComplete) this._onComplete();
    }
  }
}
