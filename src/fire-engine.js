/**
 * fire-engine.js
 * WebGL-based realistic fire shader with FBM noise
 * The crown jewel - beautiful campfire for 불멍
 */

const VERT_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_SHADER = `
precision highp float;

varying vec2 v_uv;
uniform float u_time;
uniform float u_intensity;    // 0.3 ~ 2.0+
uniform float u_wind;         // -1.0 ~ 1.0
uniform vec3 u_tint;          // color tint (1,1,1 = normal)
uniform vec2 u_resolution;
uniform float u_baseY;        // fire base Y position (0~1)
uniform float u_flicker;      // random flicker seed

// === Simplex Noise ===
vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289v2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// === Fractal Brownian Motion ===
float fbm(vec2 p, int octaves) {
  float f = 0.0, w = 0.5;
  for(int i = 0; i < 6; i++) {
    if(i >= octaves) break;
    f += w * snoise(p);
    p *= 2.03;
    w *= 0.48;
  }
  return f;
}

// === Fire Color Palette ===
vec3 fireColor(float t) {
  // t: 0 = cold/transparent, 1 = hottest
  // Multi-stop gradient: black -> dark red -> red -> orange -> yellow -> white
  vec3 c;
  if(t < 0.15) {
    c = mix(vec3(0.05, 0.0, 0.0), vec3(0.4, 0.05, 0.0), t / 0.15);
  } else if(t < 0.3) {
    c = mix(vec3(0.4, 0.05, 0.0), vec3(0.85, 0.15, 0.02), (t - 0.15) / 0.15);
  } else if(t < 0.5) {
    c = mix(vec3(0.85, 0.15, 0.02), vec3(1.0, 0.45, 0.05), (t - 0.3) / 0.2);
  } else if(t < 0.7) {
    c = mix(vec3(1.0, 0.45, 0.05), vec3(1.0, 0.75, 0.15), (t - 0.5) / 0.2);
  } else if(t < 0.85) {
    c = mix(vec3(1.0, 0.75, 0.15), vec3(1.0, 0.95, 0.6), (t - 0.7) / 0.15);
  } else {
    c = mix(vec3(1.0, 0.95, 0.6), vec3(1.0, 1.0, 0.9), (t - 0.85) / 0.15);
  }
  return c;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  // Coordinate system: center bottom of fire area
  float fireBaseY = u_baseY; // typically 0.3 (30% from bottom)
  vec2 fireUV;
  fireUV.x = (uv.x - 0.5) * aspect * 2.0; // centered, aspect-corrected
  fireUV.y = (uv.y - fireBaseY) / (1.0 - fireBaseY); // 0 at base, 1 at top
  fireUV.y = 1.0 - fireUV.y; // flip: 0 at top, 1 at base

  // Skip pixels far from fire
  if(fireUV.y < -0.3 || fireUV.y > 1.3 || abs(fireUV.x) > 2.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float time = u_time;
  float intensity = u_intensity;

  // === Fire shape ===
  // Wider at base, narrow at tip
  float heightPct = 1.0 - fireUV.y; // 0 at base, 1 at top
  float fireWidth = mix(0.15, 0.55 * intensity, fireUV.y);
  fireWidth += 0.05 * sin(time * 2.3) * intensity; // breathing

  // === Noise distortion ===
  float windOffset = u_wind * heightPct * 0.3;
  vec2 noiseUV = vec2(
    fireUV.x * 1.8 + windOffset,
    heightPct * 2.5 - time * 1.8
  );

  // Multiple noise layers for organic movement
  float n1 = fbm(noiseUV * 3.0, 5);
  float n2 = fbm(noiseUV * 6.0 + vec2(100.0, 0.0), 4);
  float n3 = fbm(noiseUV * 1.5 + vec2(0.0, 50.0) + time * 0.3, 3);

  // Distort horizontal position
  float distortedX = fireUV.x + n1 * 0.25 * heightPct + windOffset;
  distortedX += n3 * 0.1;

  // === Core flame shape ===
  float dist = abs(distortedX) / fireWidth;

  // Flame falloff
  float flame = 1.0 - smoothstep(0.0, 1.0, dist);

  // Vertical fade: strong at base, thin at top
  float vertFade = smoothstep(0.0, 0.15, fireUV.y); // fade at very top
  vertFade *= 1.0 - smoothstep(0.3, 1.0, heightPct / intensity);
  flame *= vertFade;

  // Add detail noise
  flame += n2 * 0.15 * flame;
  flame *= 1.0 + n1 * 0.2;

  // Small flicker
  flame *= 0.9 + 0.1 * sin(time * 8.0 + fireUV.x * 5.0 + u_flicker);

  flame = clamp(flame, 0.0, 1.0);

  // === Inner core (hottest part) ===
  float coreWidth = fireWidth * 0.35;
  float coreDist = abs(distortedX) / coreWidth;
  float core = 1.0 - smoothstep(0.0, 1.0, coreDist);
  core *= smoothstep(0.0, 0.2, fireUV.y);
  core *= 1.0 - smoothstep(0.0, 0.5, heightPct / intensity);
  core = clamp(core, 0.0, 1.0);

  // === Temperature (for color mapping) ===
  float temp = flame * 0.6 + core * 0.4;
  temp *= intensity * 0.8;
  temp = clamp(temp, 0.0, 1.0);

  // === Color ===
  vec3 col = fireColor(temp);
  col *= u_tint;

  // Add subtle blue at base (very hot = blue-white)
  if(temp > 0.9) {
    col = mix(col, vec3(0.8, 0.85, 1.0), (temp - 0.9) * 2.0);
  }

  // === Glow ===
  float glowRadius = fireWidth * 3.0 * intensity;
  float glowDist = length(vec2(fireUV.x, heightPct * 0.5));
  float glow = exp(-glowDist * glowDist / (glowRadius * glowRadius * 0.3));
  glow *= 0.15 * intensity;

  vec3 glowCol = vec3(1.0, 0.3, 0.05) * glow;

  // === Alpha ===
  float alpha = smoothstep(0.01, 0.08, flame);
  alpha = max(alpha, glow * 0.5);
  alpha = clamp(alpha, 0.0, 1.0);

  // === Final composite ===
  vec3 finalCol = col + glowCol;

  gl_FragColor = vec4(finalCol, alpha);
}
`;

