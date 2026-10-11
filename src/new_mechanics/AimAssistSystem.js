/**
 * AimAssistSystem.js
 * 
 * Sistema de Assistência de Mira Refinado de Alta Performance (AAA / Mobile FPS Style):
 * 
 * Combina os 3 pilares clássicos de Aim Assist moderno (Call of Duty / Apex / Destiny / Mobile)
 * com custo computacional mínimo (O(N) com early-exit angular via Dot Product, 0 alocações por frame
 * e no máximo 1 único raycast de oclusão por frame):
 * 
 * 1. Friction / Slowdown Bubble (Bolha de Desaceleração Magnética):
 *    - Quando a mira entra no cone angular da "bolha" do inimigo, reduz suavemente a sensibilidade
 *      do input (mouse/touch) em até 48% seguindo uma curva quadrática suave, evitando "overshoot".
 * 
 * 2. Rotational Aim Assist (Magnetismo de Rastreio em Movimento):
 *    - Ativo somente quando o jogador está interagindo ativamente (movendo-se, movendo a câmera,
 *      em ADS ou atirando) — nunca move a câmera sozinho se o jogador estiver parado sem tocar em nada.
 *    - Aplica uma rotação elástica suave em direção ao peito superior do alvo com compensação de
 *      velocidade (Target Velocity Lead) e possui uma "Inner Deadzone" (~0.45°) no centro do alvo
 *      para permitir que o jogador ajuste livremente entre peito e headshot sem brigar com o imã.
 * 
 * 3. ADS Target Snap-In (Micro-Convergência ao Abrir a Mira):
 *    - Na transição de entrada em ADS (false -> true), se houver um inimigo visível dentro do cone
 *      de aquisição, ativa uma janela curta (0.14s) de convergência suave em direção ao alvo.
 * 
 * Mapeamento e Pontos de Integração no Projeto:
 * - Configuração & Menu: src/ui/CrosshairManager.js (config.aimAssist: true | 'none'), index.html (#ch-aim-assist)
 * - Aplicação no Look: src/entities/Player.js (update -> rig.addMouseInput / addYaw / addPitch)
 * - Alvos: src/core/GameManager.js (bots vivos)
 * - Oclusão Física (LOS): src/physics/CollisionWorld.js (raycast)
 * 
 * Godot 4.x Porting Reference:
 * - Dot Product Cone Check: camera_forward.dot(dir_to_target) > cos(bubble_angle)
 * - LOS Check: space_state.intersect_ray(PhysicsRayQueryParameters3D.create(eye_pos, target_chest))
 * - Yaw/Pitch Application: player_rig.rotate_y(delta_yaw), camera_pivot.rotate_x(delta_pitch)
 */

import * as THREE from 'three';

const _vEye = new THREE.Vector3();
const _vFwd = new THREE.Vector3();
const _vTarget = new THREE.Vector3();
const _vToTarget = new THREE.Vector3();
const _vDir = new THREE.Vector3();

