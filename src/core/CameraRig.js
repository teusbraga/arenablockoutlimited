import * as THREE from 'three';
import { CONFIG } from './ConfigLoader.js';

/**
 * Utilitário de amortecimento elástico analítico com garantia de estabilidade numérica (estilo SmoothDamp).
 * Garante tempo de resposta exato, desaceleração suave sem overshoot e cálculo preciso de velocidade angular.
 */
function smoothDamp(current, target, currentVelocity, smoothTime, maxSpeed = Infinity, dt = 0.016) {
  if (smoothTime <= 0.0001) {
    const vel = dt > 0 ? (target - current) / dt : 0;
    return { value: target, velocity: vel };
  }
  const omega = 2.0 / smoothTime;
  const x = omega * dt;
  const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTo = target;

  const maxChange = maxSpeed * smoothTime;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const targetVal = current - change;

  const temp = (currentVelocity + omega * change) * dt;
  let newVelocity = (currentVelocity - omega * temp) * exp;
  let output = targetVal + (change + temp) * exp;

  if ((originalTo - current > 0.0) === (output > originalTo)) {
    output = originalTo;
    newVelocity = (output - originalTo) / (dt > 0 ? dt : 0.001);
  }
  return { value: output, velocity: newVelocity };
}

/**
 * CameraRig: Camada cinética central da câmera.
 * - Layer 0: Intenção do mouse (targetYaw, targetPitch).
 * - Layer 1: Inércia angular da cabeça / turning rate (smoothDamp).
 * - Layer 2: Impulso de recuo (punch angular elástico, coice linear e shake de explosão).
 * - Expõe angularVelocity limpa e contínua para o Viewmodel (Layer 3) e Scope (Layer 4).
 */
export class CameraRig {
  constructor() {
    // ---- Orientação Alvo (Layer 0 - Mouse Intent) ----
    this.targetYaw = 0;
    this.targetPitch = 0;

    // ---- Orientação Atual da Câmera (Layer 1 - Inércia Angular) ----
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.currentRoll = 0;

    // ---- Velocidades Angulares (rad/s) ----
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.angularVelocity = { x: 0, y: 0 }; // x: pitch rate (para cima/baixo), y: yaw rate (para os lados)

    // ---- Layer 2: Impulsos Físicos de Recuo (Punch Elástico & Coice Linear) ----
    this.recoilRot = new THREE.Vector3();     // x: pitch punch, y: yaw punch, z: roll punch
    this.recoilRotVel = new THREE.Vector3();
    this.recoilPos = new THREE.Vector3();     // x: horizontal, y: vertical, z: profundidade (coice no ombro)
    this.recoilPosVel = new THREE.Vector3();
    this.shakeIntensity = 0;
    this.shakeRot = new THREE.Vector3();
    this.shakePos = new THREE.Vector3();

    // ---- Posição Final da Câmera no Espaço World ----
    this.position = new THREE.Vector3();

    // ---- Head Bob & Locomoção ----
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.bobRoll = 0;
    this.bobPitch = 0;

    // ---- Altura dos Olhos (Eye Height) ----
    this.eyeHeight = CONFIG.PLAYER.eyeHeight;

    // ---- Lean / Inclinação de Tronco (Q / E) ----
    this.currentLean = 0;
    this.targetLean = 0;

    // ---- Flinch (Impacto de Tiro Recebido) ----
    this.flinchPitch = 0;
    this.flinchYaw = 0;
  }

