/**
 * Sintetizador Procedural de Armas de Fogo e Mecânica Tátil
 * Modelagem física de queima de pólvora, sobrepressão de câmara, choque supersônico e ciclos mecânicos.
 */

const getVal = (param, fallback = 0) => (typeof param === 'number' ? param : (param?.value ?? fallback));

export class WeaponSynthesizer {
  constructor(noiseBuffers) {
    this.noiseBuffers = noiseBuffers;
  }

  /* ========================================================================
     1. FUZIL 5.56mm NATO (HK416, M249 SAW)
     ======================================================================== */
  synthesizeRifle556(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const crackGain    = getVal(params.supersonicCrack, 0.95);
    const blastFreq    = getVal(params.muzzleBlastFreq, 290) * j;
    const blastDur     = (getVal(params.muzzleDecay, 85) / 1000) * j;
    const bcgGain      = getVal(params.bcgCycle, 0.65);
    const barrelRes    = getVal(params.barrelRing, 780);
    const overBody     = getVal(params.overpressureBody, 0.75);
    const tailGain     = getVal(params.acousticTail, 0.60);
    const airCut       = getVal(params.airAbsorption, 3500);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airCut, t0);
    masterFilter.connect(destination);

    // 1. Crack Supersônico do Projétil (Mach 2.7)
    if (crackGain > 0.01 && this.noiseBuffers?.white) {
      const crackSrc = this.noiseBuffers.createSource('white', false);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(4500, t0);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(7500, t0);
      bp.Q.setValueAtTime(4.0, t0);

      const crackEnv = ctx.createGain();
      crackEnv.gain.setValueAtTime(0.0001, t0);
      crackEnv.gain.exponentialRampToValueAtTime(crackGain * 1.1, t0 + 0.0005);
      crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);

