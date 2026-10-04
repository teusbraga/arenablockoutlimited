import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { buildHK416 } from './models/HK416.js';
import { buildP9 } from './models/P9.js';
import { buildUZI } from './models/UZI.js';
import { buildM249 } from './models/M249.js';
import { buildRiflePrototype } from './models/RiflePrototype.js';
import { buildAK47 } from './models/AK47.js';
import { buildSW500 } from './models/SW500.js';
import { buildWinchester1912 } from './models/Winchester1912.js';

// Re-exporta construtores para compatibilidade com main.js / WeaponRegistry
export { buildHK416, buildHK416 as buildAR15, buildP9, buildUZI, buildM249, buildRiflePrototype, buildAK47, buildSW500, buildWinchester1912, buildWinchester1912 as buildM12 };

/**
 * Viewmodel: Gerenciador de pose, física de mola (sway), recuo e animações da arma em 1ª pessoa.
 * Completamente desacoplado dos detalhes de malha geométrica.
 */
export class Viewmodel {
  constructor(camera) {
    this.camera = camera;

    // Grupo raiz de oscilação física (Sway / Bobbing / Breathing)
    this.swayGroup = new THREE.Group();
    camera.add(this.swayGroup);

    // Ponto de montagem da arma ativa (Pose / Recoil / Draw)
    this.mount = new THREE.Group();
    this.swayGroup.add(this.mount);

    // Muzzle Flash Light dinâmico
    this.flashLight = new THREE.PointLight(0xffaa55, 0, 8, 1.6);
    this.flashLight.position.set(0, 0.02, -0.5);
    this.mount.add(this.flashLight);

    // Transição suave de saque (Draw animation)
    this.drawAmount = 0;

    // Spring-Damper mouse sway
    this.swayPos = new THREE.Vector2();
    this.swayVel = new THREE.Vector2();
    this.lastYaw = 0;
    this.lastPitch = 0;
    this.smoothMag = 0;

    // Recoil físico reativo (ombro firme, cano sobe e volta rápido)
    this.kickPos = new THREE.Vector3();
    this.kickRotX = 0;
    this.basePos = new THREE.Vector3();
    this.baseRot = new THREE.Vector3();

    // Registro de modelos disponíveis
    this.models = {};
    this.activeModel = null;
    this.activePhysics = null;
  }

  registerModel(weaponId, buildFn) {
    const result  = buildFn();
    const model   = result.group   ?? result;
    const physics = result.physics ?? null;

    model.visible = false;
    this.mount.add(model);
    this.models[weaponId] = { mesh: model, physics, details: result };
  }

  equip(weaponId) {
    // Esconde todos os modelos
    for (const k in this.models) this.models[k].mesh.visible = false;

    // Resolve entrada
    const entry = this.models[weaponId]
      || this.models['ar15']
      || Object.values(this.models)[0];

    if (entry) {
      entry.mesh.visible = true;
      this.activeModel = entry.mesh;
      this.activePhysics = entry.physics ?? null;

      // Inicia transição suave de saque
      this.drawAmount = 1.0;
    }
  }

  triggerFire(ammo = 30) {
    if (this.activePhysics) {
      this.activePhysics.onFire(ammo);
    }
  }

  triggerReload() {
    if (this.activePhysics) {
      this.activePhysics.onReload();
    }
  }

  getShake() {
    return this.activePhysics ? this.activePhysics.shake : 0;
  }

  applyKick(pitch, yaw, customKickbackZ = 0.008, customKickRot = 1.5, isADS = false) {
    // Se o modelo ativo tiver física própria (como o RiflePrototype), ela já gerencia os vetores de recuo
    if (this.activePhysics) return;

    // Cano sobe: rotação positiva em X eleva a ponta do cano e apoia a coronha
    const rotScale = isADS ? 0.35 : 1.0;
    const posScale = isADS ? 0.30 : 1.0;

    this.kickRotX += Math.max(pitch * customKickRot * rotScale, 0.015 * rotScale);
    this.kickRotX = Math.min(this.kickRotX, isADS ? 0.035 : 0.075);

    this.kickPos.z += customKickbackZ * posScale;
    this.kickPos.z = Math.min(this.kickPos.z, isADS ? 0.003 : 0.008);
  }

