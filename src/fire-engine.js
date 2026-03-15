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

// ── Fragment shader — MlKSWm (ronvalstar) port ──
// 3D Simplex noise + noiseStack domain displacement + spark system
const FRAG_SRC = `
precision highp float;

varying vec2 v_uv;
uniform float u_time;
uniform float u_intensity;
uniform float u_wind;
uniform vec3  u_tint;
uniform vec2  u_resolution;
uniform float u_breath;

// ─── 3D Simplex noise — Ian McEwan / Ashima Arts ─────────────────────────
vec3 _m289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 _m289v(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 _perm(vec4 x){return _m289v(((x*34.)+1.)*x);}
vec4 _tiSqrt(vec4 r){return 1.79284291-.85373472*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=_m289(i);
  vec4 p=_perm(_perm(_perm(i.z+vec4(0.,i1.z,i2.z,1.))
    +i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 xx=x_*ns.x+ns.yyyy; vec4 yy=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(xx)-abs(yy);
  vec4 b0=vec4(xx.xy,yy.xy); vec4 b1=vec4(xx.zw,yy.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=_tiSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// ─── noiseStack & noiseStackUV — MlKSWm (ronvalstar) ─────────────────────
float noiseStack(vec3 pos,int oct,float fall){
  float n=snoise(pos),off=1.;
  if(oct>1){pos*=2.;off*=fall;n=(1.-off)*n+off*snoise(pos);}
  if(oct>2){pos*=2.;off*=fall;n=(1.-off)*n+off*snoise(pos);}
  if(oct>3){pos*=2.;off*=fall;n=(1.-off)*n+off*snoise(pos);}
  return (1.+n)/2.;
}
vec2 noiseStackUV(vec3 pos,int oct,float fall){
  return vec2(noiseStack(pos,oct,fall),
              noiseStack(pos+vec3(3984.293,423.21,5235.19),oct,fall));
}

// ─── PRNG — Dave_Hoskins ─────────────────────────────────────────────────
float prng(vec2 s){
  s=fract(s*vec2(5.3983,5.4427));
  s+=dot(s.yx,s.xy+vec2(21.5351,14.3137));
  return fract(s.x*s.y*95.4337);
}

const float PI=3.14159265;

void main(){
  vec2 fc=v_uv*u_resolution;
  vec2 res=u_resolution;

  float intCl=clamp(u_intensity,0.,1.5);

  // Map intensity to fire geometry
  float uScale  = 0.50 + intCl * 0.45;
  float uHeight = 0.65 + intCl * 0.30 + u_breath * 0.018;

  // Fire base at ~28% from bottom — matches fire-clicker log position
  float fireBase = res.y * 0.28;
  float clip     = res.y * 0.55 * uScale * uHeight;
  float fireHW   = res.x * 0.33 * uScale;

  float xpart     = (fc.x-(res.x*.5-fireHW))/(2.*fireHW);
  float ypartClip = (fc.y-fireBase)/clip;
  float ypart     = fc.y/res.y;

  // Skip non-fire pixels → transparent
  if(xpart<0.||xpart>1.||ypartClip<-0.1){
    gl_FragColor=vec4(0.); return;
  }

  float ypartClippedFalloff = clamp(2.-ypartClip,0.,1.);
  float ypartClipped        = min(ypartClip,1.);
  float ypartClippedn       = 1.-ypartClipped;

  // Wind lean (shifts fire sampling toward wind direction with height)
  float windLean = u_wind * clamp(ypartClip,0.,1.) * 0.22;
  float xpartW   = clamp(xpart-windLean,0.,1.);

  // Fuel: smooth bell + slow horizontal turbulence (breaks pyramid shape)
  float xe       = clamp(abs(xpartW-0.5)*2.1,0.,1.);
  float xfuelB   = 1.-xe*xe*xe;
  float xfuelT   = snoise(vec3(xpart*2.4,u_time*0.06,89.31))*0.42;
  float xfuel    = clamp(xfuelB+xfuelT,0.,1.);

  float realTime = 0.5*u_time;

  vec2 fireCoord  = vec2(fc.x-(res.x*.5-fireHW), fc.y-fireBase);
  vec2 coordSc    = 0.01*fireCoord;
  vec3 pos        = vec3(coordSc,0.)+vec3(1223.,6434.,8425.);

  vec3 flow=vec3(
    4.1*(0.5-xpartW)*pow(ypartClippedn,4.) + u_wind*0.12,
    -2.*xfuel*pow(ypartClippedn,64.),
    0.);
  vec3 timing=realTime*vec3(0.,-1.7,1.1)+flow;

  vec3 dPos  = vec3(1.,.5,1.)*2.4*pos+realTime*vec3(.01,-.7,1.3);
  vec3 disp  = vec3(noiseStackUV(dPos,2,.4),0.);
  vec3 nCoord= vec3(2.,1.,1.)*pos+timing+.4*disp;
  float noise= noiseStack(nCoord,3,.4);

  // MlKSWm flame formula
  float flames = pow(ypartClipped,0.3*xfuel)*pow(noise,0.3*xfuel);
  float f      = ypartClippedFalloff*pow(1.-flames*flames*flames,8.);
  float fff    = f*f*f;

  // Blackbody fire colors
  vec3 fire = 1.5*vec3(f,fff,fff*fff);

  // Coal-bed glow at base (orange warmth from logs)
  float coalY  = exp(-ypartClip*ypartClip*30.);
  fire += vec3(1.,.16,0.)*coalY*xfuel*1.4;

  // Smoke
  float sNoise = .5+snoise(.4*pos+timing*vec3(1.,1.,.2))/2.;
  vec3 smoke   = vec3(.22*pow(xfuel,3.)*pow(ypart,2.)*(sNoise+.4*(1.-noise)));

  // Spark system (MlKSWm grid-orbital)
  float sgS  = 30.;
  float sRise= (clip/res.y)*190./(res.y*.35)*clip;
  vec2 sCoord= fireCoord - vec2(u_wind*clip*.4, sRise*realTime);
  sCoord -= 30.*noiseStackUV(.01*vec3(sCoord,30.*u_time),1,.4);
  sCoord += 100.*flow.xy;
  if(mod(sCoord.y/sgS,2.)<1.) sCoord.x+=.5*sgS;
  vec2 sGI  = floor(sCoord/sgS);
  float sRnd= prng(sGI);
  float sLife=min(10.*(1.-min((sGI.y+(sRise*realTime/sgS))/(24.-20.*sRnd),1.)),1.);
  vec3 sparks=vec3(0.);
  if(sLife>0.){
    float sSz  = xfuel*xfuel*sRnd*.08;
    float sRad = 999.*sRnd*2.*PI+2.*u_time;
    vec2 sCirc = vec2(sin(sRad),cos(sRad));
    vec2 sOff  = (.5-sSz)*sgS*sCirc;
    vec2 sMod  = mod(sCoord+sOff,sgS)-.5*vec2(sgS);
    float sLen = length(sMod);
    float sGray= max(0.,1.-sLen/(sSz*sgS));
    sparks = sLife*sGray*vec3(1.,.3,0.);
  }

  // Apply game tint + compose fire/sparks/smoke
  vec3 col = (max(fire,sparks)+smoke*.5)*u_tint;

  // Fade alpha with intensity (fire disappears when dying)
  float alpha = clamp(dot(max(fire,sparks),vec3(.3,.59,.11))*2.5,0.,1.);
  alpha *= smoothstep(0.02,0.12,intCl);

  // Pre-multiplied alpha (blendFunc ONE / ONE_MINUS_SRC_ALPHA)
  gl_FragColor = vec4(col*alpha, alpha);
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
