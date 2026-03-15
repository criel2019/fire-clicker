/**
 * particles.js
 * Canvas 2D particle system for embers, sparks, smoke, and ash
 * Overlays on top of the WebGL fire shader
 */

class Particle {
  constructor(x, y, type, opts = {}) {
    this.x = x;
    this.y = y;
    this.type = type; // 'ember', 'spark', 'smoke', 'ash', 'burst', 'colorBurst'
    this.alive = true;

    switch (type) {
      case 'ember':
        this.vx = (Math.random() - 0.5) * 22 + (opts.wind || 0) * 18;
        this.vy = -(50 + Math.random() * 100);  // faster upward drift
        this.life = 2.0 + Math.random() * 3.0;
        this.maxLife = this.life;
        this.size = 1.2 + Math.random() * 2.5;
        this.r = 255;
        this.g = 140 + Math.random() * 90;
        this.b = 5  + Math.random() * 25;
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleAmp = 0.4 + Math.random() * 0.6;
        this.cooling = 0;  // color cools as it rises
        break;

      case 'spark':
        const angle = opts.angle ?? (Math.random() * Math.PI * 2);
        const speed = opts.speed ?? (100 + Math.random() * 200);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 0.3 + Math.random() * 0.5;
        this.maxLife = this.life;
        this.size = 1 + Math.random() * 2;
        this.r = 255;
        this.g = 200 + Math.random() * 55;
        this.b = 50 + Math.random() * 100;
        this.trail = [];
        break;

      case 'smoke':
        this.vx = (Math.random() - 0.5) * 12 + (opts.wind || 0) * 25;
        this.vy = -(12 + Math.random() * 20);
        this.life = 4 + Math.random() * 5;
        this.maxLife = this.life;
        this.size = 14 + Math.random() * 22;
        this.opacity = 0.04 + Math.random() * 0.07;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.35;
        this.wobblePhase = Math.random() * Math.PI * 2;
        this.wobbleAmp = 0.5 + Math.random() * 1.0;
        break;

      case 'ash':
        this.vx = (Math.random() - 0.5) * 20;
        this.vy = 5 + Math.random() * 15;
        this.life = 4 + Math.random() * 6;
        this.maxLife = this.life;
        this.size = 1 + Math.random() * 2;
        this.opacity = 0.2 + Math.random() * 0.3;
        this.wobblePhase = Math.random() * Math.PI * 2;
        break;

      case 'burst':
        const bAngle = opts.angle ?? (Math.random() * Math.PI * 2);
        const bSpeed = opts.speed ?? (50 + Math.random() * 150);
        this.vx = Math.cos(bAngle) * bSpeed;
        this.vy = Math.sin(bAngle) * bSpeed;
        this.life = 0.5 + Math.random() * 1.0;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 4;
        this.r = opts.r ?? 255;
        this.g = opts.g ?? (150 + Math.random() * 105);
        this.b = opts.b ?? (20 + Math.random() * 50);
        this.gravity = 80;
        break;

      case 'colorBurst':
        const cAngle = opts.angle ?? (Math.random() * Math.PI * 2);
        const cSpeed = opts.speed ?? (80 + Math.random() * 200);
        this.vx = Math.cos(cAngle) * cSpeed;
        this.vy = Math.sin(cAngle) * cSpeed;
        this.life = 0.8 + Math.random() * 1.5;
        this.maxLife = this.life;
        this.size = 2 + Math.random() * 5;
        this.r = opts.r ?? Math.floor(Math.random() * 255);
        this.g = opts.g ?? Math.floor(Math.random() * 255);
        this.b = opts.b ?? Math.floor(Math.random() * 255);
        this.gravity = 60;
        this.trail = [];
        break;
    }
  }

