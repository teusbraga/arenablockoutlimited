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

  initNoiseBuffer() {
    const ctx = this._ensure();
    if (!ctx || this.noiseBuffer) return;
    const len = Math.floor(ctx.sampleRate * 0.2);
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
    }
  }

  playPrototypeShot() {
    const ctx = this._ensure();
    if (!ctx) return;
    this.initNoiseBuffer();
    if (!this.noiseBuffer) return;

    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.30, t);
    g1.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    src.connect(bp); bp.connect(g1); g1.connect(ctx.destination);
    src.start(t);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.26, t);
    g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
    osc.connect(g2); g2.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.16);
  }

  playMagnumBoom() {
    const ctx = this._ensure();
    if (!ctx) return;
    this.initNoiseBuffer();
    const t = ctx.currentTime;

    // 1. Onda de choque com filtro passa-baixa ressonante
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(160, t + 0.38);
      lp.Q.value = 3.5;
      const gNoise = ctx.createGain();
      gNoise.gain.setValueAtTime(0.50, t);
      gNoise.gain.exponentialRampToValueAtTime(0.0005, t + 0.40);
      src.connect(lp); lp.connect(gNoise); gNoise.connect(ctx.destination);
      src.start(t);
    }

    // 2. Sub-bass boom dramático e estrondoso (130Hz -> 25Hz)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(130, t);
    subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.45);
    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.58, t);
    gSub.gain.exponentialRampToValueAtTime(0.0005, t + 0.48);
    subOsc.connect(gSub); gSub.connect(ctx.destination);
    subOsc.start(t); subOsc.stop(t + 0.50);

    // 3. Estalo violento da detonação da pólvora Magnum
    const punchOsc = ctx.createOscillator();
    punchOsc.type = 'sawtooth';
    punchOsc.frequency.setValueAtTime(280, t);
    punchOsc.frequency.exponentialRampToValueAtTime(38, t + 0.14);
    const gPunch = ctx.createGain();
    gPunch.gain.setValueAtTime(0.36, t);
    gPunch.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    punchOsc.connect(gPunch); gPunch.connect(ctx.destination);
    punchOsc.start(t); punchOsc.stop(t + 0.18);
  }

  playShotgunBlast() {
    const ctx = this._ensure();
    if (!ctx) return;
    this.initNoiseBuffer();
    const t = ctx.currentTime;

    // 1. Onda de choque explosiva de calibre 12
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 0.32);
      lp.Q.value = 2.8;
      const gNoise = ctx.createGain();
      gNoise.gain.setValueAtTime(0.52, t);
      gNoise.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
      src.connect(lp); lp.connect(gNoise); gNoise.connect(ctx.destination);
      src.start(t);
    }

    // 2. Sub-bass boom encorpado
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(30, t + 0.38);
    const gSub = ctx.createGain();
    gSub.gain.setValueAtTime(0.54, t);
    gSub.gain.exponentialRampToValueAtTime(0.0005, t + 0.42);
    subOsc.connect(gSub); gSub.connect(ctx.destination);
    subOsc.start(t); subOsc.stop(t + 0.44);

    // 3. Estalo violento da detonação
    const crackOsc = ctx.createOscillator();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(320, t);
    crackOsc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const gCrack = ctx.createGain();
    gCrack.gain.setValueAtTime(0.38, t);
    gCrack.gain.exponentialRampToValueAtTime(0.0005, t + 0.15);
    crackOsc.connect(gCrack); gCrack.connect(ctx.destination);
    crackOsc.start(t); crackOsc.stop(t + 0.16);
  }

  playPumpRackSound(stage = 'back') {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;

    if (stage === 'back') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.09);

      const clack = ctx.createOscillator();
      clack.type = 'square';
      clack.frequency.setValueAtTime(820, t + 0.02);
      clack.frequency.exponentialRampToValueAtTime(260, t + 0.06);
      const gClack = ctx.createGain();
      gClack.gain.setValueAtTime(0.16, t + 0.02);
      gClack.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      clack.connect(gClack); gClack.connect(ctx.destination);
      clack.start(t + 0.02); clack.stop(t + 0.08);
    } else {
      const lock = ctx.createOscillator();
      lock.type = 'square';
      lock.frequency.setValueAtTime(1050, t);
      lock.frequency.exponentialRampToValueAtTime(180, t + 0.06);
      const gLock = ctx.createGain();
      gLock.gain.setValueAtTime(0.25, t);
      gLock.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      lock.connect(gLock); gLock.connect(ctx.destination);
      lock.start(t); lock.stop(t + 0.08);

      const thud = ctx.createOscillator();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(180, t);
      thud.frequency.exponentialRampToValueAtTime(60, t + 0.07);
      const gThud = ctx.createGain();
      gThud.gain.setValueAtTime(0.20, t);
      gThud.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      thud.connect(gThud); gThud.connect(ctx.destination);
      thud.start(t); thud.stop(t + 0.09);
    }
  }

  playClickSound(freq = 900, vol = 0.08) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.05);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.06);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.07);
  }

  play(soundKey, panX = 0) {
    const s = this.sounds[soundKey];
    if (s) {
      this._tone(s.freqA, s.freqB, s.dur, s.type, s.gain, panX);
    }
  }

  _bind() {
    on('weapon:fired', e => {
      if (e.weapon?.id === 'rifle_proto' || e.weapon?.audioKey === 'shot_proto') {
        this.playPrototypeShot();
        return;
      }
      if (e.weapon?.id === 'sw500' || e.weapon?.audioKey === 'shot_sw500') {
        this.playMagnumBoom();
        return;
      }
      if (e.weapon?.id === 'm12' || e.weapon?.audioKey === 'shot_m12') {
        this.playShotgunBlast();
        return;
      }
      const key = e.weapon?.audioKey || (e.weapon?.id === 'p9' ? 'shot_p9' : 'shot_hk416');
      if (this.sounds[key]) {
        this.play(key);
      } else if (e.weapon?.audioShot) {
        const shot = e.weapon.audioShot;
        this._tone(shot.freqA, shot.freqB, shot.dur, shot.type, shot.gain);
      }
    });

    on('weapon:empty', () => this.playClickSound(900, 0.08));
    on('weapon:pump', e => this.playPumpRackSound(e?.stage || 'back'));

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