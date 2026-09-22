import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { buildHK416 } from './models/HK416.js';
import { buildP9 } from './models/P9.js';

// Re-exporta construtores para compatibilidade com main.js / WeaponRegistry
export { buildHK416, buildHK416 as buildAR15, buildP9 };

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

    // Recoil físico reativo
    this.kickPos = new THREE.Vector3();
    this.kickRotX = 0;

    // Registro de modelos disponíveis
    this.models = {};
    this.activeModel = null;
  }

  registerModel(weaponId, buildFn) {
    const model = buildFn();
    model.visible = false;
    this.mount.add(model);
    this.models[weaponId] = model;
  }

  equip(weaponId) {
    for (const k in this.models) this.models[k].visible = false;
    // Usa o modelo registrado ou faz fallback para não ficar invisível
    this.activeModel = this.models[weaponId] || this.models['ar15'] || Object.values(this.models)[0];
    if (this.activeModel) {
      this.activeModel.visible = true;
      // Inicia transição suave de saque (Draw animation subindo do coldre)
      this.drawAmount = 1.0;
    }
  }

  applyKick(pitch, yaw) {
    this.kickRotX -= pitch * 2.2;
    this.kickPos.z += 0.035;
  }

  /**
   * Atualiza a física de mola e oscilação orgânica da arma baseado no movimento e respiração.
   */
  applySwayFromLook(dt, yaw, pitch, isADS, isSprinting, playerVel) {
    let dYaw = yaw - this.lastYaw;
    let dPitch = pitch - this.lastPitch;

    // Corrige saltos de rotação em 360°
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;

    this.lastYaw = yaw;
    this.lastPitch = pitch;

    const adsMul = isADS ? 0.1 : 1;
    const sprintMul = isSprinting ? 1.5 : 1;
    const mul = adsMul * sprintMul;

    // Mouse Sway (Mola amortecida - Spring-Damper)
    this.swayVel.x += (-dYaw   * 15 - this.swayPos.x * 25 - this.swayVel.x * 8) * mul * dt;
    this.swayVel.y += ( dPitch * 15 - this.swayPos.y * 25 - this.swayVel.y * 8) * mul * dt;
    this.swayPos.x += this.swayVel.x * dt;
    this.swayPos.y += this.swayVel.y * dt;

    // Walking Bob (Trajetória orgânica em 8 ao andar/correr)
    const speed = Math.hypot(playerVel.x, playerVel.z);
    const time = performance.now() / 1000;
    
    const bobFreq = speed > 0.1 ? (isSprinting ? 12 : 8) : 0;
    const bobAmt = (speed > 0.1 ? (isSprinting ? 0.03 : 0.015) : 0) * (isADS ? 0.25 : 1);
    
    const bobX = Math.sin(time * bobFreq) * bobAmt;
    const bobY = Math.abs(Math.cos(time * bobFreq)) * bobAmt;

    // Oscilação de Respiração / ADS Float (Curva multi-harmônica de Lissajous)
    let idleRotX, idleRotY, idlePosX, idlePosY;
    if (isADS) {
      idleRotY = (Math.sin(time * 1.8) * 0.007 + Math.sin(time * 3.1) * 0.003);
      idleRotX = (Math.cos(time * 1.3) * 0.006 + Math.cos(time * 2.7) * 0.002);
      idlePosX = Math.sin(time * 1.8) * 0.0018;
      idlePosY = Math.cos(time * 1.3) * 0.0014;
    } else {
      idleRotY = Math.sin(time * 1.5) * 0.008;
      idleRotX = Math.cos(time * 1.2) * 0.008;
      idlePosX = Math.sin(time * 1.5) * 0.003;
      idlePosY = Math.cos(time * 1.2) * 0.003;
    }

    // Aplica Rotações
    this.swayGroup.rotation.y = this.swayPos.x * 0.7 + idleRotY;
    this.swayGroup.rotation.x = this.swayPos.y * 0.7 + idleRotX;
    this.swayGroup.rotation.z = -this.swayPos.x * 0.4;
    
    // Aplica Posições (Bobbing + Sway offset + ADS Float)
    this.swayGroup.position.x = this.swayPos.x * 0.15 + bobX + idlePosX;
    this.swayGroup.position.y = this.swayPos.y * 0.15 + bobY + idlePosY - (speed > 0.1 ? 0.01 : 0);

    const mag = Math.hypot(this.swayPos.x, this.swayPos.y);
    this.smoothMag += (mag - this.smoothMag) * Math.min(dt * 6, 1);
  }

  getSpreadFromSway() { 
    return Math.min(this.smoothMag * 0.12, 0.024); 
  }

  /**
   * Interpolação suave entre poses táticas (Hipfire, ADS, Sprint, Reload e Draw)
   */
  updatePose(dt, weaponId, { isADS, isSprinting, adsAmount, reloadProgress }) {
    const def = WEAPONS[weaponId];
    if (!def) return;
    const mount = this.mount;

    // Escolhe pose alvo
    let tPos = def.hipPos, tRot = def.hipRot;
    if (isADS) { tPos = this._adsPos(def); tRot = def.adsRot; }
    else if (isSprinting) { tPos = def.sprintPos; tRot = def.sprintRot; }

    const k = Math.min(dt * (isADS ? (8 + adsAmount * 14) : 9), 1);
    mount.position.x += (tPos[0] - mount.position.x) * k;
    mount.position.y += (tPos[1] - mount.position.y) * k;
    mount.position.z += (tPos[2] - mount.position.z) * k;
    mount.rotation.x += (tRot[0] - mount.rotation.x) * k;
    mount.rotation.y += (tRot[1] - mount.rotation.y) * k;
    mount.rotation.z += (tRot[2] - mount.rotation.z) * k;

    // Recoil decai suavemente
    this.kickPos.z *= Math.max(0, 1 - dt * 14);
    this.kickRotX *= Math.max(0, 1 - dt * 14);
    mount.position.z += this.kickPos.z;
    mount.rotation.x += this.kickRotX;

    // Animação de Recarregamento (Reload Dip)
    if (reloadProgress > 0) {
      const dip = Math.sin(reloadProgress * Math.PI);
      mount.position.y -= dip * 0.16;
      mount.rotation.x += dip * 0.55;
    }

    // Transição suave de saque (Draw animation)
    if (this.drawAmount > 0) {
      this.drawAmount = Math.max(0, this.drawAmount - dt * 4.5);
      const ease = Math.pow(this.drawAmount, 2);
      mount.position.y -= ease * 0.22;
      mount.rotation.x -= ease * 0.45;
      mount.rotation.z += ease * 0.20;
    }
  }

  _adsPos(def) {
    const [sx, sy, sz] = def.sightLocal || [0, 0, -0.2];
    const d = def.adsSightDistance || 0.26;
    return [-sx, -sy, -d - sz];
  }

  flash() {
    this.flashLight.intensity = 7 + Math.random() * 4;
  }

  decayFlash(dt) {
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 32);
    }
  }
}