import { on } from '../core/EventBus.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    // sounds populado exclusivamente via setSoundBank(audio.json) durante o boot
    this.sounds = {};
    this._bind();
  }

  setSoundBank(soundBankData) {
    if (soundBankData?.sounds) {
      Object.assign(this.sounds, soundBankData.sounds);
    }
  }

  _ensure() {
    if (!this.ctx) {
      try { 
        this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
      } catch (e) { 
        return null; 
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  _tone(freqA, freqB, dur, type, gain, panX = 0) {
    const ctx = this._ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freqA, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqB, 1), ctx.currentTime + dur);

    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    osc.connect(g);
    if (pan) {
      pan.pan.value = Math.max(-1, Math.min(1, panX));
      g.connect(pan);
      pan.connect(ctx.destination);
    } else {
      g.connect(ctx.destination);
    }

    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  play(soundKey, panX = 0) {
    const s = this.sounds[soundKey];
    if (s) {
      this._tone(s.freqA, s.freqB, s.dur, s.type, s.gain, panX);
    }
  }

  _bind() {
    on('weapon:fired', e => {
      const key = e.weapon?.audioKey || (e.weapon?.id === 'p9' ? 'shot_p9' : 'shot_hk416');
      if (this.sounds[key]) {
        this.play(key);
      } else if (e.weapon?.audioShot) {
        const shot = e.weapon.audioShot;
        this._tone(shot.freqA, shot.freqB, shot.dur, shot.type, shot.gain);
      }
    });

    on('weapon:cycle',        () => this.play('weapon_cycle'));
    on('weapon:reload:start', () => this.play('reload_start'));
    on('weapon:reload:end',   () => this.play('reload_end'));

    on('shot:bot', e => this.play(e.headshot ? 'hit_headshot' : 'hit_bot'));
    on('shot:world', () => this.play('hit_world'));

    on('bot:died', () => this.play('bot_died'));
    on('bot:fired', () => this.play('bot_shot'));

    on('player:damaged',  () => this.play('player_damaged'));
    on('player:died',     () => this.play('player_died'));
    on('player:footstep', () => this.play('footstep'));
  }
}