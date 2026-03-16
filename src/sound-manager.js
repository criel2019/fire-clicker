/**
 * sound-manager.js
 * Audio management with Howler.js
 * Handles fire ambiance, throw sounds, explosions, fireworks
 */

import { Howl, Howler } from 'howler';

// Resolve base URL for sound paths (vite base may be '/fire-clicker/')
const BASE = import.meta.env.BASE_URL || '/';
const S = (name) => [`${BASE}sounds/${name}`];

// Sound configuration
const SOUNDS_CONFIG = {
  // Fire ambiance loops
  fireSmall: { src: S('fire_small.ogg'), loop: true, volume: 0.3 },
  fireMedium: { src: S('fire_medium.ogg'), loop: true, volume: 0.4 },
  fireBig: { src: S('fire_big.ogg'), loop: true, volume: 0.5 },

  // Item throw / whoosh sounds
  whoosh1: { src: S('whoosh1.ogg'), volume: 0.4 },
  whoosh2: { src: S('whoosh2.ogg'), volume: 0.4 },
  whoosh3: { src: S('whoosh3.ogg'), volume: 0.4 },
  whoosh4: { src: S('whoosh4.ogg'), volume: 0.4 },
  whoosh5: { src: S('whoosh5.ogg'), volume: 0.4 },

  // Explosion
  explosion1: { src: S('explosion1.ogg'), volume: 0.5 },
  explosion2: { src: S('explosion2.ogg'), volume: 0.5 },

  // Fireworks
  fwBoom: { src: S('fw_boom.ogg'), volume: 0.45 },
  fwBurst: { src: S('fw_burst.ogg'), volume: 0.4 },
  fwRocket: { src: S('fw_rocket.ogg'), volume: 0.35 },
  fwWhistle: { src: S('fw_whistle.ogg'), volume: 0.35 },
  fwCrackle: { src: S('fw_crackle.ogg'), volume: 0.3 },

  // Fireball
  fireball: { src: S('fireball.ogg'), volume: 0.4 },

  // UI
  click: { src: S('click.ogg'), volume: 0.2 },

  // Special
  fireLoop: { src: S('fire_loop.ogg'), loop: true, volume: 0.25 },
};

export class SoundManager {
  constructor() {
    this.sounds = {};
    this.loaded = false;
    this.muted = false;
    this.masterVolume = 0.8;
    this.currentAmbiance = null;
    this.ambianceLevel = 'small'; // 'small', 'medium', 'big'
    this._loadAttempted = false;
  }

  /**
   * Initialize and load all sounds
   */
  async init() {
    if (this._loadAttempted) return;
    this._loadAttempted = true;

    Howler.volume(this.masterVolume);

    for (const [key, config] of Object.entries(SOUNDS_CONFIG)) {
      try {
        this.sounds[key] = new Howl({
          src: config.src,
          loop: config.loop || false,
          volume: config.volume || 0.5,
          preload: true,
          html5: config.loop || false, // use html5 for loops (better for mobile)
          onloaderror: () => {
            console.warn(`Sound load failed: ${key}`);
          },
        });
      } catch (e) {
        console.warn(`Sound init failed: ${key}`, e);
      }
    }

    this.loaded = true;
  }

  /**
   * Play a sound effect
   * @param {string} key - sound key
   * @param {object} opts - options { volume, rate }
   */
  play(key, opts = {}) {
    if (this.muted || !this.sounds[key]) return null;

    const sound = this.sounds[key];
    const id = sound.play();

    if (opts.volume !== undefined) {
      sound.volume(opts.volume, id);
    }
    if (opts.rate !== undefined) {
      sound.rate(opts.rate, id);
    }

    return id;
  }

  /**
   * Play a random whoosh sound (for throwing items)
   */
  playWhoosh() {
    const idx = Math.floor(Math.random() * 5) + 1;
    this.play(`whoosh${idx}`, { rate: 0.8 + Math.random() * 0.4 });
  }