  /**
   * Layer 3: Atualiza a física de mola e oscilação orgânica do Viewmodel baseado na velocidade angular
   * do CameraRig (Layer 1/2) e na locomoção do jogador.
   */
  applySwayFromRig(rig, dt, isADS, isSprinting, playerVel, weaponDef) {
    // No ADS, o sway mantém inércia tática suave (sensação física de peso e paralaxe)
    const adsMul = isADS ? 0.18 : 0.55;
    const sprintMul = isSprinting ? 1.25 : 1.0;
    const mul = adsMul * sprintMul;

    // Velocidade angular do olhar (rad/s) fornecida diretamente pela Layer 1/2
    const lookSpeedX = rig?.angularVelocity ? rig.angularVelocity.y : 0;
    const lookSpeedY = rig?.angularVelocity ? rig.angularVelocity.x : 0;

    // Fator de Massa e Peso da Arma (normalizado em torno de 3.5 kg de um rifle padrão)
    const weight = (weaponDef && weaponDef.weight) ? weaponDef.weight : 3.5;
    const massFactor = Math.max(0.25, Math.min(2.6, weight / 3.5));
    const inertiaMul = Math.sqrt(massFactor);

    // Rigidez e Amortecimento da Mola:
    // - Armas leves (pistolas/SMGs) são ágeis e têm alta frequência de retorno elástico (snappy).
    // - Armas pesadas (fuzis pesados/LMGs) têm inércia maior e retorno com elasticidade mais cadenciada e pesada.
    const springK = 22.0 / Math.pow(massFactor, 0.45);
    const springD = 9.5 / Math.pow(massFactor, 0.35);

    // Força cinética do olhar reduzida em 60% para amplitude contida e tática
    const forceGain = 1.0;
    const targetForceX = lookSpeedX * forceGain * mul * inertiaMul;
    const targetForceY = -lookSpeedY * forceGain * mul * inertiaMul;

    // Mouse Sway suave com retorno amortecido dependente da massa
    this.swayVel.x += (targetForceX - this.swayPos.x * springK - this.swayVel.x * springD) * dt;
    this.swayVel.y += (targetForceY - this.swayPos.y * springK - this.swayVel.y * springD) * dt;
    this.swayPos.x += this.swayVel.x * dt;
    this.swayPos.y += this.swayVel.y * dt;

    // Limites de segurança contidos para evitar amplitude excessiva
    const maxSway = isADS ? 0.035 : 0.085;
    this.swayPos.x = THREE.MathUtils.clamp(this.swayPos.x, -maxSway, maxSway);
    this.swayPos.y = THREE.MathUtils.clamp(this.swayPos.y, -maxSway, maxSway);

    // Walking Bob suave
    const speed = playerVel ? Math.hypot(playerVel.x, playerVel.z) : 0;
    const time = performance.now() * 0.001;
    
    const bobFreq = speed > 0.1 ? (isSprinting ? 11 : 7.5) : 0;
    const bobAmt = (speed > 0.1 ? (isSprinting ? 0.018 : 0.009) : 0) * (isADS ? 0.15 : 1);
    
    const bobX = Math.sin(time * bobFreq) * bobAmt;
    const bobY = Math.abs(Math.cos(time * bobFreq)) * bobAmt;

    // Respiração suave (ADS praticamente estático)
    let idleRotX, idleRotY, idlePosX, idlePosY;
    if (isADS) {
      idleRotY = Math.sin(time * 1.5) * 0.0015;
      idleRotX = Math.cos(time * 1.2) * 0.0015;
      idlePosX = Math.sin(time * 1.5) * 0.0004;
      idlePosY = Math.cos(time * 1.2) * 0.0004;
    } else {
      idleRotY = Math.sin(time * 1.4) * 0.005;
      idleRotX = Math.cos(time * 1.1) * 0.005;
      idlePosX = Math.sin(time * 1.4) * 0.002;
      idlePosY = Math.cos(time * 1.1) * 0.002;
    }

    // Aplica Rotações no grupo de sway (amplitude reduzida em 60%):
    // - rotation.y: cano acompanha inércia virando na direção de atraso
    // - rotation.x: cano sobe ou desce com o olhar vertical
    // - rotation.z: inclinação (banking) orgânica na direção do movimento
    this.swayGroup.rotation.y = -this.swayPos.x * 0.45 + idleRotY;
    this.swayGroup.rotation.x = this.swayPos.y * 0.45 + idleRotX;
    this.swayGroup.rotation.z = this.swayPos.x * 0.20;
    
    // Aplica Posições (amplitude linear contida e controlada)
    this.swayGroup.position.x = this.swayPos.x * 0.18 + bobX + idlePosX;
    this.swayGroup.position.y = this.swayPos.y * 0.18 + bobY + idlePosY - (speed > 0.1 ? 0.005 : 0);

    const mag = Math.hypot(this.swayPos.x, this.swayPos.y);
    this.smoothMag += (mag - this.smoothMag) * Math.min(dt * 6, 1);
  }