      crackSrc.connect(hp);
      hp.connect(bp);
      bp.connect(crackEnv);
      crackEnv.connect(masterFilter);
      crackSrc.start(t0);
      crackSrc.stop(t0 + 0.018);
    }

    // Chicote tonal supersônico
    const whipOsc = ctx.createOscillator();
    const whipGain = ctx.createGain();
    whipOsc.type = 'sawtooth';
    whipOsc.frequency.setValueAtTime(3800, t0);
    whipOsc.frequency.exponentialRampToValueAtTime(800, t0 + 0.014);
    whipGain.gain.setValueAtTime(0.0001, t0);
    whipGain.gain.exponentialRampToValueAtTime(crackGain * 0.45, t0 + 0.0004);
    whipGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.016);
    whipOsc.connect(whipGain);
    whipGain.connect(masterFilter);
    whipOsc.start(t0);
    whipOsc.stop(t0 + 0.02);

    // 2. Muzzle Blast Percussivo (~1.8g de pólvora)
    const blastOsc = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blastOsc.type = 'triangle';
    blastOsc.frequency.setValueAtTime(blastFreq, t0);
    blastOsc.frequency.exponentialRampToValueAtTime(Math.max(30, blastFreq * 0.18), t0 + blastDur);
    blastGain.gain.setValueAtTime(0.0001, t0);
    blastGain.gain.exponentialRampToValueAtTime(1.0 * overBody, t0 + 0.003);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur);

    const barrelFilter = ctx.createBiquadFilter();
    barrelFilter.type = 'peaking';
    barrelFilter.frequency.setValueAtTime(barrelRes, t0);
    barrelFilter.Q.setValueAtTime(4.5, t0);
    barrelFilter.gain.setValueAtTime(10, t0);

    blastOsc.connect(barrelFilter);
    barrelFilter.connect(blastGain);
    blastGain.connect(masterFilter);
    blastOsc.start(t0);
    blastOsc.stop(t0 + blastDur + 0.02);

    // 3. Sobrepressão Gasosa (Câmara a 52.000 PSI)
    if (overBody > 0.01 && this.noiseBuffers?.brown) {
      const ovpSrc = this.noiseBuffers.createSource('brown', false);
      const ovpFilter = ctx.createBiquadFilter();
      ovpFilter.type = 'lowpass';
      ovpFilter.frequency.setValueAtTime(350, t0);
      ovpFilter.frequency.exponentialRampToValueAtTime(60, t0 + blastDur * 0.8);

      const ovpEnv = ctx.createGain();
      ovpEnv.gain.setValueAtTime(0.0001, t0);
      ovpEnv.gain.exponentialRampToValueAtTime(overBody * 0.55, t0 + 0.005);
      ovpEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur * 0.9);

      ovpSrc.connect(ovpFilter);
      ovpFilter.connect(ovpEnv);
      ovpEnv.connect(masterFilter);
      ovpSrc.start(t0);
      ovpSrc.stop(t0 + blastDur);
    }

    // 4. Ciclo do BCG a Gás
    if (bcgGain > 0.01) {
      const pinOsc = ctx.createOscillator();
      const pinGain = ctx.createGain();
      pinOsc.type = 'square';
      pinOsc.frequency.setValueAtTime(2400, t0);
      pinGain.gain.setValueAtTime(0.0001, t0);
      pinGain.gain.exponentialRampToValueAtTime(bcgGain * 0.5, t0 + 0.0006);
      pinGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.009);
      pinOsc.connect(pinGain);
      pinGain.connect(masterFilter);
      pinOsc.start(t0);
      pinOsc.stop(t0 + 0.012);

      const tBcgBack = t0 + 0.065;
      const bcgOscBack = ctx.createOscillator();
      const bcgGainBack = ctx.createGain();
      bcgOscBack.type = 'sawtooth';
      bcgOscBack.frequency.setValueAtTime(700, tBcgBack);
      bcgOscBack.frequency.exponentialRampToValueAtTime(220, tBcgBack + 0.03);
      bcgGainBack.gain.setValueAtTime(0.0001, t0);
      bcgGainBack.gain.setValueAtTime(0.0001, tBcgBack);
      bcgGainBack.gain.exponentialRampToValueAtTime(bcgGain * 0.5, tBcgBack + 0.003);
      bcgGainBack.gain.exponentialRampToValueAtTime(0.0001, tBcgBack + 0.038);
      bcgOscBack.connect(bcgGainBack);
      bcgGainBack.connect(masterFilter);
      bcgOscBack.start(tBcgBack);
      bcgOscBack.stop(tBcgBack + 0.045);
    }

    // 5. Cauda Acústica
    if (tailGain > 0.01 && this.noiseBuffers?.pink) {
      const tailSrc = this.noiseBuffers.createSource('pink', false);
      const tailLP = ctx.createBiquadFilter();
      tailLP.type = 'lowpass';
      tailLP.frequency.setValueAtTime(1600, t0);
      tailLP.frequency.exponentialRampToValueAtTime(180, t0 + 1.4);

      const tailEnv = ctx.createGain();
      tailEnv.gain.setValueAtTime(0.0001, t0);
      tailEnv.gain.exponentialRampToValueAtTime(tailGain * 0.55, t0 + 0.018);
      tailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.35);

      tailSrc.connect(tailLP);
      tailLP.connect(tailEnv);
      tailEnv.connect(masterFilter);
      tailSrc.start(t0);
      tailSrc.stop(t0 + 1.45);
    }
  }

  /* ========================================================================
     2. FUZIL .308 WIN / 7.62x51mm (FN SCAR-H, AK-47)
     ======================================================================== */
  synthesizeRifle308(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.04) : 1.0;

    const crackGain     = getVal(params.supersonicCrack, 0.98);
    const blastFreq     = getVal(params.muzzleConcussionFreq, 190) * j;
    const blastDur      = (getVal(params.muzzleDecay, 130) / 1000) * j;
    const overpressure  = getVal(params.overpressureBlast, 0.90);
    const barrelRes     = getVal(params.heavyBarrelRing, 540);
    const boltGain      = getVal(params.boltActionMech, 0.72);
    const echoGain      = getVal(params.valleyEcho, 0.75);
    const airCut        = getVal(params.airDamping, 2800);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airCut, t0);
    masterFilter.connect(destination);

    // 1. Crack Supersônico denso de 7.62mm
    if (crackGain > 0.01 && this.noiseBuffers?.white) {
      const crackSrc = this.noiseBuffers.createSource('white', false);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(3200, t0);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(5800, t0);
      bp.Q.setValueAtTime(3.6, t0);

      const crackEnv = ctx.createGain();
      crackEnv.gain.setValueAtTime(0.0001, t0);
      crackEnv.gain.exponentialRampToValueAtTime(crackGain * 1.15, t0 + 0.0006);
      crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.016);

      crackSrc.connect(hp);
      hp.connect(bp);
      bp.connect(crackEnv);
      crackEnv.connect(masterFilter);
      crackSrc.start(t0);
      crackSrc.stop(t0 + 0.022);
    }

    const whipOsc = ctx.createOscillator();
    const whipGain = ctx.createGain();
    whipOsc.type = 'sawtooth';
    whipOsc.frequency.setValueAtTime(3000, t0);
    whipOsc.frequency.exponentialRampToValueAtTime(550, t0 + 0.018);
    whipGain.gain.setValueAtTime(0.0001, t0);
    whipGain.gain.exponentialRampToValueAtTime(crackGain * 0.55, t0 + 0.0005);
    whipGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);
    whipOsc.connect(whipGain);
    whipGain.connect(masterFilter);
    whipOsc.start(t0);
    whipOsc.stop(t0 + 0.025);

    // 2. Concussão de ~3g de Pólvora / 3.500 Joules
    const blastOsc = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blastOsc.type = 'triangle';
    blastOsc.frequency.setValueAtTime(blastFreq, t0);
    blastOsc.frequency.exponentialRampToValueAtTime(Math.max(24, blastFreq * 0.16), t0 + blastDur);
    blastGain.gain.setValueAtTime(0.0001, t0);
    blastGain.gain.exponentialRampToValueAtTime(1.15 * overpressure, t0 + 0.003);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur);

    const barrelFilter = ctx.createBiquadFilter();
    barrelFilter.type = 'peaking';
    barrelFilter.frequency.setValueAtTime(barrelRes, t0);
    barrelFilter.Q.setValueAtTime(4.2, t0);
    barrelFilter.gain.setValueAtTime(12, t0);

    blastOsc.connect(barrelFilter);
    barrelFilter.connect(blastGain);
    blastGain.connect(masterFilter);
    blastOsc.start(t0);
    blastOsc.stop(t0 + blastDur + 0.03);

    // 3. Soco de Sobrepressão (62k PSI)
    if (overpressure > 0.01 && this.noiseBuffers?.brown) {
      const ovpSrc = this.noiseBuffers.createSource('brown', false);
      const ovpFilter = ctx.createBiquadFilter();
      ovpFilter.type = 'lowpass';
      ovpFilter.frequency.setValueAtTime(280, t0);
      ovpFilter.frequency.exponentialRampToValueAtTime(45, t0 + blastDur);

      const ovpEnv = ctx.createGain();
      ovpEnv.gain.setValueAtTime(0.0001, t0);
      ovpEnv.gain.exponentialRampToValueAtTime(overpressure * 0.75, t0 + 0.006);
      ovpEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur * 1.1);

      ovpSrc.connect(ovpFilter);
      ovpFilter.connect(ovpEnv);
      ovpEnv.connect(masterFilter);
      ovpSrc.start(t0);
      ovpSrc.stop(t0 + blastDur * 1.15);
    }

    // 4. Mecânica Pesada do Ferrolho
    if (boltGain > 0.01) {
      const pinOsc = ctx.createOscillator();
      const pinGain = ctx.createGain();
      pinOsc.type = 'square';
      pinOsc.frequency.setValueAtTime(1900, t0);
      pinGain.gain.setValueAtTime(0.0001, t0);
      pinGain.gain.exponentialRampToValueAtTime(boltGain * 0.55, t0 + 0.0006);
      pinGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.01);
      pinOsc.connect(pinGain);
      pinGain.connect(masterFilter);
      pinOsc.start(t0);
      pinOsc.stop(t0 + 0.014);

      const tBoltBack = t0 + 0.078;
      const boltBackOsc = ctx.createOscillator();
      const boltBackGain = ctx.createGain();
      boltBackOsc.type = 'sawtooth';
      boltBackOsc.frequency.setValueAtTime(560, tBoltBack);
      boltBackOsc.frequency.exponentialRampToValueAtTime(160, tBoltBack + 0.04);
      boltBackGain.gain.setValueAtTime(0.0001, t0);
      boltBackGain.gain.setValueAtTime(0.0001, tBoltBack);
      boltBackGain.gain.exponentialRampToValueAtTime(boltGain * 0.5, tBoltBack + 0.004);
      boltBackGain.gain.exponentialRampToValueAtTime(0.0001, tBoltBack + 0.048);
      boltBackOsc.connect(boltBackGain);
      boltBackGain.connect(masterFilter);
      boltBackOsc.start(tBoltBack);
      boltBackOsc.stop(tBoltBack + 0.055);
    }

    // 5. Eco em Vale
    if (echoGain > 0.01 && this.noiseBuffers?.pink) {
      const echoSrc = this.noiseBuffers.createSource('pink', false);
      const echoLP = ctx.createBiquadFilter();
      echoLP.type = 'lowpass';
      echoLP.frequency.setValueAtTime(1400, t0);
      echoLP.frequency.exponentialRampToValueAtTime(110, t0 + 2.0);

      const echoEnv = ctx.createGain();
      echoEnv.gain.setValueAtTime(0.0001, t0);
      echoEnv.gain.exponentialRampToValueAtTime(echoGain * 0.65, t0 + 0.025);
      echoEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.95);

      echoSrc.connect(echoLP);
      echoLP.connect(echoEnv);
      echoEnv.connect(masterFilter);
      echoSrc.start(t0);
      echoSrc.stop(t0 + 2.1);
    }
  }

  /* ========================================================================
     FUZIL AK SUPPRESSED / AK-47 7.62x39mm (DISPARO SECO, ESTRIDENTE E PRESENTE)
     ======================================================================== */
  synthesizeAKSuppressed(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.04) : 1.0;

    const crackVal = getVal(params?.supersonicCrack, 1.00);
    const barkFreq = getVal(params?.muzzleBarkFreq, 240) * j;
    const blastDur = (getVal(params?.blastDecay, 85) / 1000) * j;
    const mechVal  = getVal(params?.boltPistonMech, 0.85);
    const recFreq  = getVal(params?.receiverSteelRing, 1650);
    const echoVal  = getVal(params?.dramaticEcho, 0.25);
    const airCut   = getVal(params?.airAbsorption, 9000);

    // Filtro mestre de saída (aberto e presente, sem abafamento)
    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airCut, t0);
    masterFilter.connect(destination);

    // 1. Crack supersônico Mach 2.1 (ogiva M43 123gr rompendo a barreira do som - estridente e cortante)
    if (crackVal > 0.01) {
      const whipOsc = ctx.createOscillator();
      const whipGain = ctx.createGain();
      whipOsc.type = 'sawtooth';
      whipOsc.frequency.setValueAtTime(4600, t0);
      whipOsc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.012);

      whipGain.gain.setValueAtTime(0.0001, t0);
      whipGain.gain.exponentialRampToValueAtTime(crackVal * 1.0, t0 + 0.0003);
      whipGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);

      whipOsc.connect(whipGain);
      whipGain.connect(masterFilter);
      whipOsc.start(t0);
      whipOsc.stop(t0 + 0.016);

      if (this.noiseBuffers?.white) {
        // Estalo de alta frequência passa-banda
        const crackNoise = this.noiseBuffers.createSource('white', false);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(5200, t0);
        bp.Q.setValueAtTime(3.5, t0);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t0);
        env.gain.exponentialRampToValueAtTime(crackVal * 1.05, t0 + 0.0004);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);

        crackNoise.connect(bp);
        bp.connect(env);
        env.connect(masterFilter);
        crackNoise.start(t0);
        crackNoise.stop(t0 + 0.015);

        // Mordida estridente passa-altas imediata
        const snapNoise = this.noiseBuffers.createSource('white', false);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(4200, t0);

        const snapEnv = ctx.createGain();
        snapEnv.gain.setValueAtTime(0.0001, t0);
        snapEnv.gain.linearRampToValueAtTime(crackVal * 0.70, t0 + 0.0003);
        snapEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.008);

        snapNoise.connect(hp);
        hp.connect(snapEnv);
        snapEnv.connect(masterFilter);
        snapNoise.start(t0);
        snapNoise.stop(t0 + 0.010);
      }
    }

    // 2. Muzzle blast concussivo do 7.62x39mm (Seco, rouco e presente: 240Hz -> 50Hz)
    const blastOsc = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blastOsc.type = 'triangle';
    blastOsc.frequency.setValueAtTime(barkFreq, t0);
    blastOsc.frequency.exponentialRampToValueAtTime(50, t0 + blastDur);

    blastGain.gain.setValueAtTime(0.0001, t0);
    blastGain.gain.exponentialRampToValueAtTime(1.35, t0 + 0.001);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur);

    blastOsc.connect(blastGain);
    blastGain.connect(masterFilter);
    blastOsc.start(t0);
    blastOsc.stop(t0 + blastDur + 0.02);

    // Subgrave seco e compacto (90Hz -> 35Hz em 80ms)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, t0);
    subOsc.frequency.exponentialRampToValueAtTime(35, t0 + blastDur * 0.95);

    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.exponentialRampToValueAtTime(0.80, t0 + 0.003);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur * 0.95);

    subOsc.connect(subGain);
    subGain.connect(masterFilter);
    subOsc.start(t0);
    subOsc.stop(t0 + blastDur + 0.02);

    // 3. Sopro rasgado de alta pressão no compensador de cano chanfrado (3.6kHz)
    if (this.noiseBuffers?.pink) {
      const gasNoise = this.noiseBuffers.createSource('pink', false);
      const gasFilter = ctx.createBiquadFilter();
      gasFilter.type = 'bandpass';
      gasFilter.frequency.setValueAtTime(3600, t0);
      gasFilter.Q.setValueAtTime(2.2, t0);

      const gasEnv = ctx.createGain();
      gasEnv.gain.setValueAtTime(0.0001, t0);
      gasEnv.gain.linearRampToValueAtTime(0.85, t0 + 0.0008);
      gasEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.032);

      gasNoise.connect(gasFilter);
      gasFilter.connect(gasEnv);
      gasEnv.connect(masterFilter);
      gasNoise.start(t0);
      gasNoise.stop(t0 + 0.035);
    }

    // 4. Mecânica do pistão de 500g e caixa de culatra de aço estampado (Seco e cortante)
    if (mechVal > 0.01 && this.noiseBuffers?.white) {
      // Recuo traseiro do conjunto ferrolho (t = 38ms)
      const tBack = t0 + 0.038;
      const mechBack = this.noiseBuffers.createSource('white', false);
      const bpBack = ctx.createBiquadFilter();
      bpBack.type = 'bandpass';
      bpBack.frequency.setValueAtTime(recFreq, tBack);
      bpBack.Q.setValueAtTime(3.0, tBack);

      const envBack = ctx.createGain();
      envBack.gain.setValueAtTime(0.0001, t0);
      envBack.gain.setValueAtTime(0.0001, tBack);
      envBack.gain.linearRampToValueAtTime(mechVal * 0.85, tBack + 0.0008);
      envBack.gain.exponentialRampToValueAtTime(0.0001, tBack + 0.025);

      mechBack.connect(bpBack);
      bpBack.connect(envBack);
      envBack.connect(masterFilter);
      mechBack.start(tBack);
      mechBack.stop(tBack + 0.028);

      // Trancamento rotativo na câmara (t = 82ms)
      const tLock = t0 + 0.082;
      const mechLock = this.noiseBuffers.createSource('white', false);
      const bpLock = ctx.createBiquadFilter();
      bpLock.type = 'bandpass';
      bpLock.frequency.setValueAtTime(recFreq * 1.45, tLock);
      bpLock.Q.setValueAtTime(3.8, tLock);

      const envLock = ctx.createGain();
      envLock.gain.setValueAtTime(0.0001, t0);
      envLock.gain.setValueAtTime(0.0001, tLock);
      envLock.gain.linearRampToValueAtTime(mechVal * 0.90, tLock + 0.0008);
      envLock.gain.exponentialRampToValueAtTime(0.0001, tLock + 0.028);

      mechLock.connect(bpLock);
      bpLock.connect(envLock);
      envLock.connect(masterFilter);
      mechLock.start(tLock);
      mechLock.stop(tLock + 0.032);
    }

    // 5. Cauda acústica curta e seca (sem eco distante de vale)
    if (echoVal > 0.01 && this.noiseBuffers?.brown) {
      const tailNoise = this.noiseBuffers.createSource('brown', false);
      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = 'lowpass';
      tailFilter.frequency.setValueAtTime(650, t0);
      tailFilter.frequency.exponentialRampToValueAtTime(120, t0 + 0.40);

      const tailEnv = ctx.createGain();
      tailEnv.gain.setValueAtTime(0.0001, t0);
      tailEnv.gain.linearRampToValueAtTime(echoVal * 0.35, t0 + 0.02);
      tailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);

      tailNoise.connect(tailFilter);
      tailFilter.connect(tailEnv);
      tailEnv.connect(masterFilter);
      tailNoise.start(t0 + 0.010);
      tailNoise.stop(t0 + 0.45);
    }
  }

  synthesizeAKSupressed(params, ctx, destination, startTime = null, humanize = false) {
    return this.synthesizeAKSuppressed(params, ctx, destination, startTime, humanize);
  }

  synthesizeAK47(params, ctx, destination, startTime = null, humanize = false) {
    return this.synthesizeAKSuppressed(params, ctx, destination, startTime, humanize);
  }

  /* ========================================================================
     3. PISTOLA 9mm (P-9)
     ======================================================================== */
  synthesizeGunshot9mm(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.06) : 1.0;

    const crackGain = getVal(params.muzzleCrack, 0.90);
    const punchFreq = getVal(params.powderPunch, 230) * j;
    const powderDur = (getVal(params.powderDecay, 55) / 1000) * j;
    const slideVal  = getVal(params.slideCycle, 0.45);
    const barrelRes = getVal(params.barrelResonance, 1100);
    const tailGain  = getVal(params.reverbTail, 0.50);
    const airDamp   = getVal(params.airDamping, 2400);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airDamp, t0);
    masterFilter.connect(destination);

    // 1. Muzzle Crack Seco (< 18ms)
    if (crackGain > 0.01 && this.noiseBuffers?.white) {
      const crackSrc = this.noiseBuffers.createSource('white', false);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200, t0);
      bp.Q.setValueAtTime(2.5, t0);

      const crackEnv = ctx.createGain();
      crackEnv.gain.setValueAtTime(0.0001, t0);
      crackEnv.gain.exponentialRampToValueAtTime(crackGain * 1.0, t0 + 0.0008);
      crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.018);

      crackSrc.connect(bp);
      bp.connect(crackEnv);
      crackEnv.connect(masterFilter);
      crackSrc.start(t0);
      crackSrc.stop(t0 + 0.025);
    }

    // 2. Soco Percussivo da Queima (230Hz -> 55Hz)
    const powderOsc = ctx.createOscillator();
    const powderGain = ctx.createGain();
    powderOsc.type = 'triangle';
    powderOsc.frequency.setValueAtTime(punchFreq, t0);
    powderOsc.frequency.exponentialRampToValueAtTime(Math.max(35, punchFreq * 0.25), t0 + powderDur);

    powderGain.gain.setValueAtTime(0.0001, t0);
    powderGain.gain.exponentialRampToValueAtTime(0.95, t0 + 0.002);
    powderGain.gain.exponentialRampToValueAtTime(0.0001, t0 + powderDur);

    const barrelFilter = ctx.createBiquadFilter();
    barrelFilter.type = 'peaking';
    barrelFilter.frequency.setValueAtTime(barrelRes, t0);
    barrelFilter.Q.setValueAtTime(3.5, t0);
    barrelFilter.gain.setValueAtTime(8, t0);

    powderOsc.connect(powderGain);
    powderGain.connect(barrelFilter);
    barrelFilter.connect(masterFilter);
    powderOsc.start(t0);
    powderOsc.stop(t0 + powderDur + 0.01);

    // 3. Ciclo Mecânico do Slide (t = 52ms)
    if (slideVal > 0.01) {
      const tSlide = t0 + 0.052;
      const slideOsc = ctx.createOscillator();
      const slideGain = ctx.createGain();
      slideOsc.type = 'sawtooth';
      slideOsc.frequency.setValueAtTime(950, tSlide);
      slideOsc.frequency.exponentialRampToValueAtTime(320, tSlide + 0.035);

      slideGain.gain.setValueAtTime(0.0001, t0);
      slideGain.gain.setValueAtTime(0.0001, tSlide);
      slideGain.gain.exponentialRampToValueAtTime(slideVal * 0.35, tSlide + 0.002);
      slideGain.gain.exponentialRampToValueAtTime(0.0001, tSlide + 0.04);

      slideOsc.connect(slideGain);
      slideGain.connect(masterFilter);
      slideOsc.start(tSlide);
      slideOsc.stop(tSlide + 0.05);
    }

    // 4. Cauda Balística Curta
    if (tailGain > 0.01 && this.noiseBuffers?.pink) {
      const tailSrc = this.noiseBuffers.createSource('pink', false);
      const tailLP = ctx.createBiquadFilter();
      tailLP.type = 'lowpass';
      tailLP.frequency.setValueAtTime(1200, t0);
      tailLP.frequency.exponentialRampToValueAtTime(200, t0 + 0.9);

      const tailEnv = ctx.createGain();
      tailEnv.gain.setValueAtTime(0.0001, t0);
      tailEnv.gain.exponentialRampToValueAtTime(tailGain * 0.45, t0 + 0.012);
      tailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);

      tailSrc.connect(tailLP);
      tailLP.connect(tailEnv);
      tailEnv.connect(masterFilter);
      tailSrc.start(t0);
      tailSrc.stop(t0 + 0.9);
    }
  }

  /* ========================================================================
     4. SUBMETRALHADORA 9mm UZI (OPEN-BOLT SMG)
     ======================================================================== */
  synthesizeUzi(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const crackGain    = getVal(params.snappyCrack, 0.92);
    const bodyFreq     = getVal(params.powderBodyFreq, 260) * j;
    const powderDur    = (getVal(params.powderDecay, 42) / 1000) * j;
    const boltSlam     = getVal(params.openBoltSlam, 0.78);
    const stampedMetal = getVal(params.stampedMetalRing, 1450);
    const tailGain     = getVal(params.tailAcoustics, 0.45);
    const airCut       = getVal(params.airDamping, 3400);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airCut, t0);
    masterFilter.connect(destination);

    // 1. Open-Bolt Slam (Colisão frontal do ferrolho telescópico)
    if (boltSlam > 0.01) {
      const slamOsc = ctx.createOscillator();
      const slamGain = ctx.createGain();
      slamOsc.type = 'square';
      slamOsc.frequency.setValueAtTime(1450, t0);
      slamOsc.frequency.exponentialRampToValueAtTime(320, t0 + 0.012);
      slamGain.gain.setValueAtTime(0.0001, t0);
      slamGain.gain.exponentialRampToValueAtTime(boltSlam * 0.7, t0 + 0.0005);
      slamGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);
      slamOsc.connect(slamGain);
      slamGain.connect(masterFilter);
      slamOsc.start(t0);
      slamOsc.stop(t0 + 0.016);
    }

    // 2. Muzzle Blast Seco & Ríspido (Cano 260mm)
    if (crackGain > 0.01 && this.noiseBuffers?.white) {
      const crackSrc = this.noiseBuffers.createSource('white', false);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3400, t0);
      bp.Q.setValueAtTime(3.0, t0);

      const crackEnv = ctx.createGain();
      crackEnv.gain.setValueAtTime(0.0001, t0);
      crackEnv.gain.exponentialRampToValueAtTime(crackGain * 1.05, t0 + 0.0005);
      crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.015);

      crackSrc.connect(bp);
      bp.connect(crackEnv);
      crackEnv.connect(masterFilter);
      crackSrc.start(t0);
      crackSrc.stop(t0 + 0.02);
    }

    // 3. Corpo Percussivo 9mm & Ressonância de Chapa Estampada
    const powderOsc = ctx.createOscillator();
    const powderGain = ctx.createGain();
    powderOsc.type = 'triangle';
    powderOsc.frequency.setValueAtTime(bodyFreq, t0);
    powderOsc.frequency.exponentialRampToValueAtTime(Math.max(35, bodyFreq * 0.24), t0 + powderDur);
    powderGain.gain.setValueAtTime(0.0001, t0);
    powderGain.gain.exponentialRampToValueAtTime(0.95, t0 + 0.002);
    powderGain.gain.exponentialRampToValueAtTime(0.0001, t0 + powderDur);

    const sheetMetalFilter = ctx.createBiquadFilter();
    sheetMetalFilter.type = 'peaking';
    sheetMetalFilter.frequency.setValueAtTime(stampedMetal, t0);
    sheetMetalFilter.Q.setValueAtTime(4.8, t0);
    sheetMetalFilter.gain.setValueAtTime(10, t0);

    powderOsc.connect(powderGain);
    powderGain.connect(sheetMetalFilter);
    sheetMetalFilter.connect(masterFilter);
    powderOsc.start(t0);
    powderOsc.stop(t0 + powderDur + 0.01);

    // 4. Cauda Urbana
    if (tailGain > 0.01 && this.noiseBuffers?.pink) {
      const tailSrc = this.noiseBuffers.createSource('pink', false);
      const tailLP = ctx.createBiquadFilter();
      tailLP.type = 'lowpass';
      tailLP.frequency.setValueAtTime(1800, t0);
      tailLP.frequency.exponentialRampToValueAtTime(180, t0 + 0.65);

      const tailEnv = ctx.createGain();
      tailEnv.gain.setValueAtTime(0.0001, t0);
      tailEnv.gain.exponentialRampToValueAtTime(tailGain * 0.5, t0 + 0.012);
      tailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);

      tailSrc.connect(tailLP);
      tailLP.connect(tailEnv);
      tailEnv.connect(masterFilter);
      tailSrc.start(t0);
      tailSrc.stop(t0 + 0.65);
    }
  }

  /* ========================================================================
     5. FUZIL SILENCIADO VSS VINTOREZ (9x39mm SUBSÔNICO)
     ======================================================================== */
  synthesizeVSS(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.04) : 1.0;

    const puffGain     = getVal(params.suppressorPuff, 0.88);
    const thumpFreq    = getVal(params.subsonicThumpFreq, 135) * j;
    const thumpDur     = (getVal(params.thumpDecay, 38) / 1000) * j;
    const hissGain     = getVal(params.gasJetHiss, 0.65);
    const actionVol    = getVal(params.internalActionVol, 0.82);
    const muffledCut   = getVal(params.muffledAirCut, 1600);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(muffledCut, t0);
    masterFilter.connect(destination);

    // 1. Sopro Abafado do Supressor de Defletores ('Pthwump')
    if (puffGain > 0.01 && this.noiseBuffers?.pink) {
      const puffSrc = this.noiseBuffers.createSource('pink', false);
      const puffBP = ctx.createBiquadFilter();
      puffBP.type = 'bandpass';
      puffBP.frequency.setValueAtTime(950, t0);
      puffBP.Q.setValueAtTime(2.2, t0);

      const puffEnv = ctx.createGain();
      puffEnv.gain.setValueAtTime(0.0001, t0);
      puffEnv.gain.exponentialRampToValueAtTime(puffGain * 0.95, t0 + 0.001);
      puffEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038);

      puffSrc.connect(puffBP);
      puffBP.connect(puffEnv);
      puffEnv.connect(masterFilter);
      puffSrc.start(t0);
      puffSrc.stop(t0 + 0.045);
    }

    // 2. Jato de Ar das Portas de Alívio
    if (hissGain > 0.01 && this.noiseBuffers?.white) {
      const hissSrc = this.noiseBuffers.createSource('white', false);
      const hissFilter = ctx.createBiquadFilter();
      hissFilter.type = 'bandpass';
      hissFilter.frequency.setValueAtTime(1900, t0);
      hissFilter.Q.setValueAtTime(3.5, t0);

      const hissEnv = ctx.createGain();
      hissEnv.gain.setValueAtTime(0.0001, t0);
      hissEnv.gain.exponentialRampToValueAtTime(hissGain * 0.45, t0 + 0.002);
      hissEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);

      hissSrc.connect(hissFilter);
      hissFilter.connect(hissEnv);
      hissEnv.connect(masterFilter);
      hissSrc.start(t0);
      hissSrc.stop(t0 + 0.035);
    }

    // 3. Soco Grave Abafado Contido
    const thumpOsc = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thumpOsc.type = 'triangle';
    thumpOsc.frequency.setValueAtTime(thumpFreq, t0);
    thumpOsc.frequency.exponentialRampToValueAtTime(Math.max(28, thumpFreq * 0.22), t0 + thumpDur);
    thumpGain.gain.setValueAtTime(0.0001, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.002);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + thumpDur);
    thumpOsc.connect(thumpGain);
    thumpGain.connect(masterFilter);
    thumpOsc.start(t0);
    thumpOsc.stop(t0 + thumpDur + 0.015);

    // 4. Mecânica Interna Nítida: Pistão e Ferrolho
    if (actionVol > 0.01) {
      const hammerOsc = ctx.createOscillator();
      const hammerGain = ctx.createGain();
      hammerOsc.type = 'square';
      hammerOsc.frequency.setValueAtTime(1600, t0);
      hammerGain.gain.setValueAtTime(0.0001, t0);
      hammerGain.gain.exponentialRampToValueAtTime(actionVol * 0.5, t0 + 0.0006);
      hammerGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.01);
      hammerOsc.connect(hammerGain);
      hammerGain.connect(masterFilter);
      hammerOsc.start(t0);
      hammerOsc.stop(t0 + 0.012);

      const tBolt = t0 + 0.032;
      const boltOsc = ctx.createOscillator();
      const boltGain = ctx.createGain();
      boltOsc.type = 'sawtooth';
      boltOsc.frequency.setValueAtTime(680, tBolt);
      boltOsc.frequency.exponentialRampToValueAtTime(220, tBolt + 0.025);
      boltGain.gain.setValueAtTime(0.0001, t0);
      boltGain.gain.setValueAtTime(0.0001, tBolt);
      boltGain.gain.exponentialRampToValueAtTime(actionVol * 0.45, tBolt + 0.002);
      boltGain.gain.exponentialRampToValueAtTime(0.0001, tBolt + 0.028);
      boltOsc.connect(boltGain);
      boltGain.connect(masterFilter);
      boltOsc.start(tBolt);
      boltOsc.stop(tBolt + 0.035);
    }
  }

  /* ========================================================================
     6. REVÓLVER S&W .500 MAGNUM (DISPARO SECO, ESTRIDENTE E METÁLICO)
     ======================================================================== */
  synthesizeSW500Magnum(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.04) : 1.0;

    const crackVal     = getVal(params.supersonicCrack, 1.00);
    const thumpFreq    = getVal(params.subBassThumpFreq, 180) * j;
    const blastDur     = (getVal(params.blastDecay, 90) / 1000) * j;
    const gapVal       = getVal(params.cylinderGapBlast, 0.95);
    const steelFreq    = getVal(params.xframeRingFreq, 1850);
    const tailVal      = getVal(params.dramaticTail, 0.25);
    const airCut       = getVal(params.airAbsorption, 9500);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airCut, t0);
    masterFilter.connect(destination);

    // 1. Martelo Pesado de Aço no Percussor (Impacto seco e imediato)
    if (this.noiseBuffers?.white) {
      const hSrc = this.noiseBuffers.createSource('white', false);
      const hFilt = ctx.createBiquadFilter();
      hFilt.type = 'highpass';
      hFilt.frequency.setValueAtTime(3800, t0);
      const hEnv = ctx.createGain();
      hEnv.gain.setValueAtTime(0.0001, t0);
      hEnv.gain.linearRampToValueAtTime(0.60, t0 + 0.0002);
      hEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.005);
      hSrc.connect(hFilt);
      hFilt.connect(hEnv);
      hEnv.connect(masterFilter);
      hSrc.start(t0);
      hSrc.stop(t0 + 0.007);
    }

    // 2. Chicote Supersônico .50 (Estridente e cortante)
    if (crackVal > 0.01) {
      const whipOsc = ctx.createOscillator();
      const whipGain = ctx.createGain();
      whipOsc.type = 'sawtooth';
      whipOsc.frequency.setValueAtTime(4800, t0);
      whipOsc.frequency.exponentialRampToValueAtTime(1400, t0 + 0.010);
      whipGain.gain.setValueAtTime(0.0001, t0);
      whipGain.gain.exponentialRampToValueAtTime(crackVal * 1.10, t0 + 0.0003);
      whipGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
      whipOsc.connect(whipGain);
      whipGain.connect(masterFilter);
      whipOsc.start(t0);
      whipOsc.stop(t0 + 0.015);

      if (this.noiseBuffers?.white) {
        const crackNoise = this.noiseBuffers.createSource('white', false);
        const bpCrack = ctx.createBiquadFilter();
        bpCrack.type = 'bandpass';
        bpCrack.frequency.setValueAtTime(6200, t0);
        bpCrack.Q.setValueAtTime(4.0, t0);

        const crackEnv = ctx.createGain();
        crackEnv.gain.setValueAtTime(0.0001, t0);
        crackEnv.gain.exponentialRampToValueAtTime(crackVal * 1.00, t0 + 0.0003);
        crackEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.010);

        crackNoise.connect(bpCrack);
        bpCrack.connect(crackEnv);
        crackEnv.connect(masterFilter);
        crackNoise.start(t0);
        crackNoise.stop(t0 + 0.012);
      }
    }

    // 3. Cylinder Gap Blast (Jato lateral violento de 60k PSI - Estridente e ensurdecedor)
    if (gapVal > 0.01 && this.noiseBuffers?.pink) {
      const gapSrc = this.noiseBuffers.createSource('pink', false);
      const gapFilter = ctx.createBiquadFilter();
      gapFilter.type = 'bandpass';
      gapFilter.frequency.setValueAtTime(4800, t0);
      gapFilter.Q.setValueAtTime(2.5, t0);
      const gapEnv = ctx.createGain();
      gapEnv.gain.setValueAtTime(0.0001, t0);
      gapEnv.gain.linearRampToValueAtTime(gapVal * 1.10, t0 + 0.0005);
      gapEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.028);
      gapSrc.connect(gapFilter);
      gapFilter.connect(gapEnv);
      gapEnv.connect(masterFilter);
      gapSrc.start(t0);
      gapSrc.stop(t0 + 0.032);

      // Mordida extra de alta pressão
      if (this.noiseBuffers?.white) {
        const gapSnap = this.noiseBuffers.createSource('white', false);
        const hpGap = ctx.createBiquadFilter();
        hpGap.type = 'highpass';
        hpGap.frequency.setValueAtTime(3200, t0);

        const gapSnapEnv = ctx.createGain();
        gapSnapEnv.gain.setValueAtTime(0.0001, t0);
        gapSnapEnv.gain.linearRampToValueAtTime(gapVal * 0.65, t0 + 0.0004);
        gapSnapEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.015);

        gapSnap.connect(hpGap);
        hpGap.connect(gapSnapEnv);
        gapSnapEnv.connect(masterFilter);
        gapSnap.start(t0);
        gapSnap.stop(t0 + 0.018);
      }
    }

    // 4. Soco de Pólvora Seco e Encorpado (180Hz -> 48Hz em 90ms)
    const blastOsc = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blastOsc.type = 'triangle';
    blastOsc.frequency.setValueAtTime(thumpFreq, t0);
    blastOsc.frequency.exponentialRampToValueAtTime(48, t0 + blastDur);
    blastGain.gain.setValueAtTime(0.0001, t0);
    blastGain.gain.exponentialRampToValueAtTime(1.40, t0 + 0.001);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur);
    blastOsc.connect(blastGain);
    blastGain.connect(masterFilter);
    blastOsc.start(t0);
    blastOsc.stop(t0 + blastDur + 0.02);

    // Subgrave seco de pressão de ar (85Hz -> 32Hz em 85ms)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(85, t0);
    subOsc.frequency.exponentialRampToValueAtTime(32, t0 + blastDur * 0.95);
    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.exponentialRampToValueAtTime(0.85, t0 + 0.003);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur * 0.95);
    subOsc.connect(subGain);
    subGain.connect(masterFilter);
    subOsc.start(t0);
    subOsc.stop(t0 + blastDur + 0.02);

    // 5. Vibração Metálica Estrutural da Armação X-Frame (Aço forjado em 1850Hz)
    if (this.noiseBuffers?.white) {
      const steelSrc = this.noiseBuffers.createSource('white', false);
      const bpSteel = ctx.createBiquadFilter();
      bpSteel.type = 'bandpass';
      bpSteel.frequency.setValueAtTime(steelFreq, t0);
      bpSteel.Q.setValueAtTime(4.5, t0);
      const steelEnv = ctx.createGain();
      steelEnv.gain.setValueAtTime(0.0001, t0);
      steelEnv.gain.linearRampToValueAtTime(0.55, t0 + 0.0004);
      steelEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
      steelSrc.connect(bpSteel);
      bpSteel.connect(steelEnv);
      steelEnv.connect(masterFilter);
      steelSrc.start(t0);
      steelSrc.stop(t0 + 0.028);
    }

    // 6. Cauda Curta e Seca (sem eco distante / sem bumbo mole)
    if (tailVal > 0.01 && this.noiseBuffers?.brown) {
      const tailSrc = this.noiseBuffers.createSource('brown', false);
      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = 'lowpass';
      tailFilter.frequency.setValueAtTime(500, t0);
      tailFilter.frequency.exponentialRampToValueAtTime(100, t0 + 0.35);
      const tailEnv = ctx.createGain();
      tailEnv.gain.setValueAtTime(0.0001, t0);
      tailEnv.gain.linearRampToValueAtTime(tailVal * 0.30, t0 + 0.02);
      tailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
      tailSrc.connect(tailFilter);
      tailFilter.connect(tailEnv);
      tailEnv.connect(masterFilter);
      tailSrc.start(t0 + 0.01);
      tailSrc.stop(t0 + 0.40);
    }
  }

  /* ========================================================================
     7. DISPARO DE ESPINGARDA CALIBRE 12 (WINCHESTER MODEL 1912)
     ======================================================================== */
  synthesizeShotgunBlast12G(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.04) : 1.0;

    const uncorkVal = getVal(params.muzzleUncork, 0.95);
    const thumpFreq = getVal(params.boreThumpFreq, 165) * j;
    const blastDur  = (getVal(params.blastDecay, 190) / 1000) * j;
    const vibVal    = getVal(params.barrelVibration, 0.70);
    const barFreq   = getVal(params.barrelResFreq, 920);
    const tailVal   = getVal(params.dramaticTail, 0.85);
    const airCut    = getVal(params.airAbsorption, 2400);

    const masterFilter = ctx.createBiquadFilter();
    masterFilter.type = 'lowpass';
    masterFilter.frequency.setValueAtTime(airCut, t0);
    masterFilter.connect(destination);

    // 1. Desrolhamento Violento & Ruptura da Bucha Plástica (18.5mm Uncork)
    if (uncorkVal > 0.01 && this.noiseBuffers?.pink) {
      const uncorkSrc = this.noiseBuffers.createSource('pink', false);
      const uncorkFilter = ctx.createBiquadFilter();
      uncorkFilter.type = 'bandpass';
      uncorkFilter.frequency.setValueAtTime(2100, t0);
      uncorkFilter.Q.setValueAtTime(1.8, t0);

      const uncorkEnv = ctx.createGain();
      uncorkEnv.gain.setValueAtTime(0.0001, t0);
      uncorkEnv.gain.linearRampToValueAtTime(uncorkVal * 1.0, t0 + 0.0006);
      uncorkEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.038);

      uncorkSrc.connect(uncorkFilter);
      uncorkFilter.connect(uncorkEnv);
      uncorkEnv.connect(masterFilter);
      uncorkSrc.start(t0);
      uncorkSrc.stop(t0 + 0.045);
    }

    // 2. Soco Oco Concussivo de Alma Lisa (165Hz -> 36Hz)
    const blastOsc = ctx.createOscillator();
    const blastGain = ctx.createGain();
    blastOsc.type = 'triangle';
    blastOsc.frequency.setValueAtTime(thumpFreq, t0);
    blastOsc.frequency.exponentialRampToValueAtTime(36, t0 + blastDur);
    blastGain.gain.setValueAtTime(0.0001, t0);
    blastGain.gain.exponentialRampToValueAtTime(1.20, t0 + 0.0015);
    blastGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur);
    blastOsc.connect(blastGain);
    blastGain.connect(masterFilter);
    blastOsc.start(t0);
    blastOsc.stop(t0 + blastDur + 0.03);

    // 3. Subgrave de Alma Lisa (65Hz -> 25Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65, t0);
    subOsc.frequency.exponentialRampToValueAtTime(25, t0 + blastDur * 1.05);
    subGain.gain.setValueAtTime(0.0001, t0);
    subGain.gain.exponentialRampToValueAtTime(0.95, t0 + 0.005);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t0 + blastDur * 1.05);
    subOsc.connect(subGain);
    subGain.connect(masterFilter);
    subOsc.start(t0);
    subOsc.stop(t0 + blastDur * 1.1);

    // 4. Vibração Inarmônica do Cano
    if (vibVal > 0.01 && this.noiseBuffers?.white) {
      const steelSrc = this.noiseBuffers.createSource('white', false);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(barFreq, t0);
      bp.Q.setValueAtTime(3.2, t0);
      const steelEnv = ctx.createGain();
      steelEnv.gain.setValueAtTime(0.0001, t0);
      steelEnv.gain.linearRampToValueAtTime(vibVal * 0.40, t0 + 0.0005);
      steelEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.030);
      steelSrc.connect(bp);
      bp.connect(steelEnv);
      steelEnv.connect(masterFilter);
      steelSrc.start(t0);
      steelSrc.stop(t0 + 0.035);
    }

    // 5. Cauda Aberta (> 2.3s)
    if (tailVal > 0.01 && this.noiseBuffers?.brown) {
      const tailSrc = this.noiseBuffers.createSource('brown', false);
      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = 'lowpass';
      tailFilter.frequency.setValueAtTime(420, t0);
      tailFilter.frequency.exponentialRampToValueAtTime(80, t0 + 2.0);
      const tailEnv = ctx.createGain();
      tailEnv.gain.setValueAtTime(0.0001, t0);
      tailEnv.gain.linearRampToValueAtTime(tailVal * 0.80, t0 + 0.04);
      tailEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.3);
      tailSrc.connect(tailFilter);
      tailFilter.connect(tailEnv);
      tailEnv.connect(masterFilter);
      tailSrc.start(t0 + 0.015);
      tailSrc.stop(t0 + 2.4);
    }
  }

  /* ========================================================================
     8. MECÂNICA DE PISTOLA — PUXAR SLIDE PARA TRÁS (RACK BACK)
     ======================================================================== */
  synthesizeSlidePull(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const unlockVal     = getVal(params.unlockClick, 0.70);
    const frictionVal   = getVal(params.railFriction, 0.60);
    const springFreq    = getVal(params.springTension, 1150) * j;
    const rearStopVal   = getVal(params.rearStopClack, 0.88);
    const hammerVal     = getVal(params.hammerCock, 0.72);
    const metalRingFreq = getVal(params.metalRing, 1850);

    // Destrave inicial
    if (unlockVal > 0.01) {
      const unlockOsc = ctx.createOscillator();
      const unlockGain = ctx.createGain();
      unlockOsc.type = 'square';
      unlockOsc.frequency.setValueAtTime(2200, t0);
      unlockOsc.frequency.exponentialRampToValueAtTime(650, t0 + 0.012);
      unlockGain.gain.setValueAtTime(0.0001, t0);
      unlockGain.gain.exponentialRampToValueAtTime(unlockVal * 0.55, t0 + 0.0008);
      unlockGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);
      unlockOsc.connect(unlockGain);
      unlockGain.connect(destination);
      unlockOsc.start(t0);
      unlockOsc.stop(t0 + 0.018);
    }

    // Fricção dos trilhos
    if (frictionVal > 0.01 && this.noiseBuffers?.pink) {
      const scrapeSrc = this.noiseBuffers.createSource('pink', false);
      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'peaking';
      scrapeFilter.frequency.setValueAtTime(springFreq, t0);
      scrapeFilter.Q.setValueAtTime(3.8, t0);
      scrapeFilter.gain.setValueAtTime(10, t0);

      const scrapeEnv = ctx.createGain();
      scrapeEnv.gain.setValueAtTime(0.0001, t0);
      scrapeEnv.gain.setValueAtTime(0.0001, t0 + 0.018);
      scrapeEnv.gain.linearRampToValueAtTime(frictionVal * 0.45, t0 + 0.06);
      scrapeEnv.gain.linearRampToValueAtTime(frictionVal * 0.38, t0 + 0.14);
      scrapeEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.175);

      scrapeSrc.connect(scrapeFilter);
      scrapeFilter.connect(scrapeEnv);
      scrapeEnv.connect(destination);
      scrapeSrc.start(t0 + 0.015);
      scrapeSrc.stop(t0 + 0.185);
    }

    // Batente traseiro
    if (rearStopVal > 0.01) {
      const tStop = t0 + 0.15;
      const stopOsc = ctx.createOscillator();
      const stopGain = ctx.createGain();
      stopOsc.type = 'triangle';
      stopOsc.frequency.setValueAtTime(1350, tStop);
      stopOsc.frequency.exponentialRampToValueAtTime(380, tStop + 0.025);
      stopGain.gain.setValueAtTime(0.0001, t0);
      stopGain.gain.setValueAtTime(0.0001, tStop);
      stopGain.gain.exponentialRampToValueAtTime(rearStopVal * 0.75, tStop + 0.001);
      stopGain.gain.exponentialRampToValueAtTime(0.0001, tStop + 0.035);

      const ringFilter = ctx.createBiquadFilter();
      ringFilter.type = 'peaking';
      ringFilter.frequency.setValueAtTime(metalRingFreq, tStop);
      ringFilter.Q.setValueAtTime(5.0, tStop);
      ringFilter.gain.setValueAtTime(12, tStop);

      stopOsc.connect(ringFilter);
      ringFilter.connect(stopGain);
      stopGain.connect(destination);
      stopOsc.start(tStop);
      stopOsc.stop(tStop + 0.04);

      if (hammerVal > 0.01) {
        const tHammer = t0 + 0.172;
        const hammerOsc = ctx.createOscillator();
        const hammerGain = ctx.createGain();
        hammerOsc.type = 'square';
        hammerOsc.frequency.setValueAtTime(2400, tHammer);
        hammerOsc.frequency.exponentialRampToValueAtTime(800, tHammer + 0.01);
        hammerGain.gain.setValueAtTime(0.0001, t0);
        hammerGain.gain.setValueAtTime(0.0001, tHammer);
        hammerGain.gain.exponentialRampToValueAtTime(hammerVal * 0.45, tHammer + 0.0008);
        hammerGain.gain.exponentialRampToValueAtTime(0.0001, tHammer + 0.015);
        hammerOsc.connect(hammerGain);
        hammerGain.connect(destination);
        hammerOsc.start(tHammer);
        hammerOsc.stop(tHammer + 0.02);
      }
    }
  }

  /* ========================================================================
     9. MECÂNICA DE PISTOLA — RETORNO DO SLIDE (BATTERY SLAM)
     ======================================================================== */
  synthesizeSlideRelease(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const releaseVal  = getVal(params.releaseCatch, 0.75);
    const rushVal     = getVal(params.forwardRush, 0.50);
    const slamVal     = getVal(params.batterySlam, 0.98);
    const snapVal     = getVal(params.extractorSnap, 0.78);
    const chamberFreq = getVal(params.chamberRingFreq, 620) * j;
    const clatterFreq = getVal(params.highMetallicClatter, 2100);

    // Retém desarmando
    if (releaseVal > 0.01) {
      const catchOsc = ctx.createOscillator();
      const catchGain = ctx.createGain();
      catchOsc.type = 'square';
      catchOsc.frequency.setValueAtTime(2500, t0);
      catchOsc.frequency.exponentialRampToValueAtTime(800, t0 + 0.008);
      catchGain.gain.setValueAtTime(0.0001, t0);
      catchGain.gain.exponentialRampToValueAtTime(releaseVal * 0.6, t0 + 0.0005);
      catchGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
      catchOsc.connect(catchGain);
      catchGain.connect(destination);
      catchOsc.start(t0);
      catchOsc.stop(t0 + 0.015);
    }

    // Arraste acelerado
    if (rushVal > 0.01 && this.noiseBuffers?.white) {
      const rushSrc = this.noiseBuffers.createSource('white', false);
      const rushFilter = ctx.createBiquadFilter();
      rushFilter.type = 'bandpass';
      rushFilter.frequency.setValueAtTime(1400, t0);
      rushFilter.frequency.exponentialRampToValueAtTime(2800, t0 + 0.04);
      rushFilter.Q.setValueAtTime(2.0, t0);

      const rushEnv = ctx.createGain();
      rushEnv.gain.setValueAtTime(0.0001, t0);
      rushEnv.gain.linearRampToValueAtTime(rushVal * 0.35, t0 + 0.025);
      rushEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

      rushSrc.connect(rushFilter);
      rushFilter.connect(rushEnv);
      rushEnv.connect(destination);
      rushSrc.start(t0 + 0.004);
      rushSrc.stop(t0 + 0.048);
    }

    // Batida frontal na câmara (Battery Slam)
    if (slamVal > 0.01) {
      const tSlam = t0 + 0.042;
      const slamOsc = ctx.createOscillator();
      const slamGain = ctx.createGain();
      slamOsc.type = 'triangle';
      slamOsc.frequency.setValueAtTime(chamberFreq * 1.8, tSlam);
      slamOsc.frequency.exponentialRampToValueAtTime(chamberFreq * 0.25, tSlam + 0.035);

      slamGain.gain.setValueAtTime(0.0001, t0);
      slamGain.gain.setValueAtTime(0.0001, tSlam);
      slamGain.gain.exponentialRampToValueAtTime(slamVal * 1.0, tSlam + 0.001);
      slamGain.gain.exponentialRampToValueAtTime(0.0001, tSlam + 0.04);

      const chamberFilter = ctx.createBiquadFilter();
      chamberFilter.type = 'peaking';
      chamberFilter.frequency.setValueAtTime(chamberFreq, tSlam);
      chamberFilter.Q.setValueAtTime(4.5, tSlam);
      chamberFilter.gain.setValueAtTime(14, tSlam);

      slamOsc.connect(chamberFilter);
      chamberFilter.connect(slamGain);
      slamGain.connect(destination);
      slamOsc.start(tSlam);
      slamOsc.stop(tSlam + 0.045);

      if (snapVal > 0.01) {
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'square';
        snapOsc.frequency.setValueAtTime(clatterFreq * 1.4, tSlam + 0.002);
        snapOsc.frequency.exponentialRampToValueAtTime(700, tSlam + 0.014);
        snapGain.gain.setValueAtTime(0.0001, t0);
        snapGain.gain.setValueAtTime(0.0001, tSlam + 0.002);
        snapGain.gain.exponentialRampToValueAtTime(snapVal * 0.65, tSlam + 0.003);
        snapGain.gain.exponentialRampToValueAtTime(0.0001, tSlam + 0.018);
        snapOsc.connect(snapGain);
        snapGain.connect(destination);
        snapOsc.start(tSlam + 0.002);
        snapOsc.stop(tSlam + 0.022);
      }
    }
  }

  /* ========================================================================
     10. ESPINGARDA 12 — PUMP PARA TRÁS ('TCHLICK' / RACK OPEN)
     ======================================================================== */
  synthesizeShotgunPumpBack(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const tchSnapVal   = getVal(params.tchSnap, 0.85);
    const scrapeVal    = getVal(params.scrapeBite, 0.75);
    const scrapeFreq   = getVal(params.scrapeFreq, 3200) * j;
    const lickStopVal  = getVal(params.lickStop, 0.95);
    const searClickVal = getVal(params.searClick, 0.80);
    const ringFreq     = getVal(params.tubeChamberRing, 1450);

    // Parte 1: 'Tch'
    if (tchSnapVal > 0.01) {
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'square';
      snapOsc.frequency.setValueAtTime(2800 * j, t0);
      snapOsc.frequency.exponentialRampToValueAtTime(750, t0 + 0.012);
      snapGain.gain.setValueAtTime(0.0001, t0);
      snapGain.gain.exponentialRampToValueAtTime(tchSnapVal * 0.65, t0 + 0.0006);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.015);
      snapOsc.connect(snapGain);
      snapGain.connect(destination);
      snapOsc.start(t0);
      snapOsc.stop(t0 + 0.018);
    }

    if (scrapeVal > 0.01 && this.noiseBuffers?.pink) {
      const scrapeSrc = this.noiseBuffers.createSource('pink', false);
      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'bandpass';
      scrapeFilter.frequency.setValueAtTime(scrapeFreq, t0);
      scrapeFilter.frequency.exponentialRampToValueAtTime(scrapeFreq * 0.7, t0 + 0.028);
      scrapeFilter.Q.setValueAtTime(2.6, t0);

      const scrapeEnv = ctx.createGain();
      scrapeEnv.gain.setValueAtTime(0.0001, t0);
      scrapeEnv.gain.linearRampToValueAtTime(scrapeVal * 0.55, t0 + 0.004);
      scrapeEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.030);

      scrapeSrc.connect(scrapeFilter);
      scrapeFilter.connect(scrapeEnv);
      scrapeEnv.connect(destination);
      scrapeSrc.start(t0);
      scrapeSrc.stop(t0 + 0.035);
    }

    // Parte 2: '-Lick' (t = 40ms)
    const tLick = t0 + 0.040;
    if (lickStopVal > 0.01) {
      const stopOsc = ctx.createOscillator();
      const stopGain = ctx.createGain();
      stopOsc.type = 'triangle';
      stopOsc.frequency.setValueAtTime(1900, tLick);
      stopOsc.frequency.exponentialRampToValueAtTime(450, tLick + 0.022);
      stopGain.gain.setValueAtTime(0.0001, t0);
      stopGain.gain.setValueAtTime(0.0001, tLick);
      stopGain.gain.exponentialRampToValueAtTime(lickStopVal * 0.85, tLick + 0.0008);
      stopGain.gain.exponentialRampToValueAtTime(0.0001, tLick + 0.045);

      const ringFilter = ctx.createBiquadFilter();
      ringFilter.type = 'peaking';
      ringFilter.frequency.setValueAtTime(ringFreq, tLick);
      ringFilter.Q.setValueAtTime(4.5, tLick);
      ringFilter.gain.setValueAtTime(12, tLick);

      stopOsc.connect(ringFilter);
      ringFilter.connect(stopGain);
      stopGain.connect(destination);
      stopOsc.start(tLick);
      stopOsc.stop(tLick + 0.050);
    }

    if (searClickVal > 0.01) {
      const tSear = tLick + 0.006;
      const searOsc = ctx.createOscillator();
      const searGain = ctx.createGain();
      searOsc.type = 'square';
      searOsc.frequency.setValueAtTime(3100, tSear);
      searOsc.frequency.exponentialRampToValueAtTime(1200, tSear + 0.010);
      searGain.gain.setValueAtTime(0.0001, t0);
      searGain.gain.setValueAtTime(0.0001, tSear);
      searGain.gain.exponentialRampToValueAtTime(searClickVal * 0.65, tSear + 0.0006);
      searGain.gain.exponentialRampToValueAtTime(0.0001, tSear + 0.018);
      searOsc.connect(searGain);
      searGain.connect(destination);
      searOsc.start(tSear);
      searOsc.stop(tSear + 0.022);
    }
  }

  /* ========================================================================
     11. ESPINGARDA 12 — PUMP PARA FRENTE ('TCHLEEK' / CHAMBER LOCK)
     ======================================================================== */
  synthesizeShotgunPumpForward(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const rushVal     = getVal(params.forwardRush, 0.75);
    const sweepFreq   = getVal(params.rushSweepFreq, 2800) * j;
    const slamVal     = getVal(params.breachSlam, 0.95);
    const lockSnapVal = getVal(params.lockingSnap, 0.90);
    const ringFreq    = getVal(params.brightRingFreq, 3400);
    const barrelFreq  = getVal(params.barrelResonance, 1850);

    // 'Tch'
    if (rushVal > 0.01 && this.noiseBuffers?.white) {
      const rushSrc = this.noiseBuffers.createSource('white', false);
      const rushFilter = ctx.createBiquadFilter();
      rushFilter.type = 'bandpass';
      rushFilter.frequency.setValueAtTime(1200, t0);
      rushFilter.frequency.exponentialRampToValueAtTime(sweepFreq, t0 + 0.030);
      rushFilter.Q.setValueAtTime(2.2, t0);

      const rushEnv = ctx.createGain();
      rushEnv.gain.setValueAtTime(0.0001, t0);
      rushEnv.gain.linearRampToValueAtTime(rushVal * 0.50, t0 + 0.008);
      rushEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.034);

      rushSrc.connect(rushFilter);
      rushFilter.connect(rushEnv);
      rushEnv.connect(destination);
      rushSrc.start(t0);
      rushSrc.stop(t0 + 0.038);
    }

    // '-Leek' (t = 36ms)
    const tLeek = t0 + 0.036;
    if (slamVal > 0.01) {
      const slamOsc = ctx.createOscillator();
      const slamGain = ctx.createGain();
      slamOsc.type = 'triangle';
      slamOsc.frequency.setValueAtTime(2400, tLeek);
      slamOsc.frequency.exponentialRampToValueAtTime(520, tLeek + 0.024);
      slamGain.gain.setValueAtTime(0.0001, t0);
      slamGain.gain.setValueAtTime(0.0001, tLeek);
      slamGain.gain.exponentialRampToValueAtTime(slamVal * 0.90, tLeek + 0.0008);
      slamGain.gain.exponentialRampToValueAtTime(0.0001, tLeek + 0.050);

      const barrelFilter = ctx.createBiquadFilter();
      barrelFilter.type = 'peaking';
      barrelFilter.frequency.setValueAtTime(barrelFreq, tLeek);
      barrelFilter.Q.setValueAtTime(4.2, tLeek);
      barrelFilter.gain.setValueAtTime(11, tLeek);

      slamOsc.connect(barrelFilter);
      barrelFilter.connect(slamGain);
      slamGain.connect(destination);
      slamOsc.start(tLeek);
      slamOsc.stop(tLeek + 0.055);
    }

    if (lockSnapVal > 0.01) {
      const tWedge = tLeek + 0.006;
      const wedgeOsc = ctx.createOscillator();
      const wedgeGain = ctx.createGain();
      wedgeOsc.type = 'square';
      wedgeOsc.frequency.setValueAtTime(3600, tWedge);
      wedgeOsc.frequency.exponentialRampToValueAtTime(1600, tWedge + 0.014);

      wedgeGain.gain.setValueAtTime(0.0001, t0);
      wedgeGain.gain.setValueAtTime(0.0001, tWedge);
      wedgeGain.gain.exponentialRampToValueAtTime(lockSnapVal * 0.80, tWedge + 0.0006);
      wedgeGain.gain.exponentialRampToValueAtTime(0.0001, tWedge + 0.026);

      const brightFilter = ctx.createBiquadFilter();
      brightFilter.type = 'peaking';
      brightFilter.frequency.setValueAtTime(ringFreq, tWedge);
      brightFilter.Q.setValueAtTime(7.5, tWedge);
      brightFilter.gain.setValueAtTime(14, tWedge);

      wedgeOsc.connect(brightFilter);
      brightFilter.connect(wedgeGain);
      wedgeGain.connect(destination);
      wedgeOsc.start(tWedge);
      wedgeOsc.stop(tWedge + 0.030);
    }
  }

  /* ========================================================================
     12. ESPINGARDA 12 — INSERIR CARTUCHO NO TUBO (SHELL LOAD CALIBRADO)
     ======================================================================== */
  synthesizeShotgunLoadShell(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const gateVal    = getVal(params.gatePush, 0.70);
    const springVal  = getVal(params.springScrape, 0.75);
    const scrapeFreq = getVal(params.springScrapeFreq, 2300) * j; // 2300Hz da imagem
    const snapVal    = getVal(params.latchSnap, 0.42);            // 0.42 da imagem
    const rimFreq    = getVal(params.brassRimRing, 2450);
    const cavityFreq = getVal(params.tubeCavityFreq, 420);

    // 1. Porta de alimentação
    if (gateVal > 0.01) {
      const gateOsc = ctx.createOscillator();
      const gateGain = ctx.createGain();
      gateOsc.type = 'square';
      gateOsc.frequency.setValueAtTime(1800, t0);
      gateOsc.frequency.exponentialRampToValueAtTime(650, t0 + 0.012);
      gateGain.gain.setValueAtTime(0.0001, t0);
      gateGain.gain.exponentialRampToValueAtTime(gateVal * 0.45, t0 + 0.0006);
      gateGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.016);
      gateOsc.connect(gateGain);
      gateGain.connect(destination);
      gateOsc.start(t0);
      gateOsc.stop(t0 + 0.020);
    }

    // 2. Fricção na mola (2300 Hz)
    if (springVal > 0.01 && (this.noiseBuffers?.pink || this.noiseBuffers?.white)) {
      const tSpring = t0 + 0.025;
      const durSpring = 0.063;
      const scrapeSrc = (this.noiseBuffers.pink || this.noiseBuffers.white).createSource
        ? (this.noiseBuffers.pink || this.noiseBuffers.white).createSource()
        : this.noiseBuffers.createSource('pink', false);

      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'bandpass';
      scrapeFilter.frequency.setValueAtTime(scrapeFreq, tSpring);
      scrapeFilter.Q.setValueAtTime(2.8, tSpring);

      const coilFilter = ctx.createBiquadFilter();
      coilFilter.type = 'peaking';
      coilFilter.frequency.setValueAtTime(1850, tSpring);
      coilFilter.Q.setValueAtTime(4.0, tSpring);
      coilFilter.gain.setValueAtTime(10, tSpring);

      const scrapeEnv = ctx.createGain();
      scrapeEnv.gain.setValueAtTime(0.0001, t0);
      scrapeEnv.gain.setValueAtTime(0.0001, tSpring);
      scrapeEnv.gain.linearRampToValueAtTime(springVal * 0.55, tSpring + 0.022);
      scrapeEnv.gain.exponentialRampToValueAtTime(0.0001, tSpring + durSpring);

      scrapeSrc.connect(scrapeFilter);
      scrapeFilter.connect(coilFilter);
      coilFilter.connect(scrapeEnv);
      scrapeEnv.connect(destination);
      scrapeSrc.start(tSpring);
      scrapeSrc.stop(tSpring + durSpring + 0.01);
    }

    // 3. Estalo do Retém (Shell Stop: 0.42) & Culote (2450Hz)
    if (snapVal > 0.01) {
      const tSnap = t0 + 0.090;

      const latchOsc = ctx.createOscillator();
      const latchGain = ctx.createGain();
      latchOsc.type = 'square';
      latchOsc.frequency.setValueAtTime(3200, tSnap);
      latchOsc.frequency.exponentialRampToValueAtTime(950, tSnap + 0.012);
      latchGain.gain.setValueAtTime(0.0001, t0);
      latchGain.gain.setValueAtTime(0.0001, tSnap);
      latchGain.gain.exponentialRampToValueAtTime(snapVal * 0.85, tSnap + 0.0006);
      latchGain.gain.exponentialRampToValueAtTime(0.0001, tSnap + 0.024);
      latchOsc.connect(latchGain);
      latchGain.connect(destination);
      latchOsc.start(tSnap);
      latchOsc.stop(tSnap + 0.028);

      const rimOsc = ctx.createOscillator();
      const rimGain = ctx.createGain();
      rimOsc.type = 'triangle';
      rimOsc.frequency.setValueAtTime(rimFreq, tSnap);

      const rimFilter = ctx.createBiquadFilter();
      rimFilter.type = 'peaking';
      rimFilter.frequency.setValueAtTime(rimFreq, tSnap);
      rimFilter.Q.setValueAtTime(6.5, tSnap);
      rimFilter.gain.setValueAtTime(14, tSnap);

      rimGain.gain.setValueAtTime(0.0001, t0);
      rimGain.gain.setValueAtTime(0.0001, tSnap);
      rimGain.gain.exponentialRampToValueAtTime(snapVal * 0.65, tSnap + 0.0008);
      rimGain.gain.exponentialRampToValueAtTime(0.0001, tSnap + 0.045);

      rimOsc.connect(rimFilter);
      rimFilter.connect(rimGain);
      rimGain.connect(destination);
      rimOsc.start(tSnap);
      rimOsc.stop(tSnap + 0.050);

      const thumpOsc = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thumpOsc.type = 'triangle';
      thumpOsc.frequency.setValueAtTime(cavityFreq, tSnap);
      thumpOsc.frequency.exponentialRampToValueAtTime(160, tSnap + 0.035);
      thumpGain.gain.setValueAtTime(0.0001, t0);
      thumpGain.gain.setValueAtTime(0.0001, tSnap);
      thumpGain.gain.exponentialRampToValueAtTime(snapVal * 0.60, tSnap + 0.001);
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, tSnap + 0.040);
      thumpOsc.connect(thumpGain);
      thumpGain.connect(destination);
      thumpOsc.start(tSnap);
      thumpOsc.stop(tSnap + 0.045);
    }
  }

  /* ========================================================================
     13. CARREGADOR STANAG 5.56 — INSERÇÃO (M4, HK416, SCAR-H)
     ======================================================================== */
  synthesizeMagStanagInsert(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const frictionVal = getVal(params.magwellFriction, 0.65);
    const slapVal     = getVal(params.seatSlap, 0.85);
    const clickVal    = getVal(params.catchClick, 0.95);
    const ringFreq    = getVal(params.receiverRingFreq, 2100) * j;
    const thudFreq    = getVal(params.bodyThudFreq, 380);

    if (frictionVal > 0.01 && (this.noiseBuffers?.pink || this.noiseBuffers?.white)) {
      const fSrc = this.noiseBuffers.createSource('pink', false);
      const fFilter = ctx.createBiquadFilter();
      fFilter.type = 'bandpass';
      fFilter.frequency.setValueAtTime(1500, t0);
      fFilter.frequency.exponentialRampToValueAtTime(2400, t0 + 0.032);
      fFilter.Q.setValueAtTime(2.2, t0);

      const fEnv = ctx.createGain();
      fEnv.gain.setValueAtTime(0.0001, t0);
      fEnv.gain.linearRampToValueAtTime(frictionVal * 0.45, t0 + 0.008);
      fEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);

      fSrc.connect(fFilter);
      fFilter.connect(fEnv);
      fEnv.connect(destination);
      fSrc.start(t0);
      fSrc.stop(t0 + 0.040);
    }

    const tSlap = t0 + 0.035;
    if (slapVal > 0.01) {
      const slapOsc = ctx.createOscillator();
      const slapGain = ctx.createGain();
      slapOsc.type = 'triangle';
      slapOsc.frequency.setValueAtTime(thudFreq, tSlap);
      slapOsc.frequency.exponentialRampToValueAtTime(110, tSlap + 0.025);
      slapGain.gain.setValueAtTime(0.0001, t0);
      slapGain.gain.setValueAtTime(0.0001, tSlap);
      slapGain.gain.exponentialRampToValueAtTime(slapVal * 0.85, tSlap + 0.0008);
      slapGain.gain.exponentialRampToValueAtTime(0.0001, tSlap + 0.035);
      slapOsc.connect(slapGain);
      slapGain.connect(destination);
      slapOsc.start(tSlap);
      slapOsc.stop(tSlap + 0.040);
    }

    const tClick = t0 + 0.042;
    if (clickVal > 0.01) {
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(2600, tClick);
      clickOsc.frequency.exponentialRampToValueAtTime(850, tClick + 0.012);
      clickGain.gain.setValueAtTime(0.0001, t0);
      clickGain.gain.setValueAtTime(0.0001, tClick);
      clickGain.gain.exponentialRampToValueAtTime(clickVal * 0.90, tClick + 0.0006);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, tClick + 0.020);

      const ringFilter = ctx.createBiquadFilter();
      ringFilter.type = 'peaking';
      ringFilter.frequency.setValueAtTime(ringFreq, tClick);
      ringFilter.Q.setValueAtTime(5.2, tClick);
      ringFilter.gain.setValueAtTime(13, tClick);

      clickOsc.connect(ringFilter);
      ringFilter.connect(clickGain);
      clickGain.connect(destination);
      clickOsc.start(tClick);
      clickOsc.stop(tClick + 0.025);
    }
  }

  /* ========================================================================
     14. CARREGADOR AK METAL — ROCK-AND-LOCK (AK-47)
     ======================================================================== */
  synthesizeMagAkMetalInsert(params, ctx, destination, startTime = null, humanize = false) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;
    const j = humanize ? (1 + (Math.random() - 0.5) * 0.05) : 1.0;

    const hookVal     = getVal(params.frontLugHook, 0.70);
    const paddleVal   = getVal(params.paddleSnap, 1.00);
    const ringFreq    = getVal(params.sheetMetalRing, 1350) * j;
    const thudVal     = getVal(params.heavyRearThud, 0.90);
    const clatterFreq = getVal(params.steelClatter, 820);

    // 1. Dente frontal no trunnion
    if (hookVal > 0.01) {
      const hookOsc = ctx.createOscillator();
      const hookGain = ctx.createGain();
      hookOsc.type = 'sawtooth';
      hookOsc.frequency.setValueAtTime(1100, t0);
      hookOsc.frequency.exponentialRampToValueAtTime(380, t0 + 0.018);
      hookGain.gain.setValueAtTime(0.0001, t0);
      hookGain.gain.exponentialRampToValueAtTime(hookVal * 0.60, t0 + 0.0008);
      hookGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
      hookOsc.connect(hookGain);
      hookGain.connect(destination);
      hookOsc.start(t0);
      hookOsc.stop(t0 + 0.030);
    }

    // 2. Báscula pesada
    const tThud = t0 + 0.042;
    if (thudVal > 0.01) {
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(290, tThud);
      thudOsc.frequency.exponentialRampToValueAtTime(75, tThud + 0.035);
      thudGain.gain.setValueAtTime(0.0001, t0);
      thudGain.gain.setValueAtTime(0.0001, tThud);
      thudGain.gain.exponentialRampToValueAtTime(thudVal * 0.90, tThud + 0.001);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, tThud + 0.045);
      thudOsc.connect(thudGain);
      thudGain.connect(destination);
      thudOsc.start(tThud);
      thudOsc.stop(tThud + 0.050);
    }

    // 3. Estalo violento da alavanca do retém
    const tSnap = t0 + 0.048;
    if (paddleVal > 0.01) {
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'square';
      snapOsc.frequency.setValueAtTime(3200, tSnap);
      snapOsc.frequency.exponentialRampToValueAtTime(700, tSnap + 0.016);
      snapGain.gain.setValueAtTime(0.0001, t0);
      snapGain.gain.setValueAtTime(0.0001, tSnap);
      snapGain.gain.exponentialRampToValueAtTime(paddleVal * 1.0, tSnap + 0.0006);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, tSnap + 0.028);

      const metalFilter = ctx.createBiquadFilter();
      metalFilter.type = 'peaking';
      metalFilter.frequency.setValueAtTime(ringFreq, tSnap);
      metalFilter.Q.setValueAtTime(4.8, tSnap);
      metalFilter.gain.setValueAtTime(14, tSnap);

      snapOsc.connect(metalFilter);
      metalFilter.connect(snapGain);
      snapGain.connect(destination);
      snapOsc.start(tSnap);
      snapOsc.stop(tSnap + 0.035);

      // Vibração residual de chapa de aço canelada
      const clatterOsc = ctx.createOscillator();
      const clatterGain = ctx.createGain();
      clatterOsc.type = 'triangle';
      clatterOsc.frequency.setValueAtTime(clatterFreq, tSnap);
      clatterGain.gain.setValueAtTime(0.0001, t0);
      clatterGain.gain.setValueAtTime(0.0001, tSnap);
      clatterGain.gain.exponentialRampToValueAtTime(paddleVal * 0.55, tSnap + 0.001);
      clatterGain.gain.exponentialRampToValueAtTime(0.0001, tSnap + 0.065);
      clatterOsc.connect(clatterGain);
      clatterGain.connect(destination);
      clatterOsc.start(tSnap);
      clatterOsc.stop(tSnap + 0.075);
    }
  }
}