  /**
   * Play explosion sound
   */
  playExplosion() {
    const idx = Math.random() > 0.5 ? 1 : 2;
    this.play(`explosion${idx}`, { volume: 0.6 });
  }

  /**
   * Play firework sounds
   */
  playFirework() {
    this.play('fwRocket');
    setTimeout(() => {
      const sounds = ['fwBoom', 'fwBurst', 'fwCrackle'];
      this.play(sounds[Math.floor(Math.random() * sounds.length)]);
    }, 500 + Math.random() * 500);
  }

  /**
   * Play fireball sound
   */
  playFireball() {
    this.play('fireball', { rate: 0.9 + Math.random() * 0.3 });
  }

  /**
   * Play click/tap sound
   */
  playClick() {
    this.play('click', { rate: 0.9 + Math.random() * 0.2 });
  }

  /**
   * Update fire ambiance based on intensity
   * @param {number} intensity - fire intensity (0.3 ~ 2.5)
   */
  updateAmbiance(intensity) {
    // When fire is out, silence the ambiance
    if (intensity < 0.01) {
      if (this.currentAmbiance && this.sounds[this.currentAmbiance]) {
        const old = this.sounds[this.currentAmbiance];
        old.fade(old.volume(), 0, 800);
        setTimeout(() => old.stop(), 800);
        this.currentAmbiance = null;
        this.ambianceLevel = '';
      }
      return;
    }

    let targetLevel;
    if (intensity < 0.6) targetLevel = 'small';
    else if (intensity < 1.2) targetLevel = 'medium';
    else targetLevel = 'big';

    if (targetLevel === this.ambianceLevel && this.currentAmbiance) return;

    // Crossfade to new ambiance
    const keyMap = { small: 'fireSmall', medium: 'fireMedium', big: 'fireBig' };
    const newKey = keyMap[targetLevel];
    const newSound = this.sounds[newKey];

    if (!newSound) return;

    // Fade out current
    if (this.currentAmbiance && this.sounds[this.currentAmbiance]) {
      const oldKey = this.currentAmbiance;
      const old = this.sounds[oldKey];
      old.fade(old.volume(), 0, 1000);
      setTimeout(() => {
        // Only stop if it's still the old ambiance (prevent race condition)
        if (this.currentAmbiance !== oldKey) {
          old.stop();
        }
      }, 1050);
    }

    // Fade in new
    if (!this.muted) {
      const targetVol = SOUNDS_CONFIG[newKey].volume;
      newSound.volume(0);
      newSound.play();
      newSound.fade(0, targetVol, 1500);
    }

    this.currentAmbiance = newKey;
    this.ambianceLevel = targetLevel;
  }

  /**
   * Play sound based on effect type
   */
  playEffectSound(effectType) {
    switch (effectType) {
      case 'explosion':
      case 'inferno':
        this.playExplosion();
        break;
      case 'firework':
        this.playFirework();
        break;
      case 'spark':
      case 'flash':
        this.playFireball();
        break;
      case 'chemical':
      case 'electric':
        this.play('fireball', { rate: 0.6 });
        break;
      case 'cosmic':
      case 'holy':
      case 'dark':
        this.play('fireball', { rate: 0.5, volume: 0.6 });
        setTimeout(() => this.playExplosion(), 300);
        break;
      default:
        this.playClick();
    }
  }

  /**
   * Toggle mute
   */
  toggleMute() {
    this.muted = !this.muted;
    Howler.mute(this.muted);

    if (this.muted && this.currentAmbiance) {
      this.sounds[this.currentAmbiance]?.stop();
    } else if (!this.muted) {
      this.ambianceLevel = ''; // force re-evaluate
    }

    return this.muted;
  }

  /**
   * Set master volume
   */
  setVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    Howler.volume(this.masterVolume);
  }

  /**
   * Stop all sounds
   */
  stopAll() {
    Howler.stop();
    this.currentAmbiance = null;
  }
}
