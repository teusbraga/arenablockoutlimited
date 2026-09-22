import { on } from '../core/EventBus.js';

// Soundbank padrão caso audio.json não esteja presente
const DEFAULT_SOUNDS = {
  shot_hk416:     { freqA: 180, freqB: 46, dur: 0.095, type: 'sawtooth', gain: 0.22 },
  shot_uzi:       { freqA: 290, freqB: 85, dur: 0.058, type: 'sawtooth', gain: 0.18 },
  shot_m249:      { freqA: 140, freqB: 38, dur: 0.115, type: 'sawtooth', gain: 0.28 },
  shot_p9:        { freqA: 260, freqB: 90, dur: 0.070, type: 'square',   gain: 0.16 },
  weapon_cycle:   { freqA: 600, freqB: 300, dur: 0.070, type: 'square',   gain: 0.09 },
  reload_start:   { freqA: 400, freqB: 200, dur: 0.060, type: 'square',   gain: 0.10 },
  reload_end:     { freqA: 200, freqB: 700, dur: 0.090, type: 'square',   gain: 0.12 },
  hit_bot:        { freqA: 800, freqB: 400, dur: 0.090, type: 'sine',     gain: 0.14 },
  hit_headshot:   { freqA: 1200, freqB: 700, dur: 0.090, type: 'sine',    gain: 0.18 },
  hit_world:      { freqA: 180, freqB: 90, dur: 0.050, type: 'triangle', gain: 0.05 },
  bot_died:       { freqA: 300, freqB: 40, dur: 0.300, type: 'triangle', gain: 0.18 },
  bot_shot:       { freqA: 110, freqB: 45, dur: 0.080, type: 'sawtooth', gain: 0.10 },
  player_damaged: { freqA: 220, freqB: 90, dur: 0.150, type: 'sawtooth', gain: 0.16 },
  player_died:    { freqA: 200, freqB: 30, dur: 0.500, type: 'sawtooth', gain: 0.20 },
  footstep:       { freqA: 180, freqB: 90, dur: 0.045, type: 'triangle', gain: 0.06 }
};

export class AudioSystem {
  constructor(soundBankData = null) {
    this.ctx = null;
    this.sounds = { ...DEFAULT_SOUNDS };
    if (soundBankData?.sounds) {
      Object.assign(this.sounds, soundBankData.sounds);
    }
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