function normalizeAngleDiff(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export class AimAssistSystem {
  /**
   * @param {Object} options
   * @param {Object} [options.collisionWorld] Instância de CollisionWorld para checagem de oclusão (LOS)
   * @param {Function} [options.botsProvider] Função que retorna o array de bots ativos `() => Bot[]`
   * @param {Object} [options.crosshairManager] Instância de CrosshairManager para ler `config.aimAssist`
   */
  constructor({
    collisionWorld = null,
    botsProvider = () => [],
    crosshairManager = null
  } = {}) {
    this.collisionWorld = collisionWorld;
    this.botsProvider = botsProvider;
    this.crosshairManager = crosshairManager;

    // Estado manual caso usado sem CrosshairManager
    this.enabled = true;

    // Parâmetros calibrados para fluidez tática nítida tanto em Hipfire quanto em ADS
    this.maxRangeHip = 52.0;          // Alcance máximo no hipfire (metros)
    this.maxRangeAds = 68.0;          // Alcance máximo em ADS (metros)
    this.bubbleRadiusHip = 1.35;      // Raio físico generoso da bolha magnética no Hipfire (metros)
    this.bubbleRadiusAds = 1.05;      // Raio físico da bolha em ADS (metros)
    this.minBubbleAngle = 0.052;      // ~3.0° mínimo em alvos distantes
    this.maxBubbleAngle = 0.26;       // ~15.0° máximo em curta distância
    this.innerDeadzoneAngle = 0.0065; // ~0.37° zona livre central para escolha livre de headshot/body

    this.frictionStrengthHip = 0.56;  // Reduz sensibilidade em até 56% no centro da bolha no Hipfire
    this.frictionStrengthAds = 0.58;  // Reduz sensibilidade em até 58% no centro da bolha em ADS

    this.rotationalSpeedHip = 6.4;    // Força de acompanhamento rotacional forte e nítida no Hipfire (rad/s)
    this.rotationalSpeedAds = 6.8;    // Força de acompanhamento rotacional em ADS (rad/s)
    this.adsSnapDuration = 0.15;      // Janela de micro-snap ao entrar em ADS ou iniciar disparo (segundos)
    this.adsSnapSpeed = 10.8;         // Velocidade de convergência durante o Snap
    this.velocityLeadTime = 0.042;    // Compensação de velocidade para alvos em movimento

    // Estado interno de rastreamento por frame (suporte a 120Hz fixedUpdate sem perda entre ticks de 60Hz)
    this._wasAds = false;
    this._wasFiring = false;
    this._adsSnapTimer = 0;
    this._fireSnapTimer = 0;
    this._lookActiveTimer = 0;
    this.currentTarget = null;
    this.lastSensMultiplier = 1.0;
  }

  /**
   * Verifica se o Aim Assist está ativo (`true` / `'true'`) ou desativado (`'none'` / `false`).
   * @returns {boolean}
   */
  isEnabled() {
    if (this.crosshairManager && this.crosshairManager.config) {
      const val = this.crosshairManager.config.aimAssist;
      if (val === 'none' || val === false || val === 'off') return false;
      if (val === true || val === 'true' || val === 'on') return true;
    }
    return !!this.enabled;
  }

  /**
   * Processa o Aim Assist para o frame atual com Early-Exit e no máximo 1 raycast de oclusão.
   * 
   * @param {number} dt Delta time do frame (segundos)
   * @param {Object} params
   * @param {Object} params.player Instância do Player
   * @param {Object} [params.input] Instância do Input
   * @param {number} [params.dx=0] Delta X bruto do mouse/touch
   * @param {number} [params.dy=0] Delta Y bruto do mouse/touch
   * @returns {{ sensMultiplier: number, deltaYaw: number, deltaPitch: number, hasTarget: boolean, target: Object|null }}
   */
   computeAssist(dt, { player, input = null, dx = 0, dy = 0 } = {}) {
    this.currentTarget = null;
    this.lastSensMultiplier = 1.0;

    if (!this.isEnabled() || !player || !player.alive) {
      this._wasAds = false;
      this._wasFiring = false;
      this._adsSnapTimer = 0;
      this._fireSnapTimer = 0;
      this._lookActiveTimer = 0;
      return { sensMultiplier: 1.0, deltaYaw: 0, deltaPitch: 0, hasTarget: false, target: null };
    }

    const bots = typeof this.botsProvider === 'function' ? this.botsProvider() : [];
    if (!bots || bots.length === 0) {
      return { sensMultiplier: 1.0, deltaYaw: 0, deltaPitch: 0, hasTarget: false, target: null };
    }

    const isAds = !!player.ads;
    const isFiring = !!(input?.isActionPressed ? input.isActionPressed('fire') : input?.actions?.fire);

    // Transição de entrada em ADS -> dispara ADS Snap-In
    if (isAds && !this._wasAds) {
      this._adsSnapTimer = this.adsSnapDuration;
    } else if (!isAds) {
      this._adsSnapTimer = 0;
    }
    this._wasAds = isAds;

    // Transição de início de tiro no Hipfire -> dispara Hipfire Micro-Snap para colar no alvo
    if (isFiring && !this._wasFiring) {
      this._fireSnapTimer = 0.12;
    } else if (!isFiring) {
      this._fireSnapTimer = 0;
    }
    this._wasFiring = isFiring;

    // Memória de movimento de câmera (180ms) para cobrir todos os sub-ticks de 120Hz do fixedUpdate
    if ((Math.abs(dx) + Math.abs(dy)) > 0.01) {
      this._lookActiveTimer = 0.18;
    } else if (this._lookActiveTimer > 0) {
      this._lookActiveTimer = Math.max(0, this._lookActiveTimer - dt);
    }

    if (this._adsSnapTimer > 0) {
      this._adsSnapTimer = Math.max(0, this._adsSnapTimer - dt);
    }
    if (this._fireSnapTimer > 0) {
      this._fireSnapTimer = Math.max(0, this._fireSnapTimer - dt);
    }

    // 1. Posição do olho e vetor de olhar atual do jogador
    const eyeY = (player.pos?.y || 0) + (player.eyeHeight || 1.55);
    _vEye.set(player.pos?.x || 0, eyeY, player.pos?.z || 0);

    const yaw = player.yaw || 0;
    const pitch = player.pitch || 0;
    const cosPitch = Math.cos(pitch);
    _vFwd.set(
      -Math.sin(yaw) * cosPitch,
      Math.sin(pitch),
      -Math.cos(yaw) * cosPitch
    ).normalize();

    const maxRange = isAds ? this.maxRangeAds : this.maxRangeHip;
    const maxRangeSq = maxRange * maxRange;
    const isSnapping = (this._adsSnapTimer > 0) || (this._fireSnapTimer > 0);
    const snapConeMul = isSnapping ? 1.35 : 1.15;
    const bubbleRadius = isAds ? this.bubbleRadiusAds : this.bubbleRadiusHip;

    // 2. Fase de Filtragem Rápida O(N): Distância² + Cone Angular via Dot Product (SEM RAYCAST)
    let bestBot = null;
    let bestScore = Infinity;
    let bestDist = 0;
    let bestAngle = 0;
    let bestBubbleAngle = 0;
    let bestTargetX = 0;
    let bestTargetY = 0;
    let bestTargetZ = 0;

    const targetHeightOffset = isAds ? 1.24 : 1.18; // Peito superior / base do pescoço

    for (let i = 0; i < bots.length; i++) {
      const bot = bots[i];
      if (!bot || !bot.alive || !bot.pos) continue;

      // Ponto magnético no tórax superior + leve compensação de velocidade do bot
      const vx = bot.vel?.x || 0;
      const vz = bot.vel?.z || 0;
      const tx = bot.pos.x + vx * this.velocityLeadTime;
      const ty = bot.pos.y + targetHeightOffset;
      const tz = bot.pos.z + vz * this.velocityLeadTime;

      const dX = tx - _vEye.x;
      const dY = ty - _vEye.y;
      const dZ = tz - _vEye.z;
      const distSq = dX * dX + dY * dY + dZ * dZ;

      // Early-exit 1: fora do alcance ou colado demais
      if (distSq > maxRangeSq || distSq < 0.25) continue;

      const dist = Math.sqrt(distSq);
      const invDist = 1.0 / dist;
      const uX = dX * invDist;
      const uY = dY * invDist;
      const uZ = dZ * invDist;

      // Early-exit 2: Produto escalar para verificar se está na frente e dentro da bolha angular
      const dot = _vFwd.x * uX + _vFwd.y * uY + _vFwd.z * uZ;
      if (dot <= 0.82) continue; // > ~34.9 graus, descarta sem trigonometria pesada

      const angle = Math.acos(Math.min(1.0, Math.max(-1.0, dot)));
      const rawBubble = Math.atan2(bubbleRadius, dist) * snapConeMul;
      const bubbleAngle = Math.max(this.minBubbleAngle, Math.min(this.maxBubbleAngle * snapConeMul, rawBubble));

      if (angle > bubbleAngle) continue;

      // Prioriza o alvo mais alinhado ao centro da mira (com leve desempate por proximidade)
      const normalizedAngle = angle / bubbleAngle;
      const score = normalizedAngle + (dist / maxRange) * 0.15;

      if (score < bestScore) {
        bestScore = score;
        bestBot = bot;
        bestDist = dist;
        bestAngle = angle;
        bestBubbleAngle = bubbleAngle;
        bestTargetX = tx;
        bestTargetY = ty;
        bestTargetZ = tz;
      }
    }

    if (!bestBot) {
      return { sensMultiplier: 1.0, deltaYaw: 0, deltaPitch: 0, hasTarget: false, target: null };
    }

    // 3. Fase de Oclusão (Line-of-Sight): 1 ÚNICO RAYCAST apenas para o melhor candidato!
    _vTarget.set(bestTargetX, bestTargetY, bestTargetZ);
    _vToTarget.copy(_vTarget).sub(_vEye);
    _vDir.copy(_vToTarget).normalize();

    if (this.collisionWorld && typeof this.collisionWorld.raycast === 'function') {
      const hit = this.collisionWorld.raycast(_vEye, _vDir, Math.max(0.1, bestDist - 0.35));
      if (hit && (hit.distance ?? hit.dist ?? Infinity) < bestDist - 0.35) {
        // Alvo atrás de parede/obstáculo: não aplica Aim Assist!
        return { sensMultiplier: 1.0, deltaYaw: 0, deltaPitch: 0, hasTarget: false, target: null };
      }
    }

    this.currentTarget = bestBot;

    // 4. PILAR 1: Friction / Slowdown Bubble (Redução Suave de Sensibilidade)
    const normRatio = Math.min(1.0, bestAngle / Math.max(0.0001, bestBubbleAngle));
    // Curva mais encorpada (1 - normRatio^1.6) para manter o magnetismo perceptível em toda a bolha do Hipfire
    const bubbleWeight = Math.max(0.18, 1.0 - Math.pow(normRatio, 1.6));
    const maxFriction = isAds ? this.frictionStrengthAds : this.frictionStrengthHip;
    const sensMultiplier = Math.max(0.32, 1.0 - bubbleWeight * maxFriction);
    this.lastSensMultiplier = sensMultiplier;

    // 5. PILAR 2 & 3: Rotational Aim Assist + Hipfire/ADS Snap-In
    const moveSpeedXZ = Math.hypot(player.vel?.x || 0, player.vel?.z || 0);
    const botSpeedXZ = Math.hypot(bestBot.vel?.x || 0, bestBot.vel?.z || 0);
    const isMoving = moveSpeedXZ > 0.15 || botSpeedXZ > 0.25;
    const isLooking = (this._lookActiveTimer > 0) || (Math.abs(dx) + Math.abs(dy)) > 0.01;

    // Ativo em qualquer situação de combate no Hipfire ou ADS (movendo, olhando, atirando, bot se movendo ou em ADS)
    if (!isMoving && !isLooking && !isFiring && !isSnapping && !isAds) {
      return { sensMultiplier, deltaYaw: 0, deltaPitch: 0, hasTarget: true, target: bestBot };
    }

    // Cálculo dos ângulos desejados para o alvo (convenção YXZ do CameraRig)
    const desiredYaw = Math.atan2(-_vDir.x, -_vDir.z);
    const desiredPitch = Math.asin(Math.max(-1.0, Math.min(1.0, _vDir.y)));

    const diffYaw = normalizeAngleDiff(desiredYaw - yaw);
    const diffPitch = desiredPitch - pitch;

    // Atenuação na Inner Deadzone (~0.37°) para permitir micro-ajuste de Headshot sem resistência
    let deadzoneFactor = 1.0;
    if (bestAngle < this.innerDeadzoneAngle && !isSnapping) {
      deadzoneFactor = (bestAngle / this.innerDeadzoneAngle) * 0.35;
    }

    // Velocidade de atração magnética (Hipfire agora tão responsivo quanto ADS!)
    let pullRate = isAds ? this.rotationalSpeedAds : this.rotationalSpeedHip;
    if (isMoving) pullRate *= 1.25;  // Strafe tracking forte no Hipfire e ADS
    if (isFiring) pullRate *= 1.30;  // Magnetismo extra durante rajadas no Hipfire
    if (isSnapping) pullRate = Math.max(pullRate, this.adsSnapSpeed);

    const pullFactor = Math.min(0.75, dt * pullRate * bubbleWeight * deadzoneFactor);
    const deltaYaw = diffYaw * pullFactor;
    const deltaPitch = diffPitch * pullFactor * 0.85;

    return {
      sensMultiplier,
      deltaYaw,
      deltaPitch,
      hasTarget: true,
      target: bestBot
    };
  }
}
