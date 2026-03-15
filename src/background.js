/**
 * background.js
 * Night sky with stars, moon, tree silhouettes, and ground/log silhouette
 */

export class Background {
  constructor(bgCanvas, groundCanvas) {
    this.bgCanvas = bgCanvas;
    this.bgCtx = bgCanvas.getContext('2d');
    this.groundCanvas = groundCanvas;
    this.groundCtx = groundCanvas.getContext('2d');
    this.stars = [];
    this._initStars();
    this._needsRedraw = true;
  }

  _initStars() {
    // Generate random stars — more than before, various sizes
    for (let i = 0; i < 160; i++) {
      const brightness = 0.2 + Math.random() * 0.8;
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.60,
        size: 0.4 + Math.random() * (brightness > 0.6 ? 2.0 : 1.2),
        brightness,
        twinkleSpeed: 0.3 + Math.random() * 1.5,
        twinklePhase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.15 ? [200, 220, 255] : (Math.random() < 0.1 ? [255, 220, 180] : [255, 250, 240]),
      });
    }
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const canvas of [this.bgCanvas, this.groundCanvas]) {
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        this._needsRedraw = true;
      }
    }
  }

  renderBackground(time) {
    this.resize();
    const ctx = this.bgCtx;
    const w = this.bgCanvas.width;
    const h = this.bgCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // === Night sky gradient (slightly warm horizon from fire glow) ===
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0,    '#03030d');
    skyGrad.addColorStop(0.25, '#060614');
    skyGrad.addColorStop(0.55, '#0e0a18');
    skyGrad.addColorStop(0.75, '#180e0a');
    skyGrad.addColorStop(1,    '#100805');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // === Subtle fire horizon glow (distant amber haze) ===
    const horizonY = h * 0.72;
    const horizonGlow = ctx.createRadialGradient(w * 0.5, horizonY, 0, w * 0.5, horizonY, w * 0.65);
    horizonGlow.addColorStop(0,    'rgba(180, 70, 15, 0.14)');
    horizonGlow.addColorStop(0.4,  'rgba(100, 35, 8,  0.06)');
    horizonGlow.addColorStop(1,    'transparent');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, w, h);

    // === Moon (crescent) ===
    this._drawMoon(ctx, w, h, time);

    // === Stars with twinkling ===
    const t = time / 1000;
    for (const star of this.stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(t * star.twinkleSpeed + star.twinklePhase);
      const alpha = star.brightness * twinkle;
      const x = star.x * w;
      const y = star.y * h;
      const [r, g, b] = star.color;

      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();

      // Glow for brighter stars
      if (star.brightness > 0.65 && star.size > 1.2) {
        const grd = ctx.createRadialGradient(x, y, 0, x, y, star.size * 4);
        grd.addColorStop(0,   `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
        grd.addColorStop(1,   'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === Tree silhouettes ===
    const groundY = h * 0.72;
    // Left cluster
    this._drawPineTree(ctx, w * 0.04, groundY, h * 0.28, w * 0.065);
    this._drawPineTree(ctx, w * 0.12, groundY - h * 0.01, h * 0.22, w * 0.055);
    this._drawPineTree(ctx, -w * 0.01, groundY + h * 0.01, h * 0.19, w * 0.05);
    // Right cluster
    this._drawPineTree(ctx, w * 0.96, groundY, h * 0.26, w * 0.06);
    this._drawPineTree(ctx, w * 0.88, groundY - h * 0.015, h * 0.23, w * 0.058);
    this._drawPineTree(ctx, w * 1.02, groundY + h * 0.01, h * 0.18, w * 0.048);
    // Far background trees (shorter, dimmer)
    this._drawPineTree(ctx, w * 0.22, groundY + h * 0.02, h * 0.13, w * 0.04, 0.35);
    this._drawPineTree(ctx, w * 0.78, groundY + h * 0.02, h * 0.14, w * 0.04, 0.35);
  }

  _drawMoon(ctx, w, h, time) {
    const moonX = w * 0.80;
    const moonY = h * 0.11;
    const moonR = Math.min(w, h) * 0.038;

    ctx.save();

    // Moon glow
    const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 3.5);
    moonGlow.addColorStop(0,   'rgba(255, 240, 200, 0.12)');
    moonGlow.addColorStop(0.5, 'rgba(200, 190, 160, 0.05)');
    moonGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Moon body
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 245, 215, 0.92)';
    ctx.fill();

    // Crescent shadow (slightly offset circle)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.48, moonY - moonR * 0.10, moonR * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Subtle surface details
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#8a8070';
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.3, moonY - moonR * 0.1, moonR * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.05, moonY + moonR * 0.35, moonR * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.restore();
  }

  /**
   * Draw a pine tree silhouette
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - center x
   * @param {number} groundY - ground level y
   * @param {number} height - total tree height
   * @param {number} width - base tier width
   * @param {number} opacity - 0..1
   */
  _drawPineTree(ctx, x, groundY, height, width, opacity = 1.0) {
    const tiers = 4;
    ctx.save();
    ctx.globalAlpha = opacity;

    // Tree fill: pure silhouette black with faint amber warmth at base from campfire
    const treeGrad = ctx.createLinearGradient(x, groundY - height, x, groundY);
    treeGrad.addColorStop(0,    '#000000');
    treeGrad.addColorStop(0.55, '#020202');
    treeGrad.addColorStop(1,    '#0e0602');   // barely-warm tint at ground level
    ctx.fillStyle = treeGrad;

    // Trunk
    const trunkW = width * 0.07;
    const trunkH = height * 0.18;
    ctx.fillRect(x - trunkW / 2, groundY - trunkH, trunkW, trunkH);

    // Tiers from bottom to top
    for (let t = 0; t < tiers; t++) {
      const frac = t / tiers;
      const tierBaseY = groundY - trunkH - height * frac * 0.82;
      const tierTopY  = tierBaseY - height * (0.35 - t * 0.05);
      const tierW     = width * (1.0 - frac * 0.60);

      ctx.beginPath();
      ctx.moveTo(x, tierTopY);
      ctx.lineTo(x + tierW / 2, tierBaseY);
      ctx.lineTo(x - tierW / 2, tierBaseY);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  renderGround(fireIntensity) {
    const ctx = this.groundCtx;
    const w = this.groundCanvas.width;
    const h = this.groundCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const groundY = h * 0.72;

    // Ground glow from fire — warm orange-amber pool
    const glowAlpha = Math.min(0.55, fireIntensity * 0.30);
    const glowR = w * 0.50;
    const groundGlow = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, glowR);
    groundGlow.addColorStop(0,   `rgba(220, 90, 20, ${glowAlpha})`);
    groundGlow.addColorStop(0.3, `rgba(160, 55, 10, ${glowAlpha * 0.55})`);
    groundGlow.addColorStop(0.6, `rgba(80,  28,  5, ${glowAlpha * 0.20})`);
    groundGlow.addColorStop(1,   'transparent');
    ctx.fillStyle = groundGlow;
    ctx.fillRect(0, groundY - h * 0.12, w, h * 0.5);

    // Ground surface (dark earth)
    const groundGrad = ctx.createLinearGradient(0, groundY - 4, 0, h);
    groundGrad.addColorStop(0,   'rgba(28, 18, 10, 0.92)');
    groundGrad.addColorStop(0.08,'rgba(18, 12,  7, 0.97)');
    groundGrad.addColorStop(1,   'rgba(8,   5,  3, 1.0)');
    ctx.fillStyle = groundGrad;

    ctx.beginPath();
    ctx.moveTo(0, groundY + 8);
    ctx.quadraticCurveTo(cx, groundY - 12, w, groundY + 8);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // === Log silhouettes & stone ring ===
    ctx.save();
    ctx.translate(cx, groundY);

    this._drawStoneRing(ctx, 0, 4, w * 0.115, fireIntensity);

    // Main crossed logs
    this._drawLog(ctx, -w * 0.08, 0,  w * 0.07, 0,   w * 0.19, 13, fireIntensity);
    this._drawLog(ctx,  w * 0.09, 2, -w * 0.06, -2,  w * 0.17, 12, fireIntensity);
    // Supporting log leaning
    this._drawLog(ctx, -w * 0.03, 5,  w * 0.04, -14, w * 0.13, 10, fireIntensity);

    ctx.restore();
  }

  _drawStoneRing(ctx, cx, cy, radius, intensity) {
    const stoneCount = 13;
    const stoneSize  = radius * 0.21;
    const glowAmount = Math.min(0.55, intensity * 0.22);

    for (let i = 0; i < stoneCount; i++) {
      const angle = (Math.PI * 2 * i) / stoneCount - Math.PI / 2;
      const sx = cx + Math.cos(angle) * radius;
      const sy = cy + Math.sin(angle) * radius * 0.38;

      if (glowAmount > 0) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, stoneSize * 2.0, stoneSize * 1.3, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 90, 20, ${glowAmount * 0.28})`;
        ctx.fill();
      }

      // Deterministic shade per stone (avoid flicker from Math.random each frame)
      const shade = 22 + ((i * 7 + 3) % 12);
      ctx.beginPath();
      ctx.ellipse(sx, sy, stoneSize, stoneSize * 0.62, angle * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${shade + glowAmount * 70}, ${shade + glowAmount * 22}, ${shade})`;
      ctx.fill();
    }
  }

  _drawLog(ctx, x1, y1, x2, y2, length, thickness, intensity) {
    ctx.save();

    const midX  = (x1 + x2) / 2;
    const midY  = (y1 + y2) / 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.translate(midX, midY);
    ctx.rotate(angle);

    const glowAmount = Math.min(0.6, intensity * 0.22);

    // Log glow
    if (glowAmount > 0.05) {
      const glow = ctx.createRadialGradient(0, 0, thickness * 0.5, 0, 0, thickness * 3.5);
      glow.addColorStop(0, `rgba(255, 110, 25, ${glowAmount * 0.35})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.fillRect(-length * 0.6, -thickness * 3.5, length * 1.2, thickness * 7);
    }

    // Log body
    const logGrad = ctx.createLinearGradient(0, -thickness / 2, 0, thickness / 2);
    const r = 32 + glowAmount * 90;
    const g = 20 + glowAmount * 32;
    const b = 10 + glowAmount * 6;
    logGrad.addColorStop(0,   `rgb(${r + 12}, ${g + 6}, ${b})`);
    logGrad.addColorStop(0.3, `rgb(${r},      ${g},     ${b})`);
    logGrad.addColorStop(0.7, `rgb(${r - 8},  ${g - 5}, ${b - 3})`);
    logGrad.addColorStop(1,   `rgb(${r - 16}, ${g - 10},${b - 5})`);
    ctx.fillStyle = logGrad;

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-length / 2, -thickness / 2, length, thickness, thickness * 0.28);
    } else {
      ctx.rect(-length / 2, -thickness / 2, length, thickness);
    }
    ctx.fill();

    // Bark texture
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.12 + glowAmount * 0.08})`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 7; i++) {
      const lx = -length / 2 + (length / 7) * i + ((i * 3 + 1) % 8 - 4);
      ctx.beginPath();
      ctx.moveTo(lx,     -thickness / 2 + 2);
      ctx.lineTo(lx + 3,  thickness / 2 - 2);
      ctx.stroke();
    }

    // Log end cross-section
    const endX = length / 2;
    ctx.beginPath();
    ctx.ellipse(endX, 0, thickness / 2, thickness / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${r + 18}, ${g + 9}, ${b + 6})`;
    ctx.fill();

    for (const ringR of [0.30, 0.16]) {
      ctx.beginPath();
      ctx.arc(endX, 0, thickness * ringR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    ctx.restore();
  }
}
