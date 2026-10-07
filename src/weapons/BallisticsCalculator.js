/**
 * BallisticsCalculator.js
 * Módulo puro e desacoplado de balística interna, externa e terminal.
 * Totalmente stateless e defensivo: opera com fallbacks seguros caso propriedades sejam omitidas.
 */

export class BallisticsCalculator {
  /**
   * Calcula a dispersão atual (spread) considerando estado do jogador, movimento e sway.
   * @param {Object} def - Definição compilada da arma
   * @param {Object} state - Estado do jogador { isAds, speedRatio, isStrafing, isSprinting, precisionPenalty, swayAmount }
   * @returns {number} Ângulo de dispersão em radianos
   */
  static calculateCurrentSpread(def, state = {}) {
    const ext = def?.ballistics?.external ?? {};
    const prec = ext.precision ?? {};
    const dyn = prec.dynamicLoss ?? {};

    const isAds = !!state.isAds;
    const speedRatio = Math.max(0, state.speedRatio ?? 0);
    const isStrafing = !!state.isStrafing;
    const isSprinting = !!state.isSprinting;
    const precisionPenalty = Math.max(0, state.precisionPenalty ?? 0);
    const swayAmount = Math.max(0, state.swayAmount ?? 0);

    // Precisão base do cano
    let baseSpread = prec.baseSpread ?? (isAds ? (def?.spreadAds ?? 0.0015) : (def?.spreadHip ?? 0.02));
    if (!isAds) {
      // No hipfire, baseSpread expande proporcionalmente
      baseSpread = Math.max(baseSpread, def?.spreadHip ?? 0.02);
    }

    // Impacto do sway sobre a precisão
    const swayImpact = (prec.swaySpreadImpact ?? 0.5) * swayAmount;

    // Perda dinâmica por locomoção
    let moveLoss = 0;
    if (isSprinting) {
      moveLoss = (dyn.run ?? 0.04) * Math.max(1, speedRatio);
    } else if (isStrafing && speedRatio > 0.05) {
      moveLoss = (dyn.strafe ?? 0.02) * speedRatio;
    } else if (speedRatio > 0.05) {
      moveLoss = (dyn.walk ?? 0.015) * speedRatio;
    }

    if (isAds) {
      // ADS amortece a perda de precisão por movimento em 50%
      moveLoss *= 0.5;
    }

    return baseSpread + swayImpact + moveLoss + precisionPenalty;
  }

  /**
   * Calcula o impulso e vetor de recuo com suporte a padrões (recoil pattern).
   * @param {Object} def - Definição compilada da arma
   * @param {number} consecutiveShots - Quantidade de tiros consecutivos (spray)
   * @param {boolean} isAds - Se o jogador está mirando
   * @returns {{ pitch: number, yaw: number, kickbackZ: number }}
   */
  static calculateRecoilImpulse(def, consecutiveShots = 0, isAds = false) {
    const ext = def?.ballistics?.external ?? {};
    const recoil = ext.recoil ?? {};

    const vertBase = recoil.vertical ?? def?.recoilPitch ?? 0.01;
    const horizBase = recoil.horizontal ?? def?.recoilYaw ?? 0.003;
    const yawBias = recoil.yawBias ?? def?.recoilYawBias ?? 0;
    const pattern = recoil.pattern ?? 'standard';

    // Fator de escala por rajada (spray streak)
    const streak = Math.max(1, consecutiveShots);
    const streakMultiplier = 1 + (streak - 1) * 0.08;

    // Escala em ADS vs Hipfire
    const pitchScale = isAds ? 0.35 : 0.85;
    const yawScale = isAds ? 0.25 : 0.60;

    let pitch = vertBase * pitchScale * streakMultiplier;
    let yawDir = yawBias;

    // Modulação baseada no pattern configurado
    switch (pattern) {
      case 'kick_right':
        yawDir = Math.abs(yawBias || 0.4) + Math.sin(streak * 0.8) * 0.2;
        break;
      case 'linear_left':
        yawDir = -Math.abs(yawBias || 0.4) - Math.sin(streak * 0.6) * 0.15;
        break;
      case 'spray_wide':
        yawDir = (Math.sin(streak * 1.2) + (yawBias || 0)) * 1.5;
        break;
      case 'vertical_snap':
        yawDir = (Math.random() - 0.5) * 0.2;
        pitch *= 1.1;
        break;
      case 'heavy_churn':
        yawDir = (Math.sin(streak * 0.7) > 0 ? 0.5 : -0.5) + (yawBias || 0);
        break;
      default:
        // Padrão standard: leve desvio de viés
        yawDir = yawBias + (Math.random() - 0.5) * 0.1;
        break;
    }

    const yaw = horizBase * yawDir * yawScale * streakMultiplier;
    const kickbackZ = def?.kickbackZ ?? 0.008;

    return { pitch, yaw, kickbackZ };
  }

