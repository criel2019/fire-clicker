/**
 * fire-engine.js
 * WebGL campfire shader — 불멍 quality
 *
 * Complete rewrite:
 * - Multi-tongue flame structure via edge noise
 * - Curl-noise domain warping for organic swirl
 * - Height-accelerated advection (convection physics)
 * - Temperature-based color = f(density, height)
 * - Rotated FBM octaves to eliminate axis-aligned artifacts
 * - Proper campfire taper (wide base → narrow tips)
 * - Sharp, defined tongue edges at tips
 */

// ── Vertex shader ──
const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// ── Fragment shader ──
const FRAG_SRC = `
precision highp float;

varying vec2 v_uv;
uniform float u_time;
uniform float u_intensity;
uniform float u_wind;
uniform vec3  u_tint;
uniform vec2  u_resolution;
uniform float u_breath;

// ── Simplex 2D noise (Ashima Arts) ──
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289v2(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                           dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x * x0.x  + h.x * x0.y;
  g.yz = a0.yz* x12.xz + h.yz* x12.yw;
  return 130.0 * dot(m, g);
}

// Rotation matrix between FBM octaves — breaks axis-aligned banding
const mat2 FBM_ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm4(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * snoise(p);
    a *= 0.5;
    p = FBM_ROT * p * 2.0;
  }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    a *= 0.5;
    p = FBM_ROT * p * 2.0;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time;
  float intCl = clamp(u_intensity, 0.0, 1.5);

  // ── Fire coordinate system ──
  // Contained proportions — campfire, not inferno
  // fireBaseY: WebGL UV space (y=0 at bottom, y=1 at top)
  float fireBaseY = 0.28;
  float fireHeight = 0.20 + intCl * 0.07;
  float fireWidth  = 0.12 + intCl * 0.025;

  // fUV: x=0 centered, y=0 at base, y=1 at tip (fire goes UP)
  vec2 fUV = vec2(
    (uv.x - 0.5) * aspect / fireWidth,
    (uv.y - fireBaseY) / fireHeight
  );

  // Early exit — skip pixels far from fire
  if (fUV.y < -0.15 || fUV.y > 1.4 || abs(fUV.x) > 2.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float h01 = clamp(fUV.y, 0.0, 1.0);

  // ── Wind: height-dependent lean ──
  fUV.x += u_wind * h01 * h01 * 0.4;

  // ── Convection: flames accelerate upward ──
  float advect = 1.0 + h01 * 2.5;


  // ═══════════════════════════════════════
  //  SHAPE: proper campfire taper + tongues
  // ═══════════════════════════════════════

  // Base shape: slightly pinched at embers, wide just above, tapering to tip
  float basePinch = smoothstep(0.0, 0.08, h01);
  float taper     = pow(1.0 - h01, 1.1);
  float rawWidth  = basePinch * taper;

  // Tongue edge noise — creates flame tongue protrusions
  // Major tongues: 2-3 wide, slow-rolling protrusions
  float tng1 = snoise(vec2(fUV.x * 2.5 + 0.5, fUV.y * 2.0 - t * 1.2));
  // Secondary tongues: narrower, faster
  float tng2 = snoise(vec2(fUV.x * 5.5 - 1.2, fUV.y * 3.5 - t * 2.0));
  // Fine turbulence: tip shimmer
  float tng3 = snoise(vec2(fUV.x * 10.0 + 2.0, fUV.y * 5.0 - t * 3.2));

  // Tongue intensity grows with height: base is smooth, tips are wild
  float tongueStr = h01 * h01;
  float tongueOffset = (tng1 * 0.28 + tng2 * 0.13 + tng3 * 0.06) * tongueStr;

  float modWidth = max(rawWidth + tongueOffset * 0.35, 0.0);

  // Edge sharpness: soft glow at base, crisp defined tongues at tips
  float edgeSoft = mix(0.22, 0.025, h01);
  float xMask = smoothstep(modWidth, modWidth - edgeSoft, abs(fUV.x));

  // Y fade: gentle entry, long natural fadeout
  float yFade = smoothstep(-0.02, 0.06, fUV.y)
              * (1.0 - smoothstep(0.60, 1.12, fUV.y));

  float shape = xMask * yFade;


  // ═══════════════════════════════════════
  //  DOMAIN WARPING (curl-noise inspired)
  // ═══════════════════════════════════════

  vec2 warpSeed = fUV * 2.5;
  warpSeed.y -= t * advect * 0.3;

  vec2 q = vec2(
    fbm3(warpSeed + vec2(t * 0.32, 0.0)),
    fbm3(warpSeed + vec2(0.0, t * 0.38) + 5.2)
  );

  // Curl direction: perpendicular to warp gradient → swirl, not stretch
  vec2 curlWarp = vec2(q.y, -q.x) * 0.5;

  vec2 warpedUV = fUV * 3.5 + curlWarp;
  warpedUV.y -= t * advect;

  vec2 r = vec2(
    fbm3(warpedUV + vec2(t * 0.12, -t * 0.08) + 1.7),
    fbm3(warpedUV + vec2(-t * 0.1,  t * 0.14) + 9.2)
  );


  // ═══════════════════════════════════════
  //  FIRE DENSITY
  // ═══════════════════════════════════════

  vec2 fireCoord = fUV * 4.0 + r * 0.4;
  fireCoord.y -= t * advect;
  float density = fbm4(fireCoord);

  // High-frequency detail layer for crispness
  float detail = snoise(fUV * 9.0 + r * 0.2
                        - vec2(0.0, t * advect * 1.3));
  density = density * 0.78 + detail * 0.22;

  // Spatially-varying breathing (base steady, tips breathe)
  float breath = 1.0 + u_breath * 0.04 * (1.0 - h01 * 0.5);

  // Combine
  float fire = shape * (0.42 + density * 0.58) * intCl * breath;
  fire = clamp(fire, 0.0, 1.0);


  // ═══════════════════════════════════════
  //  TONGUE TIP FLICKER
  // ═══════════════════════════════════════

  float flicker = snoise(vec2(fUV.x * 4.5, t * 4.2)) * 0.11
                + snoise(vec2(fUV.x * 9.0, t * 6.5)) * 0.05;
  fire += flicker * tongueStr * shape * intCl * 0.7;
  fire = clamp(fire, 0.0, 1.0);


  // ═══════════════════════════════════════
  //  COLOR: temperature = f(density, height)
  // ═══════════════════════════════════════

  // Temperature: hot at base (high density, low height), cool at tips
  float temperature = fire * (1.0 - h01 * 0.55);

  vec3 c;
  // Ember black → deep crimson
  c  = mix(vec3(0.05, 0.003, 0.0),   vec3(0.28, 0.025, 0.0),
           smoothstep(0.00, 0.10, temperature));
  // → rich red
  c  = mix(c, vec3(0.60, 0.08, 0.005),
           smoothstep(0.06, 0.22, temperature));
  // → vivid orange
  c  = mix(c, vec3(1.00, 0.35, 0.015),
           smoothstep(0.18, 0.38, temperature));
  // → warm orange-yellow
  c  = mix(c, vec3(1.00, 0.58, 0.05),
           smoothstep(0.32, 0.52, temperature));
  // → bright gold
  c  = mix(c, vec3(1.00, 0.80, 0.18),
           smoothstep(0.46, 0.68, temperature));
  // → near-white hot
  c  = mix(c, vec3(1.00, 0.93, 0.50),
           smoothstep(0.65, 0.88, temperature));

  // Height-based tint: flame tips skew redder regardless of density
  c *= mix(vec3(1.0), vec3(1.0, 0.50, 0.18), h01 * h01 * 0.45);

  // Blue combustion zone: paper-thin, right above the embers
  float blueZone = smoothstep(0.04, -0.01, fUV.y)
                 * smoothstep(0.30, 0.0, abs(fUV.x))
                 * intCl * fire;
  c = mix(c, vec3(0.10, 0.25, 0.75), blueZone * 0.15);

  // Apply game tint
  c *= u_tint;


  // ═══════════════════════════════════════
  //  ALPHA
  // ═══════════════════════════════════════

  float alpha = smoothstep(0.015, 0.09, fire);
  // Progressive tip fade — no hard cutoff
  alpha *= mix(1.0, 0.35, smoothstep(0.80, 1.15, h01));

  // Minimal ambient glow (barely perceptible warmth)
  float glow  = shape * intCl * 0.02 * (1.0 - h01);
  float glowA = glow * (1.0 - alpha) * 0.2;
  c    += vec3(0.30, 0.08, 0.01) * u_tint * glowA;
  alpha = max(alpha, glowA * 0.2);

  gl_FragColor = vec4(c * alpha, alpha);
}
`;


