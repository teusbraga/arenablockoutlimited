import * as THREE from 'three';
import { on } from '../core/EventBus.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    // sounds populado exclusivamente via setSoundBank(audio.json) durante o boot
    this.sounds = {};
    this.camera = null;
    this.world = null;
    this.activeSpatialLoops = new Map();
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

  playFootstep(material = 'floor') {
    const mat = (material || 'floor').toLowerCase();
    
    // 1. Madeira / Caixotes / Troncos
    if (mat.includes('wood') || mat.includes('crate') || mat.includes('plywood') || mat.includes('trunk')) {
      const s = this.sounds['footstep_wood'] || { freqA: 240, freqB: 110, dur: 0.050, type: 'triangle', gain: 0.07 };
      this._tone(s.freqA, s.freqB, s.dur, s.type, s.gain);
      return;
    }
    // 2. Metal / Andaimes / Grades / Vigas de Aço
    if (mat.includes('metal') || mat.includes('steel') || mat.includes('scaffold') || mat.includes('fence')) {
      const s = this.sounds['footstep_metal'] || { freqA: 420, freqB: 170, dur: 0.038, type: 'square', gain: 0.05 };
      this._tone(s.freqA, s.freqB, s.dur, s.type, s.gain);
      return;
    }
    // 3. Areia / Terra / Grama / Folhagem (Macio e abafado)
    if (mat.includes('sand') || mat.includes('dirt') || mat.includes('grass') || mat.includes('foliage')) {
      const s = this.sounds['footstep_dirt'] || { freqA: 130, freqB: 60, dur: 0.060, type: 'sine', gain: 0.055 };
      this._tone(s.freqA, s.freqB, s.dur, s.type, s.gain);
      return;
    }
    // 4. Concreto / Pedra / Piso padrão (Seco e firme)
    const s = this.sounds['footstep_concrete'] || this.sounds['footstep'] || { freqA: 190, freqB: 85, dur: 0.045, type: 'triangle', gain: 0.06 };
    this._tone(s.freqA, s.freqB, s.dur, s.type, s.gain);
  }

  // =========================================================================
  // ÁUDIO ESPACIAL 3D & OCLUSÃO GEOMÉTRICA (TIER S #1)
  // =========================================================================

  setCamera(camera) {
    this.camera = camera;
  }

  setWorld(world) {
    this.world = world;
  }

  /**
   * Atualiza a posição e orientação tridimensional do ouvinte (Listener) no Web Audio API
   */
  updateListener(camera) {
    if (camera) this.camera = camera;
    const ctx = this._ensure();
    if (!ctx || !this.camera) return;
    const l = ctx.listener;
    if (!l) return;

    const pos = this.camera.position;
    const fwd = { x: 0, y: 0, z: -1 };
    const up = this.camera.up || { x: 0, y: 1, z: 0 };

    if (this.camera.getWorldDirection) {
      if (!this._threeFwd) {
        this._threeFwd = new THREE.Vector3();
      }
      this.camera.getWorldDirection(this._threeFwd);
      fwd.x = this._threeFwd.x;
      fwd.y = this._threeFwd.y;
      fwd.z = this._threeFwd.z;
    }

    const t = ctx.currentTime;
    if (l.positionX) {
      l.positionX.setValueAtTime(pos.x, t);
      l.positionY.setValueAtTime(pos.y, t);
      l.positionZ.setValueAtTime(pos.z, t);
      l.forwardX.setValueAtTime(fwd.x, t);
      l.forwardY.setValueAtTime(fwd.y, t);
      l.forwardZ.setValueAtTime(fwd.z, t);
      l.upX.setValueAtTime(up.x, t);
      l.upY.setValueAtTime(up.y, t);
      l.upZ.setValueAtTime(up.z, t);
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z);
    }
  }

  /**
   * Executa raycast no CollisionWorld para verificar se há obstáculos sólidos entre o ouvinte e a fonte sonora.
   * Retorna true se estiver ocluído por paredes.
   */
  checkOcclusion(srcPos) {
    if (!this.world || !this.camera || !srcPos) return false;
    const camPos = this.camera.position;
    const dx = srcPos.x - camPos.x;
    const dy = srcPos.y - camPos.y;
    const dz = srcPos.z - camPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.25) return false;

    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    // Subtrai tolerância na ponta para não colidir no próprio piso do emissor
    const maxTestDist = Math.max(0.1, dist - 0.25);
    const hit = this.world.raycast(camPos, dir, maxTestDist);
    return !!hit;
  }

  /**
   * Inicia loop sonoro espacial 3D contínuo de chiado de fumaça sob pressão (smoke hiss).
   * Modula dinamicamente filtro de oclusão por parede (muffled) e posicionamento HRTF.
   */
  startSmokeHiss({ id = 'smoke_default', pos, duration = 10.0, gain = 0.35 } = {}) {
    const ctx = this._ensure();
    if (!ctx || !pos) return;

    this.stopSpatialLoop(id);

    // Buffer de ruído aerado com looping
    const bufLen = Math.floor(ctx.sampleRate * 2.0);
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.95 * b0 + white * 0.08;
      b1 = 0.88 * b1 + white * 0.16;
      data[i] = (b0 + b1) * 0.85;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    // Filtro passa-banda para timbre aerado de fumaça/gás sob pressão
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2100;
    bandpass.Q.value = 0.85;

    // Filtro de oclusão passa-baixa dinâmico
    const isOccluded = this.checkOcclusion(pos);
    const occlusionFilter = ctx.createBiquadFilter();
    occlusionFilter.type = 'lowpass';
    occlusionFilter.frequency.value = isOccluded ? 550 : 13000;
    occlusionFilter.Q.value = isOccluded ? 1.4 : 0.7;

    // Ganho
    const gainNode = ctx.createGain();
    const targetGain = isOccluded ? gain * 0.35 : gain;
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 0.20);

    // Panner 3D com HRTF
    let panner = null;
    if (ctx.createPanner) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1.8;
      panner.maxDistance = 45.0;
      panner.rolloffFactor = 1.0;
      if (panner.positionX) {
        const t = ctx.currentTime;
        panner.positionX.setValueAtTime(pos.x, t);
        panner.positionY.setValueAtTime(pos.y, t);
        panner.positionZ.setValueAtTime(pos.z, t);
      } else if (panner.setPosition) {
        panner.setPosition(pos.x, pos.y, pos.z);
      }
    }

    // Conexões: Source -> Bandpass -> Occlusion -> Gain -> Panner -> Destination
    src.connect(bandpass);
    bandpass.connect(occlusionFilter);
    occlusionFilter.connect(gainNode);

    if (panner) {
      gainNode.connect(panner);
      panner.connect(ctx.destination);
    } else {
      gainNode.connect(ctx.destination);
    }

    src.start();

    const loopData = {
      id,
      pos: { x: pos.x, y: pos.y, z: pos.z },
      baseGain: gain,
      duration,
      elapsed: 0,
      src,
      gainNode,
      occlusionFilter,
      panner,
      isOccluded
    };

    if (!this.activeSpatialLoops) this.activeSpatialLoops = new Map();
    this.activeSpatialLoops.set(id, loopData);
  }

  stopSpatialLoop(id) {
    if (!this.activeSpatialLoops || !this.activeSpatialLoops.has(id)) return;
    const item = this.activeSpatialLoops.get(id);
    this.activeSpatialLoops.delete(id);
    if (this.ctx && item.gainNode) {
      try {
        const t = this.ctx.currentTime;
        item.gainNode.gain.setValueAtTime(item.gainNode.gain.value, t);
        item.gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        setTimeout(() => {
          try { item.src.stop(); item.src.disconnect(); } catch (_) {}
        }, 160);
      } catch (_) {}
    }
  }

  /**
   * Dispara som pontual no espaço 3D com HRTF e atenuação/oclusão de parede
   */
  playSpatial(soundKey, pos) {
    const s = this.sounds[soundKey];
    const ctx = this._ensure();
    if (!ctx || !s) {
      if (s) this.play(soundKey);
      return;
    }

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const occ = ctx.createBiquadFilter();
    occ.type = 'lowpass';

    const isOccluded = pos ? this.checkOcclusion(pos) : false;
    occ.frequency.value = isOccluded ? 550 : 14000;
    occ.Q.value = isOccluded ? 1.3 : 0.7;
    const finalGain = isOccluded ? s.gain * 0.40 : s.gain;

    osc.type = s.type || 'sine';
    osc.frequency.setValueAtTime(s.freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(s.freqB, 1), t + s.dur);

    g.gain.setValueAtTime(finalGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + s.dur);

    let panner = null;
    if (pos && ctx.createPanner) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.0;
      panner.maxDistance = 60.0;
      panner.rolloffFactor = 1.0;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(pos.x, t);
        panner.positionY.setValueAtTime(pos.y, t);
        panner.positionZ.setValueAtTime(pos.z, t);
      } else if (panner.setPosition) {
        panner.setPosition(pos.x, pos.y, pos.z);
      }
    }

    osc.connect(occ);
    occ.connect(g);

    if (panner) {
      g.connect(panner);
      panner.connect(ctx.destination);
    } else {
      g.connect(ctx.destination);
    }

    osc.start(t);
    osc.stop(t + s.dur + 0.05);
  }

  /**
   * Atualização contínua de física acústica (atualiza oclusão em tempo real e fades de loops)
   */
  update(dt) {
    if (!this.activeSpatialLoops || this.activeSpatialLoops.size === 0 || !this.ctx) return;
    const t = this.ctx.currentTime;

    for (const [id, item] of this.activeSpatialLoops.entries()) {
      item.elapsed += dt;

      // Posição no Panner
      if (item.panner) {
        if (item.panner.positionX) {
          item.panner.positionX.setValueAtTime(item.pos.x, t);
          item.panner.positionY.setValueAtTime(item.pos.y, t);
          item.panner.positionZ.setValueAtTime(item.pos.z, t);
        } else if (item.panner.setPosition) {
          item.panner.setPosition(item.pos.x, item.pos.y, item.pos.z);
        }
      }

      // Teste dinâmico de oclusão por paredes
      const isOccluded = this.checkOcclusion(item.pos);
      item.isOccluded = isOccluded;

      const targetCutoff = isOccluded ? 550 : 13000;
      const targetGain = isOccluded ? item.baseGain * 0.35 : item.baseGain;

      // Se estiver nos últimos 2 segundos da vida útil, faz fade-out suave
      const timeLeft = item.duration - item.elapsed;
      let finalGain = targetGain;
      if (timeLeft < 2.0 && timeLeft > 0) {
        finalGain = targetGain * Math.max(0, timeLeft / 2.0);
      }

      item.occlusionFilter.frequency.setTargetAtTime(targetCutoff, t, 0.08);
      item.occlusionFilter.Q.setTargetAtTime(isOccluded ? 1.4 : 0.7, t, 0.08);
      item.gainNode.gain.setTargetAtTime(finalGain, t, 0.08);

      if (item.elapsed >= item.duration) {
        this.stopSpatialLoop(id);
      }
    }
  }

  _bind() {
    this._unsubs = [
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
      }),
      on('weapon:empty', () => this.playClickSound(900, 0.08)),
      on('weapon:pump', e => this.playPumpRackSound(e?.stage || 'back')),
      on('weapon:cycle',        () => this.play('weapon_cycle')),
      on('weapon:reload:start', () => this.play('reload_start')),
      on('weapon:reload:end',   () => this.play('reload_end')),
      on('shot:bot', e => {
        const key = e.headshot ? 'hit_headshot' : 'hit_bot';
        if (e?.soundDelay && e.soundDelay > 0.04) {
          setTimeout(() => this.play(key), Math.round(e.soundDelay * 1000));
        } else {
          this.play(key);
        }
      }),
      on('shot:world', e => {
        const soundKey = 'hit_world';
        if (e?.pos) {
          this.playSpatial(soundKey, e.pos);
        } else if (e?.soundDelay && e.soundDelay > 0.04) {
          setTimeout(() => this.play(soundKey), Math.round(e.soundDelay * 1000));
        } else {
          this.play(soundKey);
        }
      }),
      on('bot:died', e => e?.pos ? this.playSpatial('bot_died', e.pos) : this.play('bot_died')),
      on('bot:fired', e => e?.pos ? this.playSpatial('bot_shot', e.pos) : this.play('bot_shot')),
      on('player:damaged',  () => this.play('player_damaged')),
      on('player:died',     () => this.play('player_died')),
      on('player:footstep', e => this.playFootstep(e?.material)),
      on('cheat:activated', () => this.play('hit_headshot')),

      // Eventos de Granada de Fumaça & Áudio Espacial
      on('smoke:detonate', e => {
        if (e?.pos) {
          this.playSpatial('smoke_pop', e.pos);
          this.startSmokeHiss({ id: e.id || 'smoke_nade', pos: e.pos, duration: e.duration || 10.0 });
        }
      }),
      on('smoke:bounce', e => {
        if (e?.pos) this.playSpatial('grenade_bounce', e.pos);
      }),
      on('smoke:stop', e => {
        if (e?.id) this.stopSpatialLoop(e.id);
      }),

      // Balística Terminal: Ricochete e Penetração de Paredes
      on('shot:ricochet', e => {
        const p = e?.point || e?.pos;
        if (p) {
          this.playSpatial('ricochet', p);
        } else {
          this.play('ricochet');
        }
      }),
      on('shot:penetration', e => {
        const mat = (e?.material || 'wall').toLowerCase();
        let soundKey = 'penetration_wood';
        if (mat.includes('metal') || mat.includes('steel')) {
          soundKey = 'penetration_metal';
        } else if (mat.includes('concrete') || mat.includes('stone') || mat.includes('brick')) {
          soundKey = 'penetration_concrete';
        }
        const p = e?.entryPoint || e?.point;
        if (p) {
          this.playSpatial(soundKey, p);
        } else {
          this.play(soundKey);
        }
      }),

      // Supressão Tática: Estalo Supersônico próximo
      on('player:suppression', e => {
        if (e?.pos) {
          this.playSpatial('bullet_whizby', e.pos);
        } else {
          this.play('bullet_whizby');
        }
      })
    ];
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }
    if (this.activeSpatialLoops) {
      for (const id of this.activeSpatialLoops.keys()) {
        this.stopSpatialLoop(id);
      }
      this.activeSpatialLoops.clear();
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try { this.ctx.close(); } catch (_) {}
      this.ctx = null;
    }
  }
}