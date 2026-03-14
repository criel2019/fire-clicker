/**
 * npc.js
 * NPC Silhouette Visitor System
 * Occasional silhouetted figures appear by the fire for ambiance.
 */

const NPC_TYPES = {
  crying_woman: {
    checkInterval: 3 * 24 * 60 * 60 * 1000, // every 3 days
    duration: 120000, // stays 2 minutes
    side: 'left',
  },
  office_worker: {
    condition: () => { const h = new Date().getHours(); return h >= 22 || h <= 2; },
    duration: 90000,
    side: 'right',
  },
  squirrel: {
    duration: 30000,
    side: null, // determined per-instance
    randomChance: 0.0005, // per-frame chance
  },
  grandfather: {
    condition: () => [0, 6].includes(new Date().getDay()), // weekend
    duration: 180000,
    side: 'left',
  },
};

// Minimum time between any NPC visits (ms)
const MIN_VISIT_GAP = 5 * 60 * 1000; // 5 minutes

export class NPCSystem {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = gameState;

    // Current visitor state
    this.currentNPC = null; // { type, side, state, alpha, timer, duration }
    this._lastVisitTime = 0;

    // Resize canvas to match display
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.dpr = dpr;
  }

  /**
   * Called each frame with delta-time and current timestamp
   */
  update(dt, timestamp) {
    // Don't show NPCs until player has been playing for 10 minutes
    if (this.game.totalPlayTime < 600) return;

    const now = Date.now();

    if (this.currentNPC) {
      const npc = this.currentNPC;

      if (npc.state === 'fading_in') {
        npc.alpha = Math.min(1, npc.alpha + dt / 2); // 2 seconds to fade in
        if (npc.alpha >= 1) {
          npc.alpha = 1;
          npc.state = 'visiting';
          npc.timer = npc.duration;
        }
      } else if (npc.state === 'visiting') {
        npc.timer -= dt * 1000; // convert to ms
        if (npc.timer <= 0) {
          npc.state = 'fading_out';
        }
      } else if (npc.state === 'fading_out') {
        npc.alpha = Math.max(0, npc.alpha - dt / 2); // 2 seconds to fade out
        if (npc.alpha <= 0) {
          // NPC has left — record departure time
          localStorage.setItem('npc_last_' + npc.type, String(now));
          this._lastVisitTime = now;
          this.currentNPC = null;
        }
      }
    } else {
      // No active NPC — check if we can spawn one
      if (now - this._lastVisitTime < MIN_VISIT_GAP) return;
      this._trySpawnNPC(now);
    }
  }

  /**
   * Attempt to spawn a new NPC based on conditions
   */
  _trySpawnNPC(now) {
    // Check squirrel (random per-frame chance)
    const squirrelDef = NPC_TYPES.squirrel;
    if (Math.random() < squirrelDef.randomChance) {
      this._spawnNPC('squirrel', now);
      return;
    }

    // Check time/day-condition NPCs
    for (const [type, def] of Object.entries(NPC_TYPES)) {
      if (type === 'squirrel') continue;

      // Condition check
      if (def.condition && !def.condition()) continue;

      // Interval check (checkInterval-based types)
      if (def.checkInterval) {
        const lastVisit = parseInt(localStorage.getItem('npc_last_' + type) || '0', 10);
        if (now - lastVisit < def.checkInterval) continue;
      }

      // Eligible — spawn this NPC
      this._spawnNPC(type, now);
      return; // only one at a time
    }
  }

  _spawnNPC(type, now) {
    const def = NPC_TYPES[type];
    const side = (type === 'squirrel')
      ? (Math.random() < 0.5 ? 'left' : 'right')
      : def.side;

    this.currentNPC = {
      type,
      side,
      state: 'fading_in',
      alpha: 0,
      duration: def.duration,
      timer: def.duration,
    };
  }

  /**
   * Draw the current NPC onto the canvas
   */
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!this.currentNPC || this.currentNPC.alpha <= 0) return;

    const npc = this.currentNPC;
    ctx.save();
    ctx.globalAlpha = npc.alpha;

    // Position: 28% from left (left side) or 72% from left (right side)
    // Vertically at 65% screen height
    const xFrac = npc.side === 'left' ? 0.28 : 0.72;
    const x = w * xFrac;
    const y = h * 0.65;
    const scale = (npc.type === 'squirrel') ? 45 : 90; // squirrel is smaller

    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#1a1a1a';

    switch (npc.type) {
      case 'crying_woman':
        this._drawCryingWoman(ctx, x, y, scale);
        break;
      case 'office_worker':
        this._drawOfficeWorker(ctx, x, y, scale);
        break;
      case 'squirrel':
        this._drawSquirrel(ctx, x, y, scale);
        break;
      case 'grandfather':
        this._drawGrandfather(ctx, x, y, scale);
        break;
    }

    ctx.restore();
  }

  // ─── Drawing helpers ────────────────────────────────────────────────────────

  /**
   * Crying woman: seated, head bowed, hunched shoulders, long hair
   */
  _drawCryingWoman(ctx, x, y, scale) {
    const s = scale / 90; // normalize

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Long hair (behind body, drawn first)
    ctx.beginPath();
    ctx.ellipse(-6, -70, 14, 30, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Head (bowed forward — shifted slightly forward and down)
    ctx.beginPath();
    ctx.arc(4, -72, 12, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.beginPath();
    ctx.moveTo(4, -60);
    ctx.lineTo(2, -52);
    ctx.lineWidth = 5;
    ctx.stroke();

    // Body — slumped/curved arc
    ctx.beginPath();
    ctx.moveTo(2, -52);
    ctx.bezierCurveTo(-14, -30, -18, -10, -10, 10);
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Legs — bent, seated
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(-20, 40);
    ctx.lineTo(-10, 70);
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-6, 10);
    ctx.lineTo(4, 38);
    ctx.lineTo(14, 65);
    ctx.stroke();

    // Arms — folded, hugging knees
    ctx.beginPath();
    ctx.moveTo(-4, -42);
    ctx.bezierCurveTo(-22, -18, -26, 8, -16, 18);
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Office worker: standing, tie, one hand raised
   */
  _drawOfficeWorker(ctx, x, y, scale) {
    const s = scale / 90;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Head
    ctx.beginPath();
    ctx.arc(0, -82, 12, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(0, -62);
    ctx.lineWidth = 5;
    ctx.stroke();

    // Body (rectangle-ish torso)
    ctx.beginPath();
    ctx.roundRect(-14, -62, 28, 46, 4);
    ctx.fill();

    // Tie — small downward triangle on chest
    ctx.beginPath();
    ctx.moveTo(-4, -58);
    ctx.lineTo(4, -58);
    ctx.lineTo(2, -30);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';

    // Legs
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.lineTo(-10, 30);
    ctx.lineTo(-10, 70);
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, -16);
    ctx.lineTo(10, 30);
    ctx.lineTo(10, 70);
    ctx.stroke();

    // Left arm (down)
    ctx.beginPath();
    ctx.moveTo(-14, -55);
    ctx.lineTo(-20, -20);
    ctx.lineTo(-18, 10);
    ctx.lineWidth = 7;
    ctx.stroke();

    // Right arm (raised, holding something — phone/cup)
    ctx.beginPath();
    ctx.moveTo(14, -55);
    ctx.lineTo(22, -75);
    ctx.lineTo(26, -80);
    ctx.stroke();

    // Small object in raised hand
    ctx.beginPath();
    ctx.arc(28, -84, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Squirrel: small, sitting on haunches, big fluffy tail
   */
  _drawSquirrel(ctx, x, y, scale) {
    const s = scale / 45;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Fluffy tail (drawn behind body)
    ctx.beginPath();
    ctx.moveTo(8, 20);
    ctx.bezierCurveTo(40, 10, 44, -28, 20, -38);
    ctx.bezierCurveTo(10, -44, 2, -36, 6, -24);
    ctx.bezierCurveTo(18, -20, 26, -6, 8, 20);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 10, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -12, 10, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.ellipse(-6, -20, 4, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, -20, 4, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Front paws (tiny)
    ctx.beginPath();
    ctx.arc(-8, 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8, 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Back haunches
    ctx.beginPath();
    ctx.moveTo(-12, 20);
    ctx.lineTo(-14, 38);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.lineTo(14, 38);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Grandfather: seated, pipe, slightly hunched, white/gray hair
   */
  _drawGrandfather(ctx, x, y, scale) {
    const s = scale / 90;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // White/gray hair (lighter circle behind head)
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(0, -80, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';

    // Head
    ctx.beginPath();
    ctx.arc(0, -80, 11, 0, Math.PI * 2);
    ctx.fill();

    // Pipe — small horizontal line from face
    ctx.beginPath();
    ctx.moveTo(10, -76);
    ctx.lineTo(26, -74);
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.stroke();
    // Pipe bowl
    ctx.beginPath();
    ctx.arc(28, -72, 4, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.beginPath();
    ctx.moveTo(0, -69);
    ctx.lineTo(0, -62);
    ctx.lineWidth = 5;
    ctx.stroke();

    // Body — slightly hunched (leaning forward)
    ctx.beginPath();
    ctx.moveTo(0, -62);
    ctx.bezierCurveTo(-10, -40, -14, -16, -8, 10);
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Legs — seated
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(-18, 38);
    ctx.lineTo(-12, 68);
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-4, 12);
    ctx.lineTo(6, 38);
    ctx.lineTo(16, 64);
    ctx.stroke();

    // Arms resting on knees
    ctx.beginPath();
    ctx.moveTo(-6, -50);
    ctx.bezierCurveTo(-20, -24, -24, 4, -16, 20);
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(4, -52);
    ctx.bezierCurveTo(14, -26, 16, 2, 8, 18);
    ctx.stroke();

    ctx.restore();
  }
}