export class FireEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.startTime = performance.now() / 1000;
    this.intensity = 0.80;
    this.targetIntensity = 0.80;
    this.wind = 0;
    this.targetWind = 0;
    this.tint = [1, 1, 1];
    this.targetTint = [1, 1, 1];
    this.baseY = 0.30;   // fire base slightly lower → sits on the logs
    this.flickerSeed = 0;
    this.boostTimer = 0;
    this.boostIntensity = 0;

    this._init();
  }

  _init() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    this.gl = gl;

    // Compile shaders
    const vs = this._compile(gl.VERTEX_SHADER, VERT_SHADER);
    const fs = this._compile(gl.FRAGMENT_SHADER, FRAG_SHADER);
    if (!vs || !fs) return;

    // Link program
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link failed:', gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;

    // Full-screen quad
    const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    // Attribute
    this.aPos = gl.getAttribLocation(prog, 'a_position');

    // Uniforms
    this.uTime = gl.getUniformLocation(prog, 'u_time');
    this.uIntensity = gl.getUniformLocation(prog, 'u_intensity');
    this.uWind = gl.getUniformLocation(prog, 'u_wind');
    this.uTint = gl.getUniformLocation(prog, 'u_tint');
    this.uResolution = gl.getUniformLocation(prog, 'u_resolution');
    this.uBaseY = gl.getUniformLocation(prog, 'u_baseY');
    this.uFlicker = gl.getUniformLocation(prog, 'u_flicker');

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _compile(type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
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

  /**
   * Boost fire intensity temporarily
   * @param {number} amount - boost amount (0.05 ~ 0.5 for toothpick)
   * @param {number} duration - duration in seconds
   */
  boost(amount, duration = 1.5) {
    this.boostIntensity = Math.min(this.boostIntensity + amount, 0.6); // cap toothpick boost
    this.boostTimer = Math.max(this.boostTimer, duration);
  }

  /**
   * Set permanent base intensity
   * @param {number} val - base intensity (0.8 ~ 1.5)
   */
  setBaseIntensity(val) {
    this.targetIntensity = Math.max(0.80, Math.min(val, 1.5));
  }

  /**
   * Set wind direction
   * @param {number} val - wind (-1 left, 0 none, 1 right)
   */
  setWind(val) {
    this.targetWind = Math.max(-1, Math.min(val, 1));
  }

  /**
   * Set color tint (for special items)
   * @param {number[]} rgb - [r, g, b] normalized
   * @param {number} duration - duration in seconds
   */
  setTint(rgb, duration = 3) {
    this.targetTint = [...rgb];
    if (duration > 0) {
      setTimeout(() => {
        this.targetTint = [1, 1, 1];
      }, duration * 1000);
    }
  }

  render(dt) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Update boost — toothpick flare decays quickly
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) {
        this.boostTimer = 0;
      }
    } else {
      // Fast decay back to base after boost expires
      this.boostIntensity *= Math.pow(0.15, dt);
    }

    // Smooth interpolation — slightly slower for organic feel
    const lerpSpeed = 2.2 * dt;
    const target = this.targetIntensity + this.boostIntensity;
    this.intensity += (target - this.intensity) * Math.min(lerpSpeed, 1);
    this.wind += (this.targetWind - this.wind) * Math.min(lerpSpeed * 0.5, 1);
    for (let i = 0; i < 3; i++) {
      this.tint[i] += (this.targetTint[i] - this.tint[i]) * Math.min(lerpSpeed, 1);
    }

    // Flicker
    this.flickerSeed += dt * 12;

    // Natural wind variation
    const naturalWind = Math.sin(performance.now() / 1000 * 0.7) * 0.05;

    gl.useProgram(this.program);

    // Set uniforms
    const t = performance.now() / 1000 - this.startTime;
    gl.uniform1f(this.uTime, t);
    gl.uniform1f(this.uIntensity, this.intensity);
    gl.uniform1f(this.uWind, this.wind + naturalWind);
    gl.uniform3f(this.uTint, this.tint[0], this.tint[1], this.tint[2]);
    gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uBaseY, this.baseY);
    gl.uniform1f(this.uFlicker, this.flickerSeed);

    // Draw quad
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
