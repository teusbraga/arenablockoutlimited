import * as THREE from 'three';
import { CONFIG } from '../core/ConfigLoader.js';
import { WEAPONS } from './WeaponDefs.js';
import { buildHK416 } from './models/HK416.js';
import { buildP9 } from './models/P9.js';
import { buildUZI } from './models/UZI.js';
import { buildM249 } from './models/M249.js';
import { buildRiflePrototype } from './models/RiflePrototype.js';
import { buildAK47 } from './models/AK47.js';
import { buildSW500 } from './models/SW500.js';
import { buildWinchester1912 } from './models/Winchester1912.js';
import { buildVSS } from './models/VSS.js';
import { buildSCARH } from './models/SCARH.js';

import { LocomotionSmoothingSystem } from '../new_mechanics/LocomotionSmoothingSystem.js';

// Re-exporta construtores para compatibilidade com main.js / WeaponRegistry
export { buildHK416, buildHK416 as buildAR15, buildP9, buildUZI, buildM249, buildRiflePrototype, buildAK47, buildSW500, buildWinchester1912, buildWinchester1912 as buildM12, buildVSS, buildSCARH };

// Fallback de segurança para mocks sem sfx compilado
const FALLBACK_FLASH_SIZES = {
  'ar15': 0.25,
  'hk416': 0.25,
  'ak47': 0.25,
  'scar_h': 0.38,
  'scar': 0.38,
  'rifle_proto': 0.38,
  'uzi': 0.34,
  'sw500': 0.52,
  'm249': 0.56,
  'vss': 0,
  'p9': 0,
  'm12': 0
};

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
    this.flashLight = new THREE.PointLight(0xff9922, 0, 5, 2.0);
    this.flashLight.position.set(0, 0.02, -0.5);
    this.mount.add(this.flashLight);

    // Muzzle Flash Mesh volumétrico cruzado (Padrão VSS Glow - 2 Planos Ortogonais Cruzados)
    this.flashGroup = new THREE.Group();
    
    this.flashTex = this._createVSSGlowTexture();
    this.flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd88a,
      map: this.flashTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    
    const flashGeo = new THREE.PlaneGeometry(1, 1);
    this.flashMesh1 = new THREE.Mesh(flashGeo, this.flashMat);
    this.flashMesh2 = new THREE.Mesh(flashGeo, this.flashMat);
    this.flashMesh2.rotation.x = Math.PI / 2;
    
    this.flashGroup.add(this.flashMesh1);
    this.flashGroup.add(this.flashMesh2);
    this.flashGroup.visible = false;
    this.mount.add(this.flashGroup);

    this.flashTimer = 0;
    this.flashDuration = 0.055;
    this.flashMaxOpacity = 0.90;

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

    // Sistema de suavização de locomoção e transição de poses contínuas
    this.locomotion = new LocomotionSmoothingSystem();
  }

  _createVSSGlowTexture() {
    if (typeof document === 'undefined') return new THREE.Texture();
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.20, 'rgba(255,240,180,0.95)');
    g.addColorStop(0.45, 'rgba(255,160,50,0.45)');
    g.addColorStop(0.75, 'rgba(255,80,10,0.12)');
    g.addColorStop(1.00, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /* ============================================================
     GAVETA: Antigo Muzzle Flash Estilizado em Chama (Legado)
     ============================================================
  _createMuzzleFlashTexture() {
    if (typeof document === 'undefined') return new THREE.Texture();
    const w = 64, h = 128;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h;
    const grad = ctx.createRadialGradient(cx, cy - 10, 0, cx, cy - 20, h);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.1, 'rgba(255, 240, 150, 0.9)');
    grad.addColorStop(0.3, 'rgba(255, 120, 30, 0.6)');
    grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, 0); 
    ctx.quadraticCurveTo(w, h - 30, cx, h);
    ctx.quadraticCurveTo(0, h - 30, cx, 0);
    ctx.fill();
    const coreGrad = ctx.createRadialGradient(cx, cy - 5, 0, cx, cy - 10, h/2.5);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    coreGrad.addColorStop(0.3, 'rgba(200, 240, 255, 0.8)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(cx, h / 3);
    ctx.quadraticCurveTo(cx + 12, h - 15, cx, h);
    ctx.quadraticCurveTo(cx - 12, h - 15, cx, h / 3);
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  */

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
  applySwayFromRig(rig, dt, isADS, isSprinting, playerVel, weaponDef, options = {}) {
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

    // Atualiza o sistema unificado de locomoção contínua (elimina estalo de fase e degraus)
    const speed = playerVel ? Math.hypot(playerVel.x, playerVel.z) : 0;
    this.locomotion.update(dt, {
      speedXZ: speed,
      isSprinting,
      isCrouched: options?.isCrouched ?? false,
      isADS,
      adsAmount: options?.adsAmount ?? (isADS ? 1.0 : 0.0),
    });

    const bobScale = CONFIG.ACCESSIBILITY?.headbobScale ?? 1.0;
    const { x: bobX, y: bobY } = this.locomotion.getWeaponBob(bobScale);

    // Respiração suave ponderada pelo peso de repouso (desaparece gradualmente na corrida)
    const time = performance.now() * 0.001;
    const idleWeight = this.locomotion.idleWeight;
    let idleRotX, idleRotY, idlePosX, idlePosY;
    if (isADS) {
      idleRotY = Math.sin(time * 1.5) * 0.0015 * idleWeight;
      idleRotX = Math.cos(time * 1.2) * 0.0015 * idleWeight;
      idlePosX = Math.sin(time * 1.5) * 0.0004 * idleWeight;
      idlePosY = Math.cos(time * 1.2) * 0.0004 * idleWeight;
    } else {
      idleRotY = Math.sin(time * 1.4) * 0.005 * idleWeight;
      idleRotX = Math.cos(time * 1.1) * 0.005 * idleWeight;
      idlePosX = Math.sin(time * 1.4) * 0.002 * idleWeight;
      idlePosY = Math.cos(time * 1.1) * 0.002 * idleWeight;
    }

    // Aplica Rotações no grupo de sway:
    // - rotation.y: cano acompanha inércia virando na direção de atraso
    // - rotation.x: cano sobe ou desce com o olhar vertical + inércia de arrancada/frenagem
    // - rotation.z: inclinação (banking) orgânica na direção do movimento
    this.swayGroup.rotation.y = -this.swayPos.x * 0.45 + idleRotY;
    this.swayGroup.rotation.x = this.swayPos.y * 0.45 + idleRotX + this.locomotion.accelInertiaPitch;
    this.swayGroup.rotation.z = this.swayPos.x * 0.20;
    
    // Aplica Posições (bobbing com fase 100% contínua + offset suavizado + inércia longitudinal Z)
    this.swayGroup.position.x = this.swayPos.x * 0.18 + bobX + idlePosX;
    this.swayGroup.position.y = this.swayPos.y * 0.18 + bobY + idlePosY + this.locomotion.locoOffsetY;
    this.swayGroup.position.z = this.locomotion.accelInertiaZ;

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
  updatePose(dt, weaponId, { isADS, isSprinting, adsAmount, reloadProgress, ammo, wallCompression = 0 }) {
    const def = WEAPONS[weaponId];
    if (!def) return;
    const mount = this.mount;

    const hipPos = def.hipPos;
    const hipRot = def.hipRot;
    const adsPos = this._adsPos(def);
    const adsRot = def.adsRot;
    const sprintPos = def.sprintPos || hipPos;
    const sprintRot = def.sprintRot || hipRot;

    // Alvo de pose:
    // No ADS, mira diretamente no sight (sem duplo amortecimento com adsAmount),
    // restaurando o tempo exato e ágil de abertura de mira original.
    let tPosX, tPosY, tPosZ, tRotX, tRotY, tRotZ;
    if (isADS) {
      tPosX = adsPos[0];
      tPosY = adsPos[1];
      tPosZ = adsPos[2];
      tRotX = adsRot[0];
      tRotY = adsRot[1];
      tRotZ = adsRot[2];
    } else {
      // Fora do ADS, faz o blend ponderado contínuo entre Hipfire e Sprint (70-90ms)
      const sprintW = this.locomotion ? this.locomotion.sprintWeight : (isSprinting ? 1.0 : 0.0);
      const hipW = Math.max(0.0, 1.0 - sprintW);
      tPosX = hipPos[0] * hipW + sprintPos[0] * sprintW;
      tPosY = hipPos[1] * hipW + sprintPos[1] * sprintW;
      tPosZ = hipPos[2] * hipW + sprintPos[2] * sprintW;

      tRotX = hipRot[0] * hipW + sprintRot[0] * sprintW;
      tRotY = hipRot[1] * hipW + sprintRot[1] * sprintW;
      tRotZ = hipRot[2] * hipW + sprintRot[2] * sprintW;
    }

    // Interpolação ágil e tática da pose base (resposta de ADS idêntica à original)
    const curAdsAmount = adsAmount !== undefined ? adsAmount : (isADS ? 1.0 : 0.0);
    const k = Math.min(dt * (isADS ? (16.0 + curAdsAmount * 14.0) : 24.0), 1.0);
    this.basePos.x += (tPosX - this.basePos.x) * k;
    this.basePos.y += (tPosY - this.basePos.y) * k;
    this.basePos.z += (tPosZ - this.basePos.z) * k;

    this.baseRot.x += (tRotX - this.baseRot.x) * k;
    this.baseRot.y += (tRotY - this.baseRot.y) * k;
    this.baseRot.z += (tRotZ - this.baseRot.z) * k;

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

    // Weapon Wall Press (Cano da arma pressionado contra obstáculo)
    // Cano sobe ~75° (1.31 rad) e vira ~15° (-0.26 rad) em direção ao ombro/jogador
    if (wallCompression > 0.001) {
      mount.position.z += wallCompression * 0.20;
      mount.position.y += wallCompression * 0.08;
      mount.position.x -= wallCompression * 0.03;
      mount.rotation.x += wallCompression * 1.31;  // +75 graus para cima
      mount.rotation.y -= wallCompression * 0.26;  // -15 graus (aponta levemente para o peito/jogador)
      mount.rotation.z += wallCompression * 0.12;  // banking natural
    }

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

  flash(def) {
    const wepId = def?.id || '';
    const flashConfig = def?.sfx?.flash;
    let enabled = true;
    let baseSize = 0.25;

    if (flashConfig) {
      enabled = flashConfig.enabled !== false;
      baseSize = enabled ? (flashConfig.size ?? 0.25) : 0;
    } else if (FALLBACK_FLASH_SIZES[wepId] !== undefined) {
      baseSize = FALLBACK_FLASH_SIZES[wepId];
      enabled = baseSize > 0;
    }

    // Se a arma não tem flash (VSS silenciada, P9, M12, etc.), garante que fique oculto
    if (!enabled || baseSize <= 0) {
      this.flashGroup.visible = false;
      this.flashLight.intensity = 0;
      this.flashTimer = 0;
      return;
    }

    const mz = def?.muzzleLocal || [0, 0.02, -0.5];

    // Posiciona e orienta no bocal da arma ativa com offset mínimo
    this.flashLight.position.set(mz[0], mz[1], mz[2] - 0.02);
    this.flashGroup.position.set(mz[0], mz[1], mz[2] - 0.015);

    const jitterRatio = flashConfig?.jitter ?? 0.20;
    const sizeJitter = baseSize * (1.0 - jitterRatio * 0.5 + Math.random() * jitterRatio);
    this.flashMesh1.scale.setScalar(sizeJitter);
    this.flashMesh2.scale.setScalar(sizeJitter * 0.85);
    this.flashMesh1.rotation.z = Math.random() * Math.PI * 2;
    this.flashMesh2.rotation.z = Math.random() * Math.PI * 2;

    if (flashConfig?.color) {
      this.flashMat.color.set(flashConfig.color);
    }
    if (flashConfig?.lightColor) {
      this.flashLight.color.set(flashConfig.lightColor);
    }

    this.flashMaxOpacity = flashConfig?.maxOpacity ?? 0.90;
    this.flashMat.opacity = this.flashMaxOpacity;
    this.flashDuration = flashConfig?.duration ?? 0.055;
    this.flashTimer = this.flashDuration;
    this.flashGroup.visible = true;

    const baseIntensity = flashConfig?.lightIntensity ?? Math.min(16.0, baseSize * 26.0);
    this.flashLight.intensity = baseIntensity + Math.random() * (baseIntensity * 0.25);
    this.flashLight.distance = flashConfig?.lightDistance ?? 5.0;
  }

  decayFlash(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      const ratio = this.flashTimer / Math.max(0.001, this.flashDuration);
      this.flashMat.opacity = this.flashMaxOpacity * ratio;
      if (this.camera) {
        this.flashMesh1.lookAt(this.camera.position);
        this.flashMesh2.lookAt(this.camera.position);
      }
      if (this.flashTimer <= 0) {
        this.flashGroup.visible = false;
        this.flashMat.opacity = 0;
        this.flashLight.intensity = 0;
      }
    } else if (this.flashGroup.visible) {
      this.flashGroup.visible = false;
    }

    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 36);
    }
  }
}