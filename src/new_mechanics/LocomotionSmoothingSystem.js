import * as THREE from 'three';
import { CONFIG } from '../core/ConfigLoader.js';

/**
 * LocomotionSmoothingSystem: Gerenciador unificado de estados cinemáticos e
 * pesos contínuos de transição entre Idle, Walk, Sprint, Crouch e ADS.
 * 
 * Elimina completamente descontinuidades visuais (teleportes, estalos de fase e saltos de pose):
 * - Mantém pesos normalizados [0..1] com interpolação crítica contínua (SmoothDamp / Exp decay).
 * - Acumula a fase trigonométrica de bobbing de forma incremental (dPhase = dt * freq),
 *   evitando o salto quântico de radianos decorrente da multiplicação pelo tempo absoluto.
 * - Fornece inércia longitudinal suave (arma recua levemente na arrancada e avança na frenagem).
 */
export class LocomotionSmoothingSystem {
  constructor() {
    // Pesos contínuos de locomoção
    this.idleWeight = 1.0;
    this.walkWeight = 0.0;
    this.sprintWeight = 0.0;
    this.crouchWeight = 0.0;
    this.adsWeight = 0.0;

    // Velocidade escalar suavizada para evitar degraus de atrito
    this.smoothedSpeed = 0.0;
    this.speedRatio = 0.0;

    // Acumulador de fase contínua para bobbing da arma e do corpo
    this.bobPhase = 0.0;
    this.bobAmount = 0.0;

    // Offset vertical dinâmico suavizado (elimina o salto de 5mm ao parar/andar)
    this.locoOffsetY = 0.0;

    // Inércia longitudinal (Forward / Backward acceleration lag)
    this.accelInertiaZ = 0.0;
    this.accelInertiaPitch = 0.0;
    this.prevSpeed = 0.0;
  }

