/**
 * sound-manager.js
 * Audio management with Howler.js
 * Handles fire ambiance, throw sounds, explosions, fireworks
 */

import { Howl, Howler } from 'howler';

// Sound configuration
const SOUNDS_CONFIG = {
  // Fire ambiance loops
  fireSmall: { src: ['/sounds/fire_small.ogg', '/sounds/fire_small.wav'], loop: true, volume: 0.3 },
  fireMedium: { src: ['/sounds/fire_medium.ogg', '/sounds/fire_medium.wav'], loop: true, volume: 0.4 },
  fireBig: { src: ['/sounds/fire_big.ogg', '/sounds/fire_big.wav'], loop: true, volume: 0.5 },

  // Item throw / whoosh sounds
  whoosh1: { src: ['/sounds/whoosh1.ogg', '/sounds/whoosh1.wav'], volume: 0.4 },
  whoosh2: { src: ['/sounds/whoosh2.ogg', '/sounds/whoosh2.wav'], volume: 0.4 },
  whoosh3: { src: ['/sounds/whoosh3.ogg', '/sounds/whoosh3.wav'], volume: 0.4 },
  whoosh4: { src: ['/sounds/whoosh4.ogg', '/sounds/whoosh4.wav'], volume: 0.4 },
  whoosh5: { src: ['/sounds/whoosh5.ogg', '/sounds/whoosh5.wav'], volume: 0.4 },

  // Explosion
  explosion1: { src: ['/sounds/explosion1.ogg', '/sounds/explosion1.wav'], volume: 0.5 },
  explosion2: { src: ['/sounds/explosion2.ogg', '/sounds/explosion2.wav'], volume: 0.5 },

  // Fireworks
  fwBoom: { src: ['/sounds/fw_boom.ogg', '/sounds/fw_boom.wav'], volume: 0.45 },
  fwBurst: { src: ['/sounds/fw_burst.ogg', '/sounds/fw_burst.wav'], volume: 0.4 },
  fwRocket: { src: ['/sounds/fw_rocket.ogg', '/sounds/fw_rocket.wav'], volume: 0.35 },
  fwWhistle: { src: ['/sounds/fw_whistle.ogg', '/sounds/fw_whistle.wav'], volume: 0.35 },
  fwCrackle: { src: ['/sounds/fw_crackle.ogg', '/sounds/fw_crackle.wav'], volume: 0.3 },

  // Fireball
  fireball: { src: ['/sounds/fireball.ogg', '/sounds/fireball.wav'], volume: 0.4 },

  // UI
  click: { src: ['/sounds/click.ogg', '/sounds/click.wav'], volume: 0.2 },

  // Special
  fireLoop: { src: ['/sounds/fire_loop.ogg', '/sounds/fire_loop.wav'], loop: true, volume: 0.25 },
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
      const old = this.sounds[this.currentAmbiance];
      old.fade(old.volume(), 0, 1000);
      setTimeout(() => old.stop(), 1000);
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
