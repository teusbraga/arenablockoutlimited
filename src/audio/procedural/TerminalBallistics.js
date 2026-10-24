/**
 * Balística Terminal de Superfície (Impactos Acústicos Físicos)
 * Decompõe a colisão em Dirac instantâneo, soco estrutural do material e dispersão de detritos.
 */

const getVal = (param, fallback = 0) => (typeof param === 'number' ? param : (param?.value ?? fallback));

export class TerminalBallistics {
  constructor(noiseBuffers) {
    this.noiseBuffers = noiseBuffers;
  }

  /* ========================================================================
     1. IMPACTO EM AREIA / TERRA / SOLO GRANULAR / GRAMA
     ======================================================================== */
  synthesizeBulletHitSand(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.06) : 1.0;

    const thudVal   = getVal(params.groundThud, 0.95);
    const thudFreq  = getVal(params.thudFreq, 120) * j;
    const sprayVal  = getVal(params.sandSpray, 0.85);
    const sprayFreq = getVal(params.sprayFreq, 1400) * j;

    // Soco grave surdo de solo
    if (thudVal > 0.01) {
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(thudFreq, t0);
      thudOsc.frequency.exponentialRampToValueAtTime(35, t0 + 0.028);

      thudGain.gain.setValueAtTime(0.0001, t0);
      thudGain.gain.exponentialRampToValueAtTime(thudVal * 1.0, t0 + 0.0008);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038);

      thudOsc.connect(thudGain);
      thudGain.connect(destination);
      thudOsc.start(t0);
      thudOsc.stop(t0 + 0.042);
    }

    // Dispersão e borrifo de areia
    if (sprayVal > 0.01 && (this.noiseBuffers?.pink || this.noiseBuffers?.white)) {
      const spraySrc = this.noiseBuffers.createSource('pink', false);
      const sprayFilter = ctx.createBiquadFilter();
      sprayFilter.type = 'bandpass';
      sprayFilter.frequency.setValueAtTime(sprayFreq, t0);
      sprayFilter.Q.setValueAtTime(1.4, t0);

      const sprayEnv = ctx.createGain();
      sprayEnv.gain.setValueAtTime(0.0001, t0);
      sprayEnv.gain.linearRampToValueAtTime(sprayVal * 0.85, t0 + 0.001);
      sprayEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);

      spraySrc.connect(sprayFilter);
      sprayFilter.connect(sprayEnv);
      sprayEnv.connect(destination);
      spraySrc.start(t0);
      spraySrc.stop(t0 + 0.080);
    }
  }

  /* ========================================================================
     2. IMPACTO EM MADEIRA / PRANCHAS / CAIXOTES
     ======================================================================== */
  synthesizeBulletHitWood(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.06) : 1.0;

    const crackVal    = getVal(params.fiberCrack, 0.95);
    const thumpVal    = getVal(params.cavityThump, 0.80);
    const woodFreq    = getVal(params.woodResFreq, 240) * j;
    const splintValue = getVal(params.splinters, 0.70);

    // Estalo de fibras de celulose
    if (crackVal > 0.01 && this.noiseBuffers?.white) {
      const crackSrc = this.noiseBuffers.createSource('white', false);
      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(3400, t0);
      crackFilter.Q.setValueAtTime(3.6, t0);

      const crackEnv = ctx.createGain();
      crackEnv.gain.setValueAtTime(0.0001, t0);
      crackEnv.gain.linearRampToValueAtTime(crackVal * 1.0, t0 + 0.0004);
      crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);

      crackSrc.connect(crackFilter);
      crackFilter.connect(crackEnv);
      crackEnv.connect(destination);
      crackSrc.start(t0);
      crackSrc.stop(t0 + 0.018);
    }

    // Soco de cavidade oca da madeira
    if (thumpVal > 0.01) {
      const woodOsc = ctx.createOscillator();
      const woodGain = ctx.createGain();
      woodOsc.type = 'triangle';
      woodOsc.frequency.setValueAtTime(woodFreq, t0);
      woodOsc.frequency.exponentialRampToValueAtTime(Math.max(40, woodFreq * 0.35), t0 + 0.035);

      const modalFilter = ctx.createBiquadFilter();
      modalFilter.type = 'peaking';
      modalFilter.frequency.setValueAtTime(woodFreq * 0.85, t0);
      modalFilter.Q.setValueAtTime(4.2, t0);
      modalFilter.gain.setValueAtTime(8, t0);

      woodGain.gain.setValueAtTime(0.0001, t0);
      woodGain.gain.exponentialRampToValueAtTime(thumpVal * 0.90, t0 + 0.0008);
      woodGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

      woodOsc.connect(modalFilter);
      modalFilter.connect(woodGain);
      woodGain.connect(destination);
      woodOsc.start(t0);
      woodOsc.stop(t0 + 0.050);
    }

    // Farpas e lascas
    if (splintValue > 0.01 && this.noiseBuffers?.white) {
      const tSplint = t0 + 0.008;
      const splintSrc = this.noiseBuffers.createSource('white', false);
      const splintFilter = ctx.createBiquadFilter();
      splintFilter.type = 'bandpass';
      splintFilter.frequency.setValueAtTime(2800, tSplint);
      splintFilter.Q.setValueAtTime(2.4, tSplint);

      const splintEnv = ctx.createGain();
      splintEnv.gain.setValueAtTime(0.0001, t0);
      splintEnv.gain.setValueAtTime(0.0001, tSplint);
      splintEnv.gain.linearRampToValueAtTime(splintValue * 0.60, tSplint + 0.0005);
      splintEnv.gain.exponentialRampToValueAtTime(0.0001, tSplint + 0.026);

      splintSrc.connect(splintFilter);
      splintFilter.connect(splintEnv);
      splintEnv.connect(destination);
      splintSrc.start(tSplint);
      splintSrc.stop(tSplint + 0.032);
    }
  }

  /* ========================================================================
     3. IMPACTO EM ALVENARIA / CONCRETO / TIJOLO / PEDRA
     ======================================================================== */
  synthesizeBulletHitMasonry(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.06) : 1.0;

    const crackVal = getVal(params.mineralCrack, 1.00);
    const knockVal = getVal(params.solidKnock, 0.90);
    const spallVal = getVal(params.debrisSpall, 0.85);
    const debFreq  = getVal(params.debrisFreq, 2600) * j;

    // Estalo de fratura mineral
    if (crackVal > 0.01 && this.noiseBuffers?.white) {
      const crackSrc = this.noiseBuffers.createSource('white', false);
      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = 'highpass';
      crackFilter.frequency.setValueAtTime(3800, t0);

      const crackEnv = ctx.createGain();
      crackEnv.gain.setValueAtTime(0.0001, t0);
      crackEnv.gain.linearRampToValueAtTime(crackVal * 1.0, t0 + 0.0003);
      crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.010);

      crackSrc.connect(crackFilter);
      crackFilter.connect(crackEnv);
      crackEnv.connect(destination);
      crackSrc.start(t0);
      crackSrc.stop(t0 + 0.014);
    }

    // Batida sólida
    if (knockVal > 0.01) {
      const knockOsc = ctx.createOscillator();
      const knockGain = ctx.createGain();
      knockOsc.type = 'triangle';
      knockOsc.frequency.setValueAtTime(190, t0);
      knockOsc.frequency.exponentialRampToValueAtTime(50, t0 + 0.024);

      knockGain.gain.setValueAtTime(0.0001, t0);
      knockGain.gain.exponentialRampToValueAtTime(knockVal * 0.95, t0 + 0.0006);
      knockGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.030);

      knockOsc.connect(knockGain);
      knockGain.connect(destination);
      knockOsc.start(t0);
      knockOsc.stop(t0 + 0.035);
    }

    // Cascalho e poeira
    if (spallVal > 0.01 && this.noiseBuffers?.pink) {
      const spallSrc = this.noiseBuffers.createSource('pink', false);
      const spallFilter = ctx.createBiquadFilter();
      spallFilter.type = 'bandpass';
      spallFilter.frequency.setValueAtTime(debFreq, t0);
      spallFilter.Q.setValueAtTime(2.0, t0);

      const spallEnv = ctx.createGain();
      spallEnv.gain.setValueAtTime(0.0001, t0);
      spallEnv.gain.linearRampToValueAtTime(spallVal * 0.80, t0 + 0.0008);
      spallEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.048);

      spallSrc.connect(spallFilter);
      spallFilter.connect(spallEnv);
      spallEnv.connect(destination);
      spallSrc.start(t0);
      spallSrc.stop(t0 + 0.055);
    }
  }

  /* ========================================================================
     4. IMPACTO EM CHAPA METÁLICA / AÇO
     ======================================================================== */
  synthesizeBulletHitMetal(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.06) : 1.0;

    const snapVal   = getVal(params.leadSpatterSnap, 1.00);
    const thudVal   = getVal(params.steelPlateThud, 0.85);
    const vibVal    = getVal(params.plateVibration, 0.80);
    const plateFreq = getVal(params.plateFreq, 1800) * j;

    // Estalo cortante do chumbo na chapa
    if (snapVal > 0.01 && this.noiseBuffers?.white) {
      const snapSrc = this.noiseBuffers.createSource('white', false);
      const snapFilter = ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(4200, t0);
      snapFilter.Q.setValueAtTime(4.0, t0);

      const snapEnv = ctx.createGain();
      snapEnv.gain.setValueAtTime(0.0001, t0);
      snapEnv.gain.linearRampToValueAtTime(snapVal * 1.0, t0 + 0.0003);
      snapEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.010);

      snapSrc.connect(snapFilter);
      snapFilter.connect(snapEnv);
      snapEnv.connect(destination);
      snapSrc.start(t0);
      snapSrc.stop(t0 + 0.014);
    }

    // Pancada seca na estrutura metálica
    if (thudVal > 0.01) {
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(320, t0);
      thudOsc.frequency.exponentialRampToValueAtTime(110, t0 + 0.022);

      thudGain.gain.setValueAtTime(0.0001, t0);
      thudGain.gain.exponentialRampToValueAtTime(thudVal * 0.85, t0 + 0.0006);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.030);

      thudOsc.connect(thudGain);
      thudGain.connect(destination);
      thudOsc.start(t0);
      thudOsc.stop(t0 + 0.035);
    }

    // Vibração inarmônica do aço (sem apito tonal de desenho animado)
    if (vibVal > 0.01 && this.noiseBuffers?.white) {
      const vibSrc = this.noiseBuffers.createSource('white', false);
      const bpA = ctx.createBiquadFilter();
      bpA.type = 'bandpass';
      bpA.frequency.setValueAtTime(plateFreq, t0);
      bpA.Q.setValueAtTime(3.8, t0);

      const bpB = ctx.createBiquadFilter();
      bpB.type = 'bandpass';
      bpB.frequency.setValueAtTime(plateFreq * 1.45, t0);
      bpB.Q.setValueAtTime(4.5, t0);

      const vibEnv = ctx.createGain();
      vibEnv.gain.setValueAtTime(0.0001, t0);
      vibEnv.gain.linearRampToValueAtTime(vibVal * 0.45, t0 + 0.0005);
      vibEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

      vibSrc.connect(bpA);
      bpA.connect(bpB);
      bpB.connect(vibEnv);
      vibEnv.connect(destination);
      vibSrc.start(t0);
      vibSrc.stop(t0 + 0.050);
    }
  }
}
