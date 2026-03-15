/**
 * fire-engine.js
 * WebGL shader-based fire simulation for 불멍-quality campfire
 * Uses Simplex noise FBM with domain warping for organic, mesmerizing flames
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

// ── Simplex 2D Noise (Ashima Arts) ──
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289v2(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0= v - i + dot(i, C.xx);
  vec2 i1= (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12= x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox= floor(x + 0.5);
  vec3 a0= x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x  + h.x * x0.y;
  g.yz= a0.yz* x12.xz + h.yz* x12.yw;
  return 130.0 * dot(m, g);
}

// ── FBM with 5 octaves ──
float fbm5(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    a *= 0.5;
    p *= 2.0;
  }
  return v;
}

// ── FBM with 3 octaves (for warping — faster) ──
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * snoise(p);
    a *= 0.5;
    p *= 2.0;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // ── Fire coordinate system ──
  // Base of fire at 72% from top, fire extends upward
  float fireBaseY = 0.72;
  float intClamped = clamp(u_intensity, 0.0, 1.5);
  float fireHeight = 0.28 + intClamped * 0.10;  // taller with more intensity
  float fireWidth  = 0.16 + intClamped * 0.04;  // wider with more intensity

  // Transform to fire-local coords: y=0 at base, y=1 at top
  vec2 fUV = vec2(
    (uv.x - 0.5) * aspect / fireWidth,
    -(uv.y - fireBaseY) / fireHeight
  );

  // Early exit for pixels outside fire region (saves GPU)
  if (fUV.y < -0.2 || fUV.y > 1.5 || abs(fUV.x) > 2.5) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float t = u_time;

  // ── Wind displacement (quadratic — stronger at top) ──
  float windDisp = u_wind * fUV.y * fUV.y * 0.35;
  fUV.x += windDisp;

  // ── Breathing modulation ──
  float breath = 1.0 + u_breath * 0.07;

  // ── Fire shape mask ──
  // Width tapers from base to tip
  float h01 = clamp(fUV.y, 0.0, 1.0);
  float widthAtH = mix(1.0, 0.12, pow(h01, 0.55));
  float xFade = 1.0 - smoothstep(0.0, widthAtH, abs(fUV.x));
  float yFade = smoothstep(-0.05, 0.10, fUV.y)
              * (1.0 - smoothstep(0.55, 1.05, fUV.y));
  float shape = xFade * yFade;

  // ── Domain warping for organic turbulence ──
  vec2 q = vec2(
    fbm3(fUV * 2.0 + vec2(t * 0.35, t * 0.1)),
    fbm3(fUV * 2.0 + vec2(t * 0.1, t * 0.45) + 5.2)
  );

  vec2 r = vec2(
    fbm3(fUV * 2.8 + q * 1.4 + vec2(t * 0.18, t * 0.22) + 1.7),
    fbm3(fUV * 2.8 + q * 1.4 + vec2(t * 0.22, t * 0.12) + 9.2)
  );

  // ── Main fire noise ──
  vec2 fireCoord = fUV * 2.5 + r * 0.55;
  fireCoord.y -= t * 1.8;  // upward scroll
  float noise = fbm5(fireCoord);

  // ── Combine shape + noise ──
  float fire = shape * (0.52 + noise * 0.48) * intClamped * breath;
  fire = clamp(fire, 0.0, 1.0);

  // ── Flame tip flicker ──
  float tipFlicker = snoise(vec2(fUV.x * 5.0, t * 3.5)) * 0.12 * h01;
  fire += tipFlicker * shape * intClamped * 0.5;
  fire = clamp(fire, 0.0, 1.0);

  // ── Campfire color gradient ──
  // Dark ember → deep crimson → vivid orange → amber → gold → warm white
  vec3 c;
  c  = mix(vec3(0.10, 0.015, 0.0),  vec3(0.45, 0.06, 0.0),  smoothstep(0.00, 0.18, fire));
  c  = mix(c, vec3(0.90, 0.25, 0.02), smoothstep(0.12, 0.38, fire));
  c  = mix(c, vec3(1.00, 0.55, 0.06), smoothstep(0.30, 0.55, fire));
  c  = mix(c, vec3(1.00, 0.78, 0.18), smoothstep(0.45, 0.70, fire));
  c  = mix(c, vec3(1.00, 0.92, 0.45), smoothstep(0.60, 0.85, fire));
  c  = mix(c, vec3(1.00, 0.97, 0.78), smoothstep(0.80, 1.00, fire));

  // ── Blue base zone (complete combustion — realistic campfire detail) ──
  float blueZone = smoothstep(0.12, -0.02, fUV.y)
                 * (1.0 - smoothstep(0.0, 0.55, abs(fUV.x)))
                 * intClamped;
  c = mix(c, vec3(0.25, 0.45, 1.0), blueZone * 0.35);

  // ── Apply tint ──
  c *= u_tint;

  // ── Alpha ──
  float alpha = smoothstep(0.015, 0.14, fire);

  // ── Soft outer glow (ambient warmth around fire) ──
  float glow = shape * intClamped * 0.12 * breath;
  vec3 glowCol = vec3(0.7, 0.25, 0.04) * u_tint;
  float glowAlpha = glow * 0.5 * (1.0 - alpha);
  c += glowCol * glowAlpha;
  alpha = max(alpha, glowAlpha * 0.7);

  // ── Premultiplied alpha output ──
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
    // ── Compile shaders ──
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

    // ── Attributes ──
    this._aPos = gl.getAttribLocation(prog, 'a_pos');

    // ── Uniforms ──
    this._uTime       = gl.getUniformLocation(prog, 'u_time');
    this._uIntensity   = gl.getUniformLocation(prog, 'u_intensity');
    this._uWind        = gl.getUniformLocation(prog, 'u_wind');
    this._uTint        = gl.getUniformLocation(prog, 'u_tint');
    this._uResolution  = gl.getUniformLocation(prog, 'u_resolution');
    this._uBreath      = gl.getUniformLocation(prog, 'u_breath');

    // ── Fullscreen quad buffer ──
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    this._vbo = buf;

    // ── GL state ──
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
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

  // ── Canvas resize ──
  resize() {
    // Render at 0.65x resolution for perf (fire is soft, doesn't need full res)
    const scale = 0.65;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth  * dpr * scale);
    const h = Math.round(this.canvas.clientHeight * dpr * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width  = w;
      this.canvas.height = h;
    }
  }

  // ── Public API (same interface) ──

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

    // ── Accumulate time ──
    this._time += dt;

    // ── Breathing value ──
    const breathVal = Math.sin(this._breathPhase)
                    + Math.sin(this._breathPhase * 2.3 + 0.5) * 0.5;

    // ── Draw ──
    const gl = this.gl;
    const w  = this.canvas.width;
    const h  = this.canvas.height;

    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Skip rendering if fire is completely out
    if (this.intensity < 0.005) return;

    gl.useProgram(this._prog);

    // Uniforms
    gl.uniform1f(this._uTime,      this._time);
    gl.uniform1f(this._uIntensity,  this.intensity);
    gl.uniform1f(this._uWind,       this.wind);
    gl.uniform3f(this._uTint,       this.tint[0], this.tint[1], this.tint[2]);
    gl.uniform2f(this._uResolution, w, h);
    gl.uniform1f(this._uBreath,     breathVal);

    // Draw fullscreen quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.enableVertexAttribArray(this._aPos);
    gl.vertexAttribPointer(this._aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
