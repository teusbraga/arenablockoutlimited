import * as THREE from 'three';
import { WEAPONS } from './WeaponDefs.js';
import { buildHK416 } from './models/HK416.js';
import { buildP9 } from './models/P9.js';
import { buildUZI } from './models/UZI.js';
import { buildM249 } from './models/M249.js';
import { buildRiflePrototype } from './models/RiflePrototype.js';

// Re-exporta construtores para compatibilidade com main.js / WeaponRegistry
export { buildHK416, buildHK416 as buildAR15, buildP9, buildUZI, buildM249, buildRiflePrototype };

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

    // Blowback do ferrolho (0 = recuado, 1 = fechado)
    this._boltCycle = 1;
    this._boltGroup = null;          // sub-group do modelo ativo, se existir
    this._boltHomeZ = 0;             // posição Z de repouso do ferrolho
  }

  registerModel(weaponId, buildFn) {
    // Suporta builders que retornam Group diretamente OU { group, boltGroup }
    const result    = buildFn();
    const model     = result.group     ?? result;
    const boltGroup = result.boltGroup ?? null;

    model.visible = false;
    this.mount.add(model);
    this.models[weaponId] = { mesh: model, boltGroup };
  }

  equip(weaponId) {
    // Esconde todos os modelos
    for (const k in this.models) this.models[k].mesh.visible = false;

    // Resolve entrada (suporta estrutura { mesh, boltGroup })
    const entry = this.models[weaponId]
      || this.models['ar15']
      || Object.values(this.models)[0];

    if (entry) {
      entry.mesh.visible = true;
      this.activeModel = entry.mesh;

      // Configura ferrolho para blowback (se o modelo tiver boltGroup)
      this._boltGroup  = entry.boltGroup ?? null;
      this._boltHomeZ  = this._boltGroup ? this._boltGroup.position.z : 0;
      this._boltCycle  = 1;   // começa fechado

      // Inicia transição suave de saque (Draw animation subindo do coldre)
      this.drawAmount = 1.0;
    }
  }

  applyKick(pitch, yaw, customKickbackZ = 0.008, customKickRot = 1.5, isADS = false) {
    // Cano sobe: rotação positiva em X eleva a ponta do cano e apoia a coronha
    const rotScale = isADS ? 0.35 : 1.0;
    const posScale = isADS ? 0.30 : 1.0;

    this.kickRotX += Math.max(pitch * customKickRot * rotScale, 0.015 * rotScale);
    // Limite máximo de rotação do cano (nunca aponta para o céu, mantendo mira no horizonte)
    this.kickRotX = Math.min(this.kickRotX, isADS ? 0.035 : 0.075);

    // Recuo seco para trás (ombro firme com osso, arma NÃO afunda na cara do jogador)
    this.kickPos.z += customKickbackZ * posScale;
    this.kickPos.z = Math.min(this.kickPos.z, isADS ? 0.003 : 0.008);
  }

  /**
   * Atualiza a física de mola e oscilação orgânica da arma baseado no movimento e respiração.
   * Suave e discreto para não prejudicar a mira ou causar enjoo.
   */
  applySwayFromLook(dt, yaw, pitch, isADS, isSprinting, playerVel) {
    let dYaw = yaw - this.lastYaw;
    let dPitch = pitch - this.lastPitch;

    // Corrige saltos de rotação em 360°
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;

    this.lastYaw = yaw;
    this.lastPitch = pitch;

    // No ADS, o sway é reduzido a quase zero (estabilização tática)
    const adsMul = isADS ? 0.06 : 0.70;
    const sprintMul = isSprinting ? 1.3 : 1.0;
    const mul = adsMul * sprintMul;

    // Mouse Sway suave com retorno amortecido
    this.swayVel.x += (-dYaw   * 12 - this.swayPos.x * 22 - this.swayVel.x * 9) * mul * dt;
    this.swayVel.y += ( dPitch * 12 - this.swayPos.y * 22 - this.swayVel.y * 9) * mul * dt;
    this.swayPos.x += this.swayVel.x * dt;
    this.swayPos.y += this.swayVel.y * dt;

    // Walking Bob suave
    const speed = Math.hypot(playerVel.x, playerVel.z);
    const time = performance.now() / 1000;
    
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

    // Aplica Rotações no grupo de sway
    this.swayGroup.rotation.y = this.swayPos.x * 0.5 + idleRotY;
    this.swayGroup.rotation.x = this.swayPos.y * 0.5 + idleRotX;
    this.swayGroup.rotation.z = -this.swayPos.x * 0.25;
    
    // Aplica Posições
    this.swayGroup.position.x = this.swayPos.x * 0.10 + bobX + idlePosX;
    this.swayGroup.position.y = this.swayPos.y * 0.10 + bobY + idlePosY - (speed > 0.1 ? 0.005 : 0);

    const mag = Math.hypot(this.swayPos.x, this.swayPos.y);
    this.smoothMag += (mag - this.smoothMag) * Math.min(dt * 6, 1);
  }

  getSpreadFromSway() { 
    return Math.min(this.smoothMag * 0.05, 0.012); 
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

    // Interpola a pose base (sem somar offsets de recoil diretamente na pose base)
    const k = Math.min(dt * (isADS ? (12 + adsAmount * 12) : 10), 1);
    this.basePos.x += (tPos[0] - this.basePos.x) * k;
    this.basePos.y += (tPos[1] - this.basePos.y) * k;
    this.basePos.z += (tPos[2] - this.basePos.z) * k;

    this.baseRot.x += (tRot[0] - this.baseRot.x) * k;
    this.baseRot.y += (tRot[1] - this.baseRot.y) * k;
    this.baseRot.z += (tRot[2] - this.baseRot.z) * k;

    // Recoil decai rapidamente de forma exponencial para a posição neutra
    const decay = Math.exp(-dt * 24);
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

    // ── Blowback do ferrolho ─────────────────────────────────────────────
    // Anima o boltGroup do modelo ativo (só existe no RiflePrototype por ora).
    // _boltCycle: 0 = tiro acabou de sair (recuado), 1 = fechado / repouso.
    if (this._boltGroup) {
      if (this._boltCycle < 1) {
        // Avança o ciclo — mesma velocidade do protótipo original (~85ms)
        this._boltCycle = Math.min(1, this._boltCycle + dt / 0.085);
      }
      // Offset em Z (eixo local do modelo, que é o X original rotacionado)
      // sin(π·k) faz o ferrolho recuar e voltar suavemente
      const boltOffset = this._boltCycle < 1
        ? 0.085 * Math.sin(Math.PI * this._boltCycle)
        : 0;
      this._boltGroup.position.z = this._boltHomeZ + boltOffset;
    }
  }

  /**
   * Dispara o ciclo de blowback do ferrolho.
   * Chamado por WeaponSystem._fire() a cada tiro.
   */
  triggerBlowback() {
    this._boltCycle = 0;
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