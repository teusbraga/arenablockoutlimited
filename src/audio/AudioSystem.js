import * as THREE from 'three';
import { on } from '../core/EventBus.js';
import { NoiseBuffers } from './procedural/NoiseBuffers.js';
import { SOUND_PRESETS } from './procedural/SoundPresets.js';
import { WeaponSynthesizer } from './procedural/WeaponSynthesizer.js';
import { TerminalBallistics } from './procedural/TerminalBallistics.js';
import { PlayerTraumaAcoustics } from './procedural/PlayerTraumaAcoustics.js';
import { LocomotionAcoustics } from './procedural/LocomotionAcoustics.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.sounds = {};
    this.camera = null;
    this.world = null;
    this.activeSpatialLoops = new Map();

    // Módulos de Síntese Procedural
    this.noiseBuffers = null;
    this.weaponSynth = null;
    this.terminalBallistics = null;
    this.traumaAcoustics = null;
    this.locomotionAcoustics = null;
    this.presets = SOUND_PRESETS;

    // Barramento de Áudio e Ducking Dinâmico de Sobrepressão
    this.masterCompressor = null;
    this.masterGain = null;
    this.weaponsGain = null;
    this.foleyGain = null;
    this.footstepsGain = null;
    this.impactsGain = null;
    this.traumaGain = null;

    // Configurações de Volume Persistentes (localStorage) - Preset Calibrado
    if (typeof localStorage !== 'undefined') {
      try {
        if (!localStorage.getItem('blocky_audio_preset_v2')) {
          localStorage.setItem('blocky_audio_preset_v2', 'true');
          localStorage.setItem('blocky_vol_master', '1.0');
          localStorage.setItem('blocky_vol_weapons', '1.0');
          localStorage.setItem('blocky_vol_footsteps', '0.05');
          localStorage.setItem('blocky_vol_impacts', '0.45');
          localStorage.setItem('blocky_vol_trauma', '0.80');
        }
      } catch (_) {}
    }

    const getSavedVol = (key, fallback) => {
      if (typeof localStorage === 'undefined') return fallback;
      try {
        const v = localStorage.getItem(key);
        return v !== null ? parseFloat(v) : fallback;
      } catch (_) {
        return fallback;
      }
    };

    this.volumes = {
      master: getSavedVol('blocky_vol_master', 1.00),
      weapons: getSavedVol('blocky_vol_weapons', 1.00),
      footsteps: getSavedVol('blocky_vol_footsteps', 0.05),
      impacts: getSavedVol('blocky_vol_impacts', 0.45),
      trauma: getSavedVol('blocky_vol_trauma', 0.80),
    };

    this._threeFwd = null;
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
        const AudioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      } catch (e) {
        return null;
      }

      if (this.ctx) {
        this._initAudioGraph();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  _initAudioGraph() {
    if (!this.ctx) return;

    // 1. Compressor Mestre (Limiter protetor contra distorção de pico / clipping)
    if (this.ctx.createDynamicsCompressor) {
      this.masterCompressor = this.ctx.createDynamicsCompressor();
      this.masterCompressor.threshold.setValueAtTime(-3, this.ctx.currentTime);
      this.masterCompressor.knee.setValueAtTime(6, this.ctx.currentTime);
      this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
      this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.masterCompressor.release.setValueAtTime(0.12, this.ctx.currentTime);
    }

    // 2. Ganho Master
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volumes.master, this.ctx.currentTime);

    // 3. Canal de Armas (Disparos com soco sem ducking neles mesmos)
    this.weaponsGain = this.ctx.createGain();
    this.weaponsGain.gain.setValueAtTime(this.volumes.weapons, this.ctx.currentTime);

    // 4. Canal Secundário / Foley Master (Passos, impactos, fumaça — sofre Ducking de sobrepressão)
    this.foleyGain = this.ctx.createGain();
    this.foleyGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // 5. Sub-buses dedicados conectados ao foleyGain (Sofrem ducking coletivo mas possuem ganhos individuais)
    this.footstepsGain = this.ctx.createGain();
    this.footstepsGain.gain.setValueAtTime(this.volumes.footsteps, this.ctx.currentTime);
    this.footstepsGain.connect(this.foleyGain);

    this.impactsGain = this.ctx.createGain();
    this.impactsGain.gain.setValueAtTime(this.volumes.impacts, this.ctx.currentTime);
    this.impactsGain.connect(this.foleyGain);

    this.traumaGain = this.ctx.createGain();
    this.traumaGain.gain.setValueAtTime(this.volumes.trauma, this.ctx.currentTime);
    this.traumaGain.connect(this.foleyGain);

    // Roteamento em cascata
    if (this.masterCompressor) {
      this.weaponsGain.connect(this.masterCompressor);
      this.foleyGain.connect(this.masterCompressor);
      this.masterCompressor.connect(this.masterGain);
    } else {
      this.weaponsGain.connect(this.masterGain);
      this.foleyGain.connect(this.masterGain);
    }
    this.masterGain.connect(this.ctx.destination);

    // 6. Inicialização dos sintetizadores com buffers de ruído persistentes
    this.noiseBuffers = new NoiseBuffers(this.ctx);
    this.weaponSynth = new WeaponSynthesizer(this.noiseBuffers);
    this.terminalBallistics = new TerminalBallistics(this.noiseBuffers);
    this.traumaAcoustics = new PlayerTraumaAcoustics(this.noiseBuffers);
    this.locomotionAcoustics = new LocomotionAcoustics(this.noiseBuffers);
  }

  // =========================================================================
  // CONTROLE DE VOLUMES DO MIXER
  // =========================================================================

  setMasterVolume(val) {
    val = Math.max(0, Math.min(1, parseFloat(val) || 0));
    this.volumes.master = val;
    if (typeof localStorage !== 'undefined') localStorage.setItem('blocky_vol_master', val.toString());
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setWeaponsVolume(val) {
    val = Math.max(0, Math.min(1, parseFloat(val) || 0));
    this.volumes.weapons = val;
    if (typeof localStorage !== 'undefined') localStorage.setItem('blocky_vol_weapons', val.toString());
    if (this.ctx && this.weaponsGain) {
      this.weaponsGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setFootstepsVolume(val) {
    val = Math.max(0, Math.min(1, parseFloat(val) || 0));
    this.volumes.footsteps = val;
    if (typeof localStorage !== 'undefined') localStorage.setItem('blocky_vol_footsteps', val.toString());
    if (this.ctx && this.footstepsGain) {
      this.footstepsGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setImpactsVolume(val) {
    val = Math.max(0, Math.min(1, parseFloat(val) || 0));
    this.volumes.impacts = val;
    if (typeof localStorage !== 'undefined') localStorage.setItem('blocky_vol_impacts', val.toString());
    if (this.ctx && this.impactsGain) {
      this.impactsGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  setTraumaVolume(val) {
    val = Math.max(0, Math.min(1, parseFloat(val) || 0));
    this.volumes.trauma = val;
    if (typeof localStorage !== 'undefined') localStorage.setItem('blocky_vol_trauma', val.toString());
    if (this.ctx && this.traumaGain) {
      this.traumaGain.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }

  resetVolumes() {
    this.setMasterVolume(1.00);
    this.setWeaponsVolume(1.00);
    this.setFootstepsVolume(0.05);
    this.setImpactsVolume(0.45);
    this.setTraumaVolume(0.80);
  }

  /**
   * Concussão Opressiva (Acoustic Ducking):
   * Disparos próximos atenuam sons secundários por 180-240ms, criando a sensação
   * física de perda transitória de sensibilidade auditiva pela onda de choque.
   */
  triggerAcousticDucking(duckGain = 0.50, duration = 0.22) {
    if (!this.ctx || !this.foleyGain) return;
    const t = this.ctx.currentTime;
    try {
      this.foleyGain.gain.cancelScheduledValues(t);
      this.foleyGain.gain.setValueAtTime(this.foleyGain.gain.value, t);
      this.foleyGain.gain.linearRampToValueAtTime(duckGain, t + 0.005);
      this.foleyGain.gain.exponentialRampToValueAtTime(1.0, t + duration);
    } catch (_) {}
  }

  _tone() {
    // Desativado: sons de sintetizador arcade legados foram removidos
    return;
  }

  playClickSound() {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const dest = this.foleyGain || ctx.destination;

    // 1. Estalo de percussão mecânica com ruído filtrado (Gatilho em câmara vazia)
    if (this.noiseBuffers?.white) {
      const clickSrc = this.noiseBuffers.createSource('white', false);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200, t);
      bp.Q.setValueAtTime(3.0, t);

      const clickEnv = ctx.createGain();
      clickEnv.gain.setValueAtTime(0.0001, t);
      clickEnv.gain.linearRampToValueAtTime(0.18, t + 0.001);
      clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);

      clickSrc.connect(bp);
      bp.connect(clickEnv);
      clickEnv.connect(dest);

      clickSrc.start(t);
      clickSrc.stop(t + 0.025);
    }

    // 2. Transiente metálico seco de impacto do desconector / cão batendo em falso
    const pinOsc = ctx.createOscillator();
    const pinGain = ctx.createGain();
    pinOsc.type = 'triangle';
    pinOsc.frequency.setValueAtTime(1600, t);
    pinOsc.frequency.exponentialRampToValueAtTime(380, t + 0.012);

    pinGain.gain.setValueAtTime(0.0001, t);
    pinGain.gain.linearRampToValueAtTime(0.10, t + 0.001);
    pinGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

    pinOsc.connect(pinGain);
    pinGain.connect(dest);

    pinOsc.start(t);
    pinOsc.stop(t + 0.02);
  }

  play() {
    // Desativado: sons arcade legados foram removidos
    return;
  }

  playFootstep(material = 'floor') {
    const ctx = this._ensure();
    if (!ctx) return;
    const dest = this.footstepsGain || this.foleyGain || ctx.destination;
    if (this.locomotionAcoustics) {
      this.locomotionAcoustics.synthesizeFootstep(
        this.presets.footstep_default,
        ctx,
        dest,
        null,
        material,
        true
      );
    }
  }

  // =========================================================================
  // ÁUDIO ESPACIAL 3D & OCLUSÃO GEOMÉTRICA
  // =========================================================================

  setCamera(camera) {
    this.camera = camera;
  }

  setWorld(world) {
    this.world = world;
  }

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

  checkOcclusion(srcPos) {
    if (!this.world || !this.camera || !srcPos) return false;
    const camPos = this.camera.position;
    const dx = srcPos.x - camPos.x;
    const dy = srcPos.y - camPos.y;
    const dz = srcPos.z - camPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.25) return false;

    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const maxTestDist = Math.max(0.1, dist - 0.25);
    const hit = this.world.raycast(camPos, dir, maxTestDist);
    return !!hit;
  }

  /**
   * Constrói destino espacial 3D com HRTF, oclusão por raycast e amortecimento de ar por distância.
   */
  createSpatialDestination(pos, isFoley = true) {
    const ctx = this._ensure();
    if (!ctx) return { node: null, dist: 0 };

    const t = ctx.currentTime;
    let dist = 1.0;
    if (this.camera && pos) {
      const c = this.camera.position;
      dist = Math.hypot(pos.x - c.x, pos.y - c.y, pos.z - c.z);
    }

    // 1. Filtro de Oclusão por Parede
    const isOccluded = pos ? this.checkOcclusion(pos) : false;
    const occFilter = ctx.createBiquadFilter();
    occFilter.type = 'lowpass';
    occFilter.frequency.setValueAtTime(isOccluded ? 550 : 14000, t);
    occFilter.Q.setValueAtTime(isOccluded ? 1.4 : 0.7, t);

    // 2. Filtro Atmosférico por Distância (Rolloff natural de altas frequências)
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    const airCutoff = Math.max(800, 16000 - dist * 220);
    airFilter.frequency.setValueAtTime(airCutoff, t);

    // 3. Panner 3D HRTF
    let panner = null;
    if (pos && ctx.createPanner) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.0;
      panner.maxDistance = 75.0;
      panner.rolloffFactor = 1.0;
      if (panner.positionX) {
        panner.positionX.setValueAtTime(pos.x, t);
        panner.positionY.setValueAtTime(pos.y, t);
        panner.positionZ.setValueAtTime(pos.z, t);
      } else if (panner.setPosition) {
        panner.setPosition(pos.x, pos.y, pos.z);
      }
    }

    let bus = this.foleyGain || ctx.destination;
    if (isFoley === false || isFoley === 'weapons') {
      bus = this.weaponsGain || ctx.destination;
    } else if (isFoley === 'impacts') {
      bus = this.impactsGain || this.foleyGain || ctx.destination;
    } else if (isFoley === 'footsteps') {
      bus = this.footstepsGain || this.foleyGain || ctx.destination;
    } else if (isFoley === 'trauma') {
      bus = this.traumaGain || this.foleyGain || ctx.destination;
    }

    occFilter.connect(airFilter);
    if (panner) {
      airFilter.connect(panner);
      panner.connect(bus);
    } else {
      airFilter.connect(bus);
    }

    return {
      node: occFilter,
      dist,
      isOccluded
    };
  }

  playSpatial() {
    // Desativado: sons espaciais arcade legados foram removidos
    return;
  }

  // --- LOOPS ESPACIAIS (SMOKE GRENADE HISS) ---
  startSmokeHiss({ id = 'smoke_default', pos, duration = 10.0, gain = 0.35 } = {}) {
    const ctx = this._ensure();
    if (!ctx || !pos) return;

    this.stopSpatialLoop(id);

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

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2100;
    bandpass.Q.value = 0.85;

    const isOccluded = this.checkOcclusion(pos);
    const occlusionFilter = ctx.createBiquadFilter();
    occlusionFilter.type = 'lowpass';
    occlusionFilter.frequency.value = isOccluded ? 550 : 13000;
    occlusionFilter.Q.value = isOccluded ? 1.4 : 0.7;

    const gainNode = ctx.createGain();
    const targetGain = isOccluded ? gain * 0.35 : gain;
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + 0.20);

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

    src.connect(bandpass);
    bandpass.connect(occlusionFilter);
    occlusionFilter.connect(gainNode);

    const bus = this.foleyGain || ctx.destination;
    if (panner) {
      gainNode.connect(panner);
      panner.connect(bus);
    } else {
      gainNode.connect(bus);
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

  update(dt) {
    if (!this.activeSpatialLoops || this.activeSpatialLoops.size === 0 || !this.ctx) return;
    const t = this.ctx.currentTime;

    for (const [id, item] of this.activeSpatialLoops.entries()) {
      item.elapsed += dt;

      if (item.panner) {
        if (item.panner.positionX) {
          item.panner.positionX.setValueAtTime(item.pos.x, t);
          item.panner.positionY.setValueAtTime(item.pos.y, t);
          item.panner.positionZ.setValueAtTime(item.pos.z, t);
        } else if (item.panner.setPosition) {
          item.panner.setPosition(item.pos.x, item.pos.y, item.pos.z);
        }
      }

      const isOccluded = this.checkOcclusion(item.pos);
      item.isOccluded = isOccluded;

      const targetCutoff = isOccluded ? 550 : 13000;
      const targetGain = isOccluded ? item.baseGain * 0.35 : item.baseGain;

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

  // =========================================================================
  // DISPATCHERS DE ÁUDIO PROCEDURAL
  // =========================================================================

  playProceduralShot(weaponId, destinationNode = null) {
    const ctx = this._ensure();
    if (!ctx || !this.weaponSynth) return;

    const dest = destinationNode || this.weaponsGain || ctx.destination;
    const id = (weaponId || '').toLowerCase();

    // 1. Winchester 1912 (Shotgun)
    if (id === 'm12') {
      this.weaponSynth.synthesizeShotgunBlast12G(this.presets.shotgun_blast_12g, ctx, dest, null, true);
      // Se for o disparo em 1ª pessoa (dest === this.weaponsGain), engatilha ciclo de pump
      if (!destinationNode || destinationNode === this.weaponsGain) {
        setTimeout(() => this.playPumpRackSound('back'), 220);
        setTimeout(() => this.playPumpRackSound('forward'), 420);
      }
      return;
    }

    // 2. S&W .500 Magnum
    if (id === 'sw500') {
      this.weaponSynth.synthesizeSW500Magnum(this.presets.sw500_magnum, ctx, dest, null, true);
      return;
    }

    // 3. Fuzil 5.56mm NATO (HK416, M249, Prototype)
    if (id === 'ar15' || id === 'm249' || id === 'rifle_proto') {
      this.weaponSynth.synthesizeRifle556(this.presets.rifle_556, ctx, dest, null, true);
      return;
    }

    // 4. Fuzil Soviético AK-47 7.62x39mm (Disparo Dramático + Pistão de 500g)
    if (id === 'ak47') {
      this.weaponSynth.synthesizeAK47(this.presets.ak47_762x39, ctx, dest, null, true);
      return;
    }

    // 5. Fuzil .308 Win / 7.62x51mm (SCAR-H)
    if (id === 'scar_h') {
      this.weaponSynth.synthesizeRifle308(this.presets.rifle_308, ctx, dest, null, true);
      return;
    }

    // 5. UZI 9mm Open-Bolt
    if (id === 'uzi') {
      this.weaponSynth.synthesizeUzi(this.presets.smg_uzi_9mm, ctx, dest, null, true);
      return;
    }

    // 6. VSS Vintorez 9x39mm
    if (id === 'vss') {
      this.weaponSynth.synthesizeVSS(this.presets.vss_vintorez_9x39, ctx, dest, null, true);
      return;
    }

    // 7. P-9 / Pistolas 9mm
    if (id === 'p9') {
      this.weaponSynth.synthesizeGunshot9mm(this.presets.gunshot_9mm, ctx, dest, null, true);
      return;
    }

    // Fallback padrão: Fuzil 5.56
    this.weaponSynth.synthesizeRifle556(this.presets.rifle_556, ctx, dest, null, true);
  }

  playPumpRackSound(stage = 'back') {
    const ctx = this._ensure();
    if (!ctx || !this.weaponSynth) return;
    const dest = this.foleyGain || ctx.destination;
    if (stage === 'back') {
      this.weaponSynth.synthesizeShotgunPumpBack(this.presets.shotgun_pump_back, ctx, dest, null, true);
    } else {
      this.weaponSynth.synthesizeShotgunPumpForward(this.presets.shotgun_pump_forward, ctx, dest, null, true);
    }
  }

  playProceduralSurfaceHit(material, pos, soundDelay = 0) {
    const ctx = this._ensure();
    if (!ctx || !this.terminalBallistics) return;

    const execute = () => {
      const { node } = this.createSpatialDestination(pos, 'impacts');
      const dest = node || this.impactsGain || this.foleyGain || ctx.destination;
      const mat = (material || '').toLowerCase();

      if (mat.includes('wood') || mat.includes('crate') || mat.includes('board') || mat.includes('door')) {
        this.terminalBallistics.synthesizeBulletHitWood(this.presets.bullet_hit_wood, ctx, dest, null, true);
      } else if (mat.includes('metal') || mat.includes('steel') || mat.includes('scaffold') || mat.includes('barrel')) {
        this.terminalBallistics.synthesizeBulletHitMetal(this.presets.bullet_hit_metal, ctx, dest, null, true);
      } else if (mat.includes('concrete') || mat.includes('stone') || mat.includes('brick') || mat.includes('masonry') || mat.includes('wall')) {
        this.terminalBallistics.synthesizeBulletHitMasonry(this.presets.bullet_hit_masonry, ctx, dest, null, true);
      } else {
        // Areia, terra, solo granular, grama, chão genérico
        this.terminalBallistics.synthesizeBulletHitSand(this.presets.bullet_hit_sand, ctx, dest, null, true);
      }
    };

    if (soundDelay && soundDelay > 0.035) {
      setTimeout(execute, Math.round(soundDelay * 1000));
    } else {
      execute();
    }
  }

  _bind() {
    this._unsubs = [
      // 1. Disparo da Arma do Jogador (1ª Pessoa)
      on('weapon:fired', e => {
        const weaponId = e?.weaponId || e?.weapon?.id || 'ar15';
        this.playProceduralShot(weaponId, null);
        // Sobrepressão e concussão imediata no ouvido do próprio atirador
        this.triggerAcousticDucking(0.45, 0.22);
      }),

      // 2. Disparo de Bots no Espaço 3D
      on('bot:fired', e => {
        const weaponId = e?.weaponId || e?.bot?.weaponId || 'ak47';
        const pos = e?.muzzleWorld || e?.pos;
        const { node, dist } = this.createSpatialDestination(pos, false);
        this.playProceduralShot(weaponId, node);

        // Se o disparo inimigo estiver colado no jogador (< 4.5m), aplica sobrepressão opressiva
        if (dist < 4.5) {
          const duckAmount = Math.max(0.40, 0.40 + (dist / 4.5) * 0.35);
          this.triggerAcousticDucking(duckAmount, 0.18);
        }
      }),

      on('weapon:empty', () => this.playClickSound()),
      on('weapon:pump', e => this.playPumpRackSound(e?.stage || 'back')),

      // 3. Recargas Mecânicas Táteis Procedurais
      on('weapon:reload:start', e => {
        const ctx = this._ensure();
        if (!ctx || !this.weaponSynth) return;
        const wId = e?.weaponId || 'ar15';
        const dest = this.foleyGain || ctx.destination;

        if (wId === 'm12') {
          // Inserção da Shell Calibre 12 calibrada da imagem
          this.weaponSynth.synthesizeShotgunLoadShell(this.presets.shotgun_load_shell, ctx, dest, null, true);
        } else if (wId === 'p9') {
          this.weaponSynth.synthesizeSlidePull(this.presets.pistol_slide_pull, ctx, dest, null, true);
        } else if (wId === 'ak47') {
          this.weaponSynth.synthesizeMagAkMetalInsert(this.presets.mag_ak_metal_insert, ctx, dest, null, true);
        } else {
          // Fuzis Stanag (HK416, SCAR-H, M249, UZI, VSS)
          this.weaponSynth.synthesizeMagStanagInsert(this.presets.mag_stanag_insert, ctx, dest, null, true);
        }
      }),

      on('weapon:reload:end', e => {
        const ctx = this._ensure();
        if (!ctx || !this.weaponSynth) return;
        const wId = e?.weaponId || 'ar15';
        const dest = this.foleyGain || ctx.destination;

        if (wId === 'p9') {
          this.weaponSynth.synthesizeSlideRelease(this.presets.pistol_slide_release, ctx, dest, null, true);
        } else if (wId === 'm12') {
          this.weaponSynth.synthesizeShotgunPumpForward(this.presets.shotgun_pump_forward, ctx, dest, null, true);
        } else {
          // Fechamento de ferrolho em bateria procedural (eliminado o beep square wave)
          this.weaponSynth.synthesizeSlideRelease(this.presets.pistol_slide_release, ctx, dest, null, true);
        }
      }),

      // 4. Balística Terminal de Superfície (Impactos, Penetração e Ricochete Procedurais)
      on('shot:world', e => {
        const hitPos = e?.point || e?.pos;
        this.playProceduralSurfaceHit(e?.material, hitPos, e?.soundDelay || 0);
      }),

      on('shot:penetration', e => {
        const hitPos = e?.entryPoint || e?.point || e?.pos;
        this.playProceduralSurfaceHit(e?.material || 'wood', hitPos, 0);
      }),

      on('shot:ricochet', e => {
        const hitPos = e?.point || e?.pos;
        this.playProceduralSurfaceHit('metal', hitPos, 0);
      }),

      // 5. Dano no Jogador: Exclusivamente Placa Balística / Kevlar com Ressonância Dinâmica
      on('player:damaged', e => {
        const ctx = this._ensure();
        const dmg = e?.dmg || 25;
        const dest = this.traumaGain || this.foleyGain || ctx.destination;
        if (ctx && this.traumaAcoustics) {
          this.traumaAcoustics.synthesizeBulletHitKevlar(
            this.presets.bullet_hit_kevlar,
            ctx,
            dest,
            null,
            dmg
          );
        }
      }),

      on('player:footstep', e => this.playFootstep(e?.material)),

      // 6. Granada de Fumaça (Hissing de Fumaça Procedural)
      on('smoke:detonate', e => {
        if (e?.pos) {
          this.startSmokeHiss({ id: e.id || 'smoke_nade', pos: e.pos, duration: e.duration || 10.0 });
        }
      }),
      on('smoke:stop', e => {
        if (e?.id) this.stopSpatialLoop(e.id);
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
