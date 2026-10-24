/**
 * Acústica de Trauma Físico e Resposta de Armadura no Jogador
 * Conforme diretiva do usuário: utiliza exclusivamente a Placa Balística / Trauma Contundente
 * com variações dinâmicas de ressonância a cada impacto sofrido.
 */

const getVal = (param, fallback = 0) => (typeof param === 'number' ? param : (param?.value ?? fallback));

export class PlayerTraumaAcoustics {
  constructor(noiseBuffers) {
    this.noiseBuffers = noiseBuffers;
  }

  /**
   * Disparo na Placa Balística / Kevlar / Trauma Contundente
   * @param {Object} params Parâmetros do preset
   * @param {AudioContext} ctx
   * @param {AudioNode} destination
   * @param {number|null} startTime
   * @param {number} damageInt Intensidade do dano (influencia o pitch e ressonância)
   */
  synthesizeBulletHitKevlar(params, ctx, destination, startTime = null, damageInt = 25) {
    const t0 = startTime !== null ? startTime : ctx.currentTime;

    // Variação estocástica e proporcional de ressonância da placa a cada impacto
    // Modula a frequência de 2800Hz a 4200Hz dependendo da intensidade e ponto de estresse
    const resonanceOffset = ((Math.random() - 0.5) * 600) + (Math.min(damageInt, 60) * 10);
    const baseResonance   = getVal(params.plateResonance, 3400);
    const dynamicResonance = Math.max(1800, Math.min(5200, baseResonance + resonanceOffset));

    const crackVal   = getVal(params.plateCrack, 1.00);
    const sternumVal = getVal(params.sternumImpact, 0.95);
    const breathVal  = getVal(params.breathKnock, 0.70);
    const biteVal    = getVal(params.compositeBite, 0.75);

    // 1. Estalo hiper-seco e estilhaçamento da cerâmica/aramida (t = 0 a 14ms)
    if (crackVal > 0.01) {
      const crackOsc = ctx.createOscillator();
      const crackGain = ctx.createGain();
      crackOsc.type = 'square';
      crackOsc.frequency.setValueAtTime(dynamicResonance * 1.15, t0);
      crackOsc.frequency.exponentialRampToValueAtTime(1100, t0 + 0.009);

      const plateFilter = ctx.createBiquadFilter();
      plateFilter.type = 'peaking';
      plateFilter.frequency.setValueAtTime(dynamicResonance, t0);
      plateFilter.Q.setValueAtTime(4.5, t0);
      plateFilter.gain.setValueAtTime(12, t0);

      crackGain.gain.setValueAtTime(0.0001, t0);
      crackGain.gain.exponentialRampToValueAtTime(crackVal * 0.90, t0 + 0.0004);
      crackGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.014);

      crackOsc.connect(plateFilter);
      plateFilter.connect(crackGain);
      crackGain.connect(destination);
      crackOsc.start(t0);
      crackOsc.stop(t0 + 0.018);
    }

    // 2. Trauma contundente maciço no esterno (t = 0 a 45ms)
    if (sternumVal > 0.01) {
      const bluntOsc = ctx.createOscillator();
      const bluntGain = ctx.createGain();
      bluntOsc.type = 'triangle';
      bluntOsc.frequency.setValueAtTime(220, t0);
      bluntOsc.frequency.exponentialRampToValueAtTime(45, t0 + 0.032);

      bluntGain.gain.setValueAtTime(0.0001, t0);
      bluntGain.gain.exponentialRampToValueAtTime(sternumVal * 1.0, t0 + 0.0008);
      bluntGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

      bluntOsc.connect(bluntGain);
      bluntGain.connect(destination);
      bluntOsc.start(t0);
      bluntOsc.stop(t0 + 0.050);
    }

    // 3. Aspereza fibrosa de aramida e compósito (t = 0 a 20ms)
    if (biteVal > 0.01 && this.noiseBuffers?.white) {
      const biteSrc = this.noiseBuffers.createSource('white', false);
      const biteFilter = ctx.createBiquadFilter();
      biteFilter.type = 'bandpass';
      biteFilter.frequency.setValueAtTime(dynamicResonance * 0.85, t0);
      biteFilter.Q.setValueAtTime(2.8, t0);

      const biteEnv = ctx.createGain();
      biteEnv.gain.setValueAtTime(0.0001, t0);
      biteEnv.gain.linearRampToValueAtTime(biteVal * 0.65, t0 + 0.0005);
      biteEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.020);

      biteSrc.connect(biteFilter);
      biteFilter.connect(biteEnv);
      biteEnv.connect(destination);
      biteSrc.start(t0);
      biteSrc.stop(t0 + 0.025);
    }

    // 4. Perda súbita de ar / concussão diafragmática (t = 0 a 40ms)
    if (breathVal > 0.01 && this.noiseBuffers?.brown) {
      const breathSrc = this.noiseBuffers.createSource('brown', false);
      const breathFilter = ctx.createBiquadFilter();
      breathFilter.type = 'lowpass';
      breathFilter.frequency.setValueAtTime(120, t0);

      const breathEnv = ctx.createGain();
      breathEnv.gain.setValueAtTime(0.0001, t0);
      breathEnv.gain.linearRampToValueAtTime(breathVal * 0.60, t0 + 0.002);
      breathEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.040);

      breathSrc.connect(breathFilter);
      breathFilter.connect(breathEnv);
      breathEnv.connect(destination);
      breathSrc.start(t0);
      breathSrc.stop(t0 + 0.045);
    }
  }
}