  /**
   * Registra intenção de rotação vinda do mouse.
   */
  addMouseInput(dx, dy, sens) {
    this.targetYaw -= dx * sens;
    this.targetPitch -= dy * sens;

    const pitchLimit = CONFIG.CAMERA.pitchLimit || 1.52;
    this.targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.targetPitch));
  }

  /**
   * Injeta impulso de recuo (Layer 2) na câmera:
   * - climbPitch/climbYaw: subida permanente que exige controle ativo do mouse.
   * - punchPitch/punchYaw/punchRoll: tranco angular elástico com retorno rápido por mola.
   * - posKickZ/posKickY: coice linear no ombro (profundidade / choque vertical).
   * - shake: energia de explosão que gera tremor de alta frequência.
   */
  addRecoilImpulse({
    climbPitch = 0,
    climbYaw = 0,
    punchPitch = 0,
    punchYaw = 0,
    punchRoll = 0,
    posKickZ = 0,
    posKickY = 0,
    shake = 0
  } = {}) {
    // 1. Subida permanente de mira
    this.targetPitch += climbPitch;
    const pitchLimit = CONFIG.CAMERA.pitchLimit || 1.52;
    this.targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.targetPitch));
    this.targetYaw += climbYaw;

    // 2. Punch elástico angular (chacoalha e retorna com mola rápida)
    this.recoilRotVel.x += punchPitch * 48.0;
    this.recoilRotVel.y += punchYaw * 48.0;
    this.recoilRotVel.z += punchRoll * 32.0;

    // 3. Coice linear no ombro (profundidade e elevação física)
    this.recoilPosVel.z += posKickZ * 38.0;
    this.recoilPosVel.y += posKickY * 24.0;

    // 4. Tremor de explosão
    if (shake > 0) {
      this.shakeIntensity = Math.min(this.shakeIntensity + shake, 1.8);
    }
  }

  addShake(amount) {
    if (amount > 0) {
      this.shakeIntensity = Math.min(this.shakeIntensity + amount, 1.8);
    }
  }

  setOrientation(yaw, pitch = 0) {
    this.targetYaw = yaw;
    this.currentYaw = yaw;
    this.targetPitch = pitch;
    this.currentPitch = pitch;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.angularVelocity.x = 0;
    this.angularVelocity.y = 0;
  }

  setYaw(y) {
    const diff = y - this.currentYaw;
    this.targetYaw += diff;
    this.currentYaw = y;
  }

  setPitch(p) {
    const pitchLimit = CONFIG.CAMERA.pitchLimit || 1.52;
    const clamped = Math.max(-pitchLimit, Math.min(pitchLimit, p));
    this.targetPitch = clamped;
    this.currentPitch = clamped;
  }

  addYaw(delta) {
    this.targetYaw += delta;
  }

  addPitch(delta) {
    const pitchLimit = CONFIG.CAMERA.pitchLimit || 1.52;
    this.targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.targetPitch + delta));
  }

  addFlinch(pitch, yaw) {
    this.flinchPitch += pitch;
    this.flinchYaw += yaw;
  }

  reset() {
    this.flinchPitch = 0;
    this.flinchYaw = 0;
    this.currentRoll = 0;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.angularVelocity.x = 0;
    this.angularVelocity.y = 0;
    this.targetPitch = 0;
    this.currentPitch = 0;
    this.recoilRot.set(0, 0, 0);
    this.recoilRotVel.set(0, 0, 0);
    this.recoilPos.set(0, 0, 0);
    this.recoilPosVel.set(0, 0, 0);
    this.shakeIntensity = 0;
    this.shakeRot.set(0, 0, 0);
    this.shakePos.set(0, 0, 0);
  }

  /**
   * Atualização principal de física da câmera por frame.
   * Aplica turning rate / inércia elástica (Layer 1) e recuo mecânico (Layer 2).
   */
  update(dt, player) {
    if (!player) return;

    // ---- 1. Inércia Angular / Turning Rate (Layer 1) ----
    const isAds = !!player.ads;
    const weaponWeight = player.activeWeaponWeight || 3.5;
    const weightFactor = isAds ? Math.min(1.35, Math.max(0.75, Math.sqrt(weaponWeight / 3.5))) : 1.0;
    const smoothTime = isAds
      ? (CONFIG.CAMERA.adsSmoothTime ?? 0.024) * weightFactor
      : (CONFIG.CAMERA.smoothTime ?? 0.016);
    const maxTurningRate = isAds
      ? (CONFIG.CAMERA.maxTurningRate ?? 50.0) / Math.pow(weightFactor, 0.5)
      : (CONFIG.CAMERA.maxTurningRate ?? 50.0);

    // Evita saltos no cálculo angular caso o yaw dê voltas completas
    let diffYaw = this.targetYaw - this.currentYaw;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    const effectiveTargetYaw = this.currentYaw + diffYaw;

    const resYaw = smoothDamp(
      this.currentYaw,
      effectiveTargetYaw,
      this.yawVelocity,
      smoothTime,
      maxTurningRate,
      dt
    );
    this.currentYaw = resYaw.value;
    this.yawVelocity = resYaw.velocity;

    // Pitch
    const pitchLimit = CONFIG.CAMERA.pitchLimit || 1.52;
    this.targetPitch = Math.max(-pitchLimit, Math.min(pitchLimit, this.targetPitch));
    const resPitch = smoothDamp(
      this.currentPitch,
      this.targetPitch,
      this.pitchVelocity,
      smoothTime,
      maxTurningRate,
      dt
    );
    this.currentPitch = Math.max(-pitchLimit, Math.min(pitchLimit, resPitch.value));
    this.pitchVelocity = resPitch.velocity;

    // ---- 2. Molas de Recuo e Coice Linear (Layer 2) ----
    // Sub-stepping numérico (500 Hz) para estabilidade analítica rigorosa
    let remainDt = dt;
    const subDt = 0.002;
    const kRot = isAds ? 320.0 : 280.0;
    const dRot = isAds ? 28.0 : 25.0;
    const kPos = 240.0;
    const dPos = 24.0;

    while (remainDt > 0.0001) {
      const step = Math.min(remainDt, subDt);

      // Mola rotacional do punch
      this.recoilRotVel.x += (-this.recoilRot.x * kRot - this.recoilRotVel.x * dRot) * step;
      this.recoilRotVel.y += (-this.recoilRot.y * kRot - this.recoilRotVel.y * dRot) * step;
      this.recoilRotVel.z += (-this.recoilRot.z * kRot - this.recoilRotVel.z * dRot) * step;
      this.recoilRot.x += this.recoilRotVel.x * step;
      this.recoilRot.y += this.recoilRotVel.y * step;
      this.recoilRot.z += this.recoilRotVel.z * step;

      // Mola linear do coice no ombro
      this.recoilPosVel.x += (-this.recoilPos.x * kPos - this.recoilPosVel.x * dPos) * step;
      this.recoilPosVel.y += (-this.recoilPos.y * kPos - this.recoilPosVel.y * dPos) * step;
      this.recoilPosVel.z += (-this.recoilPos.z * kPos - this.recoilPosVel.z * dPos) * step;
      this.recoilPos.x += this.recoilPosVel.x * step;
      this.recoilPos.y += this.recoilPosVel.y * step;
      this.recoilPos.z += this.recoilPosVel.z * step;

      remainDt -= step;
    }

    // Decaimento do tremor (shake) de explosão
    this.shakeIntensity *= Math.max(0, 1 - dt * 9.0);
    if (this.shakeIntensity > 0.001) {
      const t = performance.now() * 0.001;
      // No ADS, a câmera principal externa fica 100% firme e estável (zero tremor externo)
      const shakeDamp = isAds ? 0.0 : 0.50;
      this.shakePos.set(
        Math.sin(t * 47.3) * 0.012 * this.shakeIntensity * shakeDamp,
        Math.cos(t * 61.7) * 0.012 * this.shakeIntensity * shakeDamp,
        Math.sin(t * 53.1) * 0.008 * this.shakeIntensity * shakeDamp
      );
      this.shakeRot.set(
        Math.cos(t * 55.0) * 0.008 * this.shakeIntensity * shakeDamp,
        Math.sin(t * 43.0) * 0.006 * this.shakeIntensity * shakeDamp,
        Math.sin(t * 37.0) * 0.006 * this.shakeIntensity * shakeDamp
      );
    } else {
      this.shakePos.set(0, 0, 0);
      this.shakeRot.set(0, 0, 0);
    }

    // ---- 3. Velocidade Angular Cinética Exposta ----
    // Une o turning do mouse + a velocidade elástica do recuo
    this.angularVelocity.x = this.pitchVelocity + this.recoilRotVel.x;
    this.angularVelocity.y = this.yawVelocity + this.recoilRotVel.y;

    // ---- 4. Flinch (Decaimento exponencial de dano) ----
    this.flinchPitch *= Math.max(0, 1 - dt * 15);
    this.flinchYaw *= Math.max(0, 1 - dt * 15);

    // ---- 5. Head Bob & Locomoção ----
    const speedXZ = Math.hypot(player.vel.x, player.vel.z);
    const isMoving = player.alive && player.onGround && speedXZ > 0.6;

    if (isMoving) {
      const rate = 9 + (player.sprinting ? 5 : 0) - player.crouchAmount * 3;
      this.bobPhase += dt * rate;
      const target = (player.sprinting ? 0.040 : 0.029) * Math.min(speedXZ / CONFIG.PLAYER.walkSpeed, 1.8);
      this.bobAmt += (target - this.bobAmt) * Math.min(dt * 8, 1);
    } else {
      this.bobAmt += (0 - this.bobAmt) * Math.min(dt * 6, 1);
    }

    const bobY = Math.sin(this.bobPhase * 2) * this.bobAmt;
    const bobX = Math.cos(this.bobPhase) * this.bobAmt * 0.60;
    this.bobRoll = Math.cos(this.bobPhase) * this.bobAmt * 0.16;
    this.bobPitch = Math.sin(this.bobPhase * 2) * this.bobAmt * 0.07;

    // ---- 6. Altura dos Olhos (Eye Height com Agachamento / Morte) ----
    let targetEye = CONFIG.PLAYER.eyeHeight + (CONFIG.PLAYER.eyeCrouch - CONFIG.PLAYER.eyeHeight) * player.crouchAmount;
    if (!player.alive) targetEye = 0.2;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(dt * (player.alive ? 18 : 6), 1);

    // ---- 7. Tombamento de Morte (Death Roll) ----
    const deathRoll = !player.alive ? -0.8 : 0;
    this.currentRoll += (deathRoll - this.currentRoll) * Math.min(dt * 4, 1);

    // ---- 8. Lean / Inclinação de Tronco (Layer 1.5) ----
    this.targetLean = player.alive ? (player.lean || 0) : 0;
    this.currentLean += (this.targetLean - this.currentLean) * Math.min(dt * 14, 1);
    const leanOffsetDist = this.currentLean * 0.35; // 35cm de deslocamento lateral da cabeça
    const leanDrop = Math.abs(this.currentLean) * 0.05; // 5cm de flexão natural ao inclinar

    // ---- 9. Posição no Espaço World (Incluindo coice linear transformado na orientação da câmera) ----
    const rightX = Math.cos(this.currentYaw);
    const rightZ = -Math.sin(this.currentYaw);
    // Vetor de recuo em profundidade (-forward = para trás da câmera)
    const backX = Math.sin(this.currentYaw);
    const backZ = Math.cos(this.currentYaw);

    this.position.set(
      player.renderPos.x + (bobX + leanOffsetDist) * rightX + rightX * this.recoilPos.x + backX * this.recoilPos.z + this.shakePos.x,
      player.renderPos.y + this.eyeHeight - leanDrop + bobY + this.recoilPos.y + this.shakePos.y,
      player.renderPos.z + (bobX + leanOffsetDist) * rightZ + rightZ * this.recoilPos.x + backZ * this.recoilPos.z + this.shakePos.z
    );
  }

  /**
   * Aplica a posição e rotação calculadas diretamente ao objeto Camera do Three.js.
   */
  applyToCamera(camera) {
    camera.position.copy(this.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.currentYaw + this.flinchYaw + this.recoilRot.y + this.shakeRot.y;
    camera.rotation.x = this.currentPitch + this.bobPitch + this.flinchPitch + this.recoilRot.x + this.shakeRot.x;
    
    // Inclinação angular de lean (roll): ~7.5 graus negativos para a direita, positivos para a esquerda
    const leanRoll = -this.currentLean * 0.13;
    camera.rotation.z = this.bobRoll + this.currentRoll + this.recoilRot.z + this.shakeRot.z + leanRoll;
  }
}