  /**
   * Atualiza os pesos e fases com base no estado cinemático do jogador.
   * 
   * @param {number} dt Delta de tempo do frame em segundos
   * @param {Object} params Parâmetros cinemáticos
   */
  update(dt, {
    speedXZ = 0,
    isSprinting = false,
    isCrouched = false,
    isADS = false,
    adsAmount = 0,
    walkSpeed = CONFIG.PLAYER?.walkSpeed || 5.2,
    sprintMul = CONFIG.PLAYER?.sprintMul || 1.75
  } = {}) {
    if (dt <= 0) return;

    // 1. Suavização ultra-rápida da velocidade do jogador (responsividade ágil sem atraso)
    const speedLerp = Math.min(dt * 32.0, 1.0);
    this.smoothedSpeed += (speedXZ - this.smoothedSpeed) * speedLerp;

    // Cálculo da aceleração longitudinal para inércia orgânica da arma
    const accel = (this.smoothedSpeed - this.prevSpeed) / Math.max(dt, 0.001);
    this.prevSpeed = this.smoothedSpeed;

    // Inércia leve e ágil: estabiliza rápido (~70-90ms)
    const targetInertiaZ = THREE.MathUtils.clamp(-accel * 0.0004, -0.010, 0.010);
    const targetInertiaPitch = THREE.MathUtils.clamp(accel * 0.0008, -0.018, 0.018);
    this.accelInertiaZ += (targetInertiaZ - this.accelInertiaZ) * Math.min(dt * 20.0, 1.0);
    this.accelInertiaPitch += (targetInertiaPitch - this.accelInertiaPitch) * Math.min(dt * 20.0, 1.0);

    // 2. Determinação dos alvos normalizados de locomoção
    const maxSprintSpeed = walkSpeed * sprintMul;
    const isMoving = this.smoothedSpeed > 0.08;

    let targetSprint = 0.0;
    let targetWalk = 0.0;
    let targetIdle = 0.0;

    if (!isMoving || isADS) {
      targetIdle = 1.0;
      targetWalk = 0.0;
      targetSprint = 0.0;
      if (isADS) this.sprintWeight *= Math.max(0, 1.0 - dt * 45.0);
    } else if (isSprinting && this.smoothedSpeed > walkSpeed * 0.8) {
      // Transição para sprint conforme ultrapassa a velocidade de caminhada
      const sprintFactor = THREE.MathUtils.clamp(
        (this.smoothedSpeed - walkSpeed * 0.8) / Math.max(maxSprintSpeed - walkSpeed * 0.8, 0.5),
        0.0,
        1.0
      );
      targetSprint = sprintFactor;
      targetWalk = 1.0 - sprintFactor;
      targetIdle = 0.0;
    } else {
      const walkFactor = THREE.MathUtils.clamp(this.smoothedSpeed / Math.max(walkSpeed, 0.5), 0.0, 1.0);
      targetWalk = walkFactor;
      targetIdle = 1.0 - walkFactor;
      targetSprint = 0.0;
    }

    const targetCrouch = isCrouched ? 1.0 : 0.0;
    const targetAds = (isADS || adsAmount > 0.01) ? Math.max(isADS ? 1.0 : 0.0, adsAmount) : 0.0;

    // 3. Interpolação analítica rápida calibrada para janela de 70ms a 90ms (k = 28 s⁻¹)
    const blendRate = 28.0;
    const decay = 1.0 - Math.exp(-dt * blendRate);

    this.idleWeight += (targetIdle - this.idleWeight) * decay;
    this.walkWeight += (targetWalk - this.walkWeight) * decay;
    this.sprintWeight += (targetSprint - this.sprintWeight) * decay;
    this.crouchWeight += (targetCrouch - this.crouchWeight) * Math.min(dt * 26.0, 1.0);
    this.adsWeight += (targetAds - this.adsWeight) * Math.min(dt * 28.0, 1.0);

    // Normalização defensiva de pesos primários
    const sum = this.idleWeight + this.walkWeight + this.sprintWeight;
    if (sum > 0.0001) {
      this.idleWeight /= sum;
      this.walkWeight /= sum;
      this.sprintWeight /= sum;
    }

    // 4. Integração Contínua da Fase de Bobbing (EVITA DESCONTINUIDADE TRIGONOMÉTRICA)
    const baseWalkFreq = CONFIG.SWAY?.walkBobFrequency || 7.5;
    const baseSprintFreq = CONFIG.SWAY?.sprintBobFrequency || 11.0;
    const currentFreq = THREE.MathUtils.lerp(baseWalkFreq, baseSprintFreq, this.sprintWeight);

    const targetBobAmt = (this.walkWeight * 0.009 + this.sprintWeight * 0.018)
      * (1.0 - this.adsWeight * 0.85);
    
    // A amplitude responde ágilmente (~70-90ms)
    this.bobAmount += (targetBobAmt - this.bobAmount) * Math.min(dt * 22.0, 1.0);

    if (this.bobAmount > 0.0001) {
      this.bobPhase += dt * currentFreq;
      if (this.bobPhase > Math.PI * 2) {
        this.bobPhase -= Math.PI * 2;
      }
    }

    // 5. Offset Vertical Suavizado (elimina o salto de 5mm com resposta ágil de 70-90ms)
    const targetLocoY = isMoving ? -0.005 * (this.walkWeight + this.sprintWeight) : 0.0;
    this.locoOffsetY += (targetLocoY - this.locoOffsetY) * Math.min(dt * 24.0, 1.0);
  }

  /**
   * Retorna os componentes X e Y do bobbing da arma com fase 100% contínua.
   */
  getWeaponBob(bobScale = 1.0) {
    const amt = this.bobAmount * bobScale;
    if (amt <= 0.00001) return { x: 0, y: 0 };
    return {
      x: Math.sin(this.bobPhase) * amt,
      y: Math.abs(Math.cos(this.bobPhase)) * amt
    };
  }
}