  /**
   * Calcula a oscilação natural do cano (sway) em coordenadas angulares.
   * @param {Object} def - Definição compilada da arma
   * @param {number} time - Tempo decorrido em segundos
   * @param {boolean} isAds - Se está em mira
   * @param {number} speedRatio - Razão de velocidade de locomoção
   * @returns {{ x: number, y: number, amplitude: number }}
   */
  static calculateSway(def, time = 0, isAds = false, speedRatio = 0) {
    const ext = def?.ballistics?.external ?? {};
    const sway = ext.sway ?? {};

    const baseAmp = sway.base ?? 0.0025;
    const speed = sway.speed ?? 1.5;
    const adsMul = isAds ? (sway.multiplierAds ?? 0.25) : 1.0;
    const moveMul = 1.0 + Math.max(0, speedRatio) * 1.5;

    const currentAmp = baseAmp * adsMul * moveMul;

    // Curva harmônica (Lissajous) para sensação de respiração orgânica
    const x = Math.sin(time * speed) * Math.cos(time * speed * 0.45) * currentAmp;
    const y = Math.cos(time * speed * 0.9) * currentAmp * 0.75;

    return { x, y, amplitude: currentAmp };
  }

  /**
   * Calcula o impacto terminal: dano corrigido por distância e queda da bala (bullet drop).
   * @param {Object} def - Definição compilada da arma
   * @param {number} distance - Distância até o impacto em metros
   * @param {string} hitPart - 'head' | 'body'
   * @returns {{ finalDamage: number, dropY: number, distance: number, falloffMultiplier: number }}
   */
  static calculateTerminalImpact(def, distance = 0, hitPart = 'body') {
    const term = def?.ballistics?.terminal ?? {};
    const falloff = term.damageFalloff ?? {};

    const startDist = falloff.startDistance ?? 30;
    const endDist = Math.max(startDist + 1, falloff.endDistance ?? 80);
    const minMul = Math.min(1.0, Math.max(0, falloff.minMultiplier ?? 0.5));

    let falloffMultiplier = 1.0;
    if (distance > startDist) {
      if (distance >= endDist) {
        falloffMultiplier = minMul;
      } else {
        const factor = (distance - startDist) / (endDist - startDist);
        falloffMultiplier = 1.0 - factor * (1.0 - minMul);
      }
    }

    const baseDmg = hitPart === 'head'
      ? (term.damageHead ?? def?.damageHead ?? 50)
      : (term.damageBody ?? def?.damageBody ?? 25);

    const finalDamage = Math.max(1, Math.round(baseDmg * falloffMultiplier));

    // Queda balística do projétil (dy = 0.5 * g * t^2)
    const bulletSpeed = Math.max(50, term.bulletSpeed ?? 700);
    const bulletDrop = term.bulletDrop ?? 9.8;
    const flightTime = distance / bulletSpeed;
    const dropY = 0.5 * bulletDrop * (flightTime * flightTime);

    return {
      finalDamage,
      dropY,
      distance,
      falloffMultiplier
    };
  }
}