  update(dt) {
    this.life -= dt;
    if (this.life <= 0) {
      this.alive = false;
      return;
    }

    const progress = 1 - this.life / this.maxLife;

    switch (this.type) {
      case 'ember':
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Wobble side-to-side as it rises
        this.vx += Math.sin(this.wobblePhase + performance.now() / 1000 * 3.5) * this.wobbleAmp * dt * 60;
        // Slow down vertical speed (air resistance)
        this.vy *= Math.pow(0.992, dt * 60);
        // Color cools from orange to dark red as it rises
        this.cooling = Math.min(1, this.cooling + dt * 0.4);
        this.g = Math.max(20, (140 + 90 * (1 - this.cooling)) - this.cooling * 80);
        break;

      case 'spark':
        if (this.trail.length > 5) this.trail.shift();
        this.trail.push({ x: this.x, y: this.y });
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.97;
        this.vy *= 0.97;
        this.vy += 50 * dt; // gravity
        break;

      case 'smoke':
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Curl/wobble — smoke billows side to side as it rises
        this.x += Math.sin(this.wobblePhase + performance.now() / 1200 * 1.5) * this.wobbleAmp * dt * 28;
        this.size += dt * 10;
        this.rotation += this.rotSpeed * dt;
        this.vx *= 0.99;
        this.vy *= 0.998; // slower deceleration — smoke rises higher
        break;

      case 'ash':
        this.x += this.vx * dt + Math.sin(this.wobblePhase + performance.now() / 1000 * 1.5) * 0.5;
        this.y += this.vy * dt;
        break;

      case 'burst':
      case 'colorBurst':
        if (this.trail) {
          if (this.trail.length > 4) this.trail.shift();
          this.trail.push({ x: this.x, y: this.y });
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += (this.gravity || 80) * dt;
        this.vx *= 0.98;
        break;
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    const progress = 1 - this.life / this.maxLife;
    const alpha = Math.max(0, 1 - progress);

    switch (this.type) {
      case 'ember': {
        const a = alpha * (0.6 + 0.4 * Math.sin(performance.now() / 1000 * 5 + this.wobblePhase));
        const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * (1 + progress));
        grd.addColorStop(0, `rgba(${this.r},${this.g},${this.b},${a})`);
        grd.addColorStop(0.4, `rgba(${this.r},${Math.max(0, this.g - 50)},0,${a * 0.6})`);
        grd.addColorStop(1, `rgba(${this.r},0,0,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (1 + progress * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'spark': {
        // Trail
        if (this.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx.lineTo(this.x, this.y);
          ctx.strokeStyle = `rgba(${this.r},${this.g},${this.b},${alpha * 0.3})`;
          ctx.lineWidth = this.size * 0.5;
          ctx.stroke();
        }
        // Head
        const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grd.addColorStop(0.3, `rgba(${this.r},${this.g},${this.b},${alpha * 0.8})`);
        grd.addColorStop(1, `rgba(${this.r},${this.g},0,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'smoke': {
        const a = this.opacity * alpha * (1 - progress * 0.5);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grd.addColorStop(0, `rgba(60,55,50,${a})`);
        grd.addColorStop(0.5, `rgba(40,38,35,${a * 0.5})`);
        grd.addColorStop(1, `rgba(30,28,25,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      case 'ash': {
        const a = this.opacity * alpha;
        ctx.fillStyle = `rgba(120,110,100,${a})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'burst': {
        const grd = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * (1 - progress * 0.5));
        grd.addColorStop(0, `rgba(255,255,200,${alpha})`);
        grd.addColorStop(0.4, `rgba(${this.r},${this.g},${this.b},${alpha * 0.7})`);
        grd.addColorStop(1, `rgba(${this.r},0,0,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'colorBurst': {
        if (this.trail && this.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(this.trail[0].x, this.trail[0].y);
          for (let i = 1; i < this.trail.length; i++) {
            ctx.lineTo(this.trail[i].x, this.trail[i].y);
          }
          ctx.lineTo(this.x, this.y);
          ctx.strokeStyle = `rgba(${this.r},${this.g},${this.b},${alpha * 0.4})`;
          ctx.lineWidth = this.size * 0.6;
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${alpha})`;
        ctx.shadowColor = `rgba(${this.r},${this.g},${this.b},0.5)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
    }
  }
}

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.emitters = {
      ember: { timer: 0, rate: 0.08 },
      smoke: { timer: 0, rate: 0.5 },
      ash: { timer: 0, rate: 1.0 },
      crackle: { timer: 2 + Math.random() * 3, rate: 3.0 },
    };
    this.fireCenter = { x: 0.5, y: 0.7 }; // normalized
    this.intensity = 0.5;
    this.emberRate = 0.6; // computed by setIntensity()
    this.wind = 0;
    this.maxParticles = 500;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth * dpr;
    const h = this.canvas.clientHeight * dpr;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setIntensity(intensity) {
    this.intensity = intensity;
    // intensity < 0.2: no embers; intensity > 0.8: full activity
    this.emberRate = Math.max(0, intensity - 0.2) * 2;

    if (intensity < 0.01) {
      // Fire is out — stop all emitters
      this.emitters.ember.rate = 999;
      this.emitters.smoke.rate = 999;
      this.emitters.ash.rate   = 999;
    } else {
      const baseEmber = 0.06;
      const baseSmoke = 0.45;
      this.emitters.ember.rate = Math.max(0.025, baseEmber / Math.max(0.5, intensity));
      this.emitters.smoke.rate = Math.max(0.18,  baseSmoke / Math.max(0.5, intensity));
      this.emitters.ash.rate   = Math.max(0.6,   2.0       / Math.max(0.5, intensity));
    }
  }

  setWind(val) {
    this.wind = val;
  }

  /**
   * Emit ember particles from fire area
   */
  emitEmber(count = 1) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * this.fireCenter.x;
    const baseY = h * this.fireCenter.y;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const x = cx + (Math.random() - 0.5) * w * 0.15 * this.intensity;
      const y = baseY - Math.random() * h * 0.15 * this.intensity;
      this.particles.push(new Particle(x, y, 'ember', { wind: this.wind }));
    }
  }

  /**
   * Emit smoke particles above fire
   */
  emitSmoke(count = 1) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * this.fireCenter.x;
    const baseY = h * this.fireCenter.y - h * 0.15 * this.intensity;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const x = cx + (Math.random() - 0.5) * w * 0.1;
      const y = baseY - Math.random() * h * 0.05;
      this.particles.push(new Particle(x, y, 'smoke', { wind: this.wind }));
    }
  }

  /**
   * Emit ash particles (falling down)
   */
  emitAsh(count = 1) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const x = Math.random() * w;
      const y = -10;
      this.particles.push(new Particle(x, y, 'ash'));
    }
  }

  /**
   * Emit crackle sparks (random pops from fire — auto-emitted)
   */
  emitCrackle() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w * this.fireCenter.x;
    const baseY = h * this.fireCenter.y;

    const n = 1 + Math.floor(Math.random() * 3); // 1-3 sparks per crackle
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const x = cx + (Math.random() - 0.5) * w * 0.08;
      const y = baseY - Math.random() * h * 0.12;
      // Upward-biased angle
      const angle = -Math.PI * (0.2 + Math.random() * 0.6);
      this.particles.push(new Particle(x, y, 'spark', {
        angle,
        speed: 30 + Math.random() * 100,
      }));
    }
  }

  /**
   * Create a burst of sparks (when item is thrown)
   */
  sparkBurst(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles + 100) break;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      this.particles.push(new Particle(x, y, 'spark', {
        angle: angle,
        speed: 80 + Math.random() * 200,
      }));
    }
  }

  /**
   * Create explosion burst
   */
  explosionBurst(x, y, count = 40, opts = {}) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push(new Particle(x, y, 'burst', {
        angle,
        speed: 100 + Math.random() * 300,
        r: opts.r,
        g: opts.g,
        b: opts.b,
      }));
    }
  }

  /**
   * Create colorful burst (fireworks, special items)
   */
  colorBurst(x, y, count = 50, colors = null) {
    const defaultColors = [
      [255, 50, 50], [50, 255, 50], [50, 50, 255],
      [255, 255, 50], [255, 50, 255], [50, 255, 255],
      [255, 150, 0], [255, 100, 200],
    ];
    const palette = colors || defaultColors;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const c = palette[Math.floor(Math.random() * palette.length)];
      this.particles.push(new Particle(x, y, 'colorBurst', {
        angle,
        speed: 60 + Math.random() * 250,
        r: c[0], g: c[1], b: c[2],
      }));
    }
  }

  update(dt) {
    // Auto-emit based on fire intensity
    if (this.intensity > 0.1) {
      // Embers — only emit when intensity is above the ember threshold
      if (this.intensity > 0.2) {
        this.emitters.ember.timer -= dt;
        if (this.emitters.ember.timer <= 0) {
          this.emitEmber(Math.ceil(this.intensity));
          this.emitters.ember.timer = this.emitters.ember.rate;
        }
      }

      // Smoke
      this.emitters.smoke.timer -= dt;
      if (this.emitters.smoke.timer <= 0) {
        this.emitSmoke();
        this.emitters.smoke.timer = this.emitters.smoke.rate;
      }

      // Ash (very occasional)
      this.emitters.ash.timer -= dt;
      if (this.emitters.ash.timer <= 0) {
        this.emitAsh();
        this.emitters.ash.timer = this.emitters.ash.rate;
      }

      // Crackle sparks (random pops — the sound of a campfire)
      if (this.intensity > 0.3) {
        this.emitters.crackle.timer -= dt;
        if (this.emitters.crackle.timer <= 0) {
          this.emitCrackle();
          this.emitters.crackle.timer = 1.5 + Math.random() * 4; // 1.5-5.5s random interval
        }
      }
    }

    // Update all particles
    for (const p of this.particles) {
      p.update(dt);
    }
    this.particles = this.particles.filter(p => p.alive);
  }

  render() {
    this.resize();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw by type layer for correct visual ordering (avoid sorting every frame)
    const order = ['smoke', 'ash', 'ember', 'burst', 'spark', 'colorBurst'];
    for (const type of order) {
      for (const p of this.particles) {
        if (p.type === type) p.draw(ctx);
      }
    }
  }
}