export class FireEngine {
  constructor(canvas) {
    this.canvas = canvas;

    // ── State ──
    this.intensity       = 0.80;
    this.targetIntensity = 0.80;
    this.wind            = 0;
    this.targetWind      = 0;
    this.tint            = [1, 1, 1];
    this.targetTint      = [1, 1, 1];
    this.boostTimer      = 0;
    this.boostIntensity  = 0;
    this._breathPhase    = Math.random() * Math.PI * 2;
    this._breathSpeed    = 0.7 + Math.random() * 0.3;
    this._gustTimer      = 2 + Math.random() * 4;
    this._gustStrength   = 0;
    this._time           = 0;

    // ── WebGL init ──
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      preserveDrawingBuffer: false,
    }) || canvas.getContext('experimental-webgl', {
      alpha: true,
      premultipliedAlpha: true,
    });

    if (!gl) {
      console.warn('WebGL not available, fire will not render');
      this._isWebGL = false;
      return;
    }

    this.gl = gl;
    this._isWebGL = true;
    this._initWebGL(gl);
  }

  _initWebGL(gl) {
    const vs = this._compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(prog));
      this._isWebGL = false;
      return;
    }

    this._prog = prog;

    this._aPos        = gl.getAttribLocation(prog, 'a_pos');
    this._uTime       = gl.getUniformLocation(prog, 'u_time');
    this._uIntensity  = gl.getUniformLocation(prog, 'u_intensity');
    this._uWind       = gl.getUniformLocation(prog, 'u_wind');
    this._uTint       = gl.getUniformLocation(prog, 'u_tint');
    this._uResolution = gl.getUniformLocation(prog, 'u_resolution');
    this._uBreath     = gl.getUniformLocation(prog, 'u_breath');

    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    this._vbo = buf;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }

  _compileShader(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
    }
    return s;
  }

  resize() {
    // Full-quality rendering — fire detail needs resolution
    const scale = 0.9;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth  * dpr * scale);
    const h = Math.round(this.canvas.clientHeight * dpr * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w;
      this.canvas.height = h;
    }
  }

  // ── Public API (identical interface) ──

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
    if (!this._isWebGL) return;

    this.resize();

    // Update boost
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
    } else {
      this.boostIntensity *= Math.pow(0.12, dt);
    }

    // Smooth lerp toward targets
    const ls  = Math.min(2.5 * dt, 1);
    const tgt = this.targetIntensity + this.boostIntensity;
    this.intensity += (tgt - this.intensity) * ls;
    this.wind      += (this.targetWind - this.wind) * (ls * 0.4);
    for (let i = 0; i < 3; i++) {
      this.tint[i] += (this.targetTint[i] - this.tint[i]) * ls;
    }

    // Breathing phase
    this._breathPhase += dt * this._breathSpeed * Math.PI * 2;

    // Natural wind turbulence (multi-frequency)
    const now = performance.now();
    const w1 = Math.sin(now / 1800) * 0.08;
    const w2 = Math.sin(now / 750)  * 0.05;
    const w3 = Math.sin(now / 330 + 1.7) * 0.025;
    const w4 = Math.sin(now / 5200) * 0.12;
    const natWind = w1 + w2 + w3 + w4;

    // Random gusts
    this._gustTimer -= dt;
    if (this._gustTimer <= 0) {
      this._gustStrength = (Math.random() - 0.5) * 0.25;
      this._gustTimer = 2 + Math.random() * 5;
    }
    this._gustStrength *= Math.pow(0.06, dt);
    this.wind += (natWind + this._gustStrength - this.wind) * 0.03;

    // Accumulate time
    this._time += dt;

    // Breathing value (multi-harmonic)
    const breathVal = Math.sin(this._breathPhase)
                    + Math.sin(this._breathPhase * 2.3 + 0.5) * 0.5;

    // ── Draw ──
    const gl = this.gl;
    const w  = this.canvas.width;
    const h  = this.canvas.height;

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this.intensity < 0.005) return;

    gl.useProgram(this._prog);

    gl.uniform1f(this._uTime,      this._time);
    gl.uniform1f(this._uIntensity,  this.intensity);
    gl.uniform1f(this._uWind,       this.wind);
    gl.uniform3f(this._uTint,       this.tint[0], this.tint[1], this.tint[2]);
    gl.uniform2f(this._uResolution, w, h);
    gl.uniform1f(this._uBreath,     breathVal);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.enableVertexAttribArray(this._aPos);
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
