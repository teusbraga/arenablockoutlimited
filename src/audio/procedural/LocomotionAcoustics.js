/**
 * Acústica de Locomoção Biofísica (Passos com Duplo Impacto)
 * Simula o calcanhar (baixa frequência), o atraso da ponta do pé (~85ms),
 * a ressonância modal da cavidade do solo e o atrito textural da sola.
 */

const getVal = (param, fallback = 0) => (typeof param === 'number' ? param : (param?.value ?? fallback));

export class LocomotionAcoustics {
  constructor(noiseBuffers) {
    this.noiseBuffers = noiseBuffers;
  }

  synthesizeFootstep(params, ctx, destination, startTime = null, material = 'floor', humanize = true) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.08) : 1.0;

    let heelFreq   = getVal(params?.heelFrequency, 130) * j;
    let heelDecay  = (getVal(params?.heelDecay, 38) / 1000) * j;
    let toeDelay   = (getVal(params?.toeDelay, 85) / 1000) * j;
    let toePitch   = getVal(params?.toePitch, 220) * j;
    let surfaceRes = getVal(params?.woodResonance, 180);
    let surfaceQ   = getVal(params?.surfaceQ, 4.5);
    let scuffGain  = getVal(params?.scuffAmount, 0.28);
    let weight     = getVal(params?.bodyWeight, 0.85);

    // Ajuste dinâmico conforme o material do piso
    const mat = (material || 'floor').toLowerCase();
    if (mat.includes('metal') || mat.includes('steel') || mat.includes('scaffold')) {
      surfaceRes = 450;
      surfaceQ   = 8.0;
      heelFreq  *= 1.4;
      toePitch  *= 1.3;
      scuffGain *= 0.6;
    } else if (mat.includes('sand') || mat.includes('dirt') || mat.includes('grass')) {
      surfaceRes = 110;
      surfaceQ   = 1.5;
      heelFreq  *= 0.85;
      toePitch  *= 0.8;
      scuffGain *= 1.4;
      heelDecay *= 1.3;
    } else if (mat.includes('concrete') || mat.includes('stone') || mat.includes('brick')) {
      surfaceRes = 210;
      surfaceQ   = 3.2;
      heelFreq  *= 1.1;
      toePitch  *= 1.1;
    }

    // 1. Transiente do Calcanhar
    const heelOsc = ctx.createOscillator();
    const heelGain = ctx.createGain();
    heelOsc.type = 'sine';
    heelOsc.frequency.setValueAtTime(heelFreq, t0);
    heelOsc.frequency.exponentialRampToValueAtTime(Math.max(20, heelFreq * 0.35), t0 + heelDecay);

    heelGain.gain.setValueAtTime(0.0001, t0);
    heelGain.gain.exponentialRampToValueAtTime(0.42 * weight, t0 + 0.004);
    heelGain.gain.exponentialRampToValueAtTime(0.0001, t0 + heelDecay);

    heelOsc.connect(heelGain);

    // 2. Transiente da Ponta do Pé (Toe Slap secundário)
    const toeOsc = ctx.createOscillator();
    const toeGain = ctx.createGain();
    const tToe = t0 + toeDelay;
    toeOsc.type = 'sine';
    toeOsc.frequency.setValueAtTime(toePitch, tToe);
    toeOsc.frequency.exponentialRampToValueAtTime(Math.max(30, toePitch * 0.4), tToe + 0.035);

    toeGain.gain.setValueAtTime(0.0001, t0);
    toeGain.gain.setValueAtTime(0.0001, tToe);
    toeGain.gain.exponentialRampToValueAtTime(0.22 * weight, tToe + 0.003);
    toeGain.gain.exponentialRampToValueAtTime(0.0001, tToe + 0.04);

    toeOsc.connect(toeGain);

    // 3. Banco de Ressonância Modal do Piso
    const floorFilter = ctx.createBiquadFilter();
    floorFilter.type = 'bandpass';
    floorFilter.frequency.setValueAtTime(surfaceRes, t0);
    floorFilter.Q.setValueAtTime(surfaceQ, t0);

    // Roteamento harmônico modal
    heelGain.connect(floorFilter);
    toeGain.connect(floorFilter);
    floorFilter.connect(destination);

    // Preserva uma parcela sutil do ataque direto seco
    const directGain = ctx.createGain();
    directGain.gain.setValueAtTime(0.35, t0);
    heelGain.connect(directGain);
    toeGain.connect(directGain);
    directGain.connect(destination);

    // 4. Fricção / Scuff (Ruído Rosa)
    if (scuffGain > 0.01 && this.noiseBuffers?.pink) {
      const scuffSrc = this.noiseBuffers.createSource('pink', false);
      const scuffFilter = ctx.createBiquadFilter();
      scuffFilter.type = 'bandpass';
      scuffFilter.frequency.setValueAtTime(1400, t0);
      scuffFilter.Q.setValueAtTime(1.8, t0);

      const scuffEnv = ctx.createGain();
      scuffEnv.gain.setValueAtTime(0.0001, t0);
      scuffEnv.gain.exponentialRampToValueAtTime(scuffGain * 0.25, t0 + 0.015);
      scuffEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);

      scuffSrc.connect(scuffFilter);
      scuffFilter.connect(scuffEnv);
      scuffEnv.connect(destination);

      scuffSrc.start(t0);
      scuffSrc.stop(t0 + 0.1);
    }

    heelOsc.start(t0);
    heelOsc.stop(t0 + heelDecay + 0.05);

    toeOsc.start(tToe);
    toeOsc.stop(tToe + 0.05);
  }
}