  /**
   * Adaptador para compatibilidade com chamadas legadas
   */
  applySwayFromLook(dt, yawOrRig, pitch, isADS, isSprinting, playerVel, weaponDef) {
    if (yawOrRig && typeof yawOrRig === 'object' && yawOrRig.angularVelocity) {
      return this.applySwayFromRig(yawOrRig, dt, pitch, isADS, isSprinting, playerVel);
    }
    let dYaw = (yawOrRig || 0) - this.lastYaw;
    let dPitch = (pitch || 0) - this.lastPitch;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    this.lastYaw = yawOrRig || 0;
    this.lastPitch = pitch || 0;
    const fakeRig = {
      angularVelocity: {
        x: dt > 0 ? (dPitch / dt) : 0,
        y: dt > 0 ? (dYaw / dt) : 0
      }
    };
    return this.applySwayFromRig(fakeRig, dt, isADS, isSprinting, playerVel, weaponDef);
  }

  getSpreadFromSway() { 
    return Math.min(this.smoothMag * 0.05, 0.012); 
  }

  /**
   * Interpolação suave entre poses táticas (Hipfire, ADS, Sprint, Reload e Draw)
   */
  updatePose(dt, weaponId, { isADS, isSprinting, adsAmount, reloadProgress, ammo }) {
    const def = WEAPONS[weaponId];
    if (!def) return;
    const mount = this.mount;

    // Escolhe pose alvo
    let tPos = def.hipPos, tRot = def.hipRot;
    if (isADS) { tPos = this._adsPos(def); tRot = def.adsRot; }
    else if (isSprinting) { tPos = def.sprintPos; tRot = def.sprintRot; }

    // Interpola a pose base (sem somar offsets de recoil diretamente na pose base)
    const k = Math.min(dt * (isADS ? (12 + adsAmount * 12) : 10), 1);
    this.basePos.x += (tPos[0] - this.basePos.x) * k;
    this.basePos.y += (tPos[1] - this.basePos.y) * k;
    this.basePos.z += (tPos[2] - this.basePos.z) * k;

    this.baseRot.x += (tRot[0] - this.baseRot.x) * k;
    this.baseRot.y += (tRot[1] - this.baseRot.y) * k;
    this.baseRot.z += (tRot[2] - this.baseRot.z) * k;

    // Recoil decai dependente do peso da arma (armas leves voltam rápido; armas pesadas têm recuperação cadenciada)
    const weight = def.weight || 3.5;
    const massFactor = Math.max(0.25, Math.min(2.6, weight / 3.5));
    const kickDecaySpeed = 24.0 / Math.pow(massFactor, 0.35);
    const decay = Math.exp(-dt * kickDecaySpeed);
    this.kickPos.z *= decay;
    this.kickRotX  *= decay;

    // Atribui posição combinada final: pose base + recoil offset
    mount.position.x = this.basePos.x;
    mount.position.y = this.basePos.y;
    mount.position.z = this.basePos.z + this.kickPos.z;

    mount.rotation.x = this.baseRot.x + this.kickRotX;
    mount.rotation.y = this.baseRot.y;
    mount.rotation.z = this.baseRot.z;

    // Animação de Recarregamento (Reload Dip suave)
    if (reloadProgress > 0) {
      const dip = Math.sin(reloadProgress * Math.PI);
      mount.position.y -= dip * 0.12;
      mount.rotation.x += dip * 0.40;
    }

    // Transição suave de saque (Draw animation)
    if (this.drawAmount > 0) {
      this.drawAmount = Math.max(0, this.drawAmount - dt * 5.0);
      const ease = Math.pow(this.drawAmount, 2);
      mount.position.y -= ease * 0.18;
      mount.rotation.x -= ease * 0.35;
      mount.rotation.z += ease * 0.15;
    }

    // Executa a física de recoil elástico, blowback, câmara vazia e muzzle flash originais do protótipo
    if (this.activePhysics) {
      this.activePhysics.update(dt, this.camera, ammo ?? 30);
    }
  }

  _adsPos(def) {
    const [sx, sy, sz] = def.sightLocal || [0, 0, -0.2];
    const d = def.adsSightDistance || 0.26;
    return [-sx, -sy, -d - sz];

  }

  flash() {
    if (this.activePhysics) return;
    this.flashLight.intensity = 7 + Math.random() * 4;
  }

  decayFlash(dt) {
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 32);
    }
  }
}