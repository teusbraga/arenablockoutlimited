import * as THREE from 'three';
import { createTacticalArm, createCharacterMaterials } from '../view/models/TacticalManContinuous.js';

/**
 * Socket offsets para empunhadura tática em 1ª pessoa calibrados por arma.
 * Cano aponta para -Z e coronha para +Z.
 * Não altera nenhum modelo ou coordenada das armas blindadas (GEMINI.md).
 */
const WEAPON_HAND_SOCKETS = {
  scar_h:      { right: [ 0.00, -0.09,  0.06], left: [-0.02, -0.03, -0.22], oneHand: false },
  hk416:       { right: [ 0.00, -0.09,  0.05], left: [-0.02, -0.03, -0.20], oneHand: false },
  ar15:        { right: [ 0.00, -0.09,  0.05], left: [-0.02, -0.03, -0.20], oneHand: false },
  ak47:        { right: [ 0.00, -0.09,  0.06], left: [-0.02, -0.03, -0.22], oneHand: false },
  rifle_proto: { right: [ 0.00, -0.09,  0.06], left: [-0.02, -0.03, -0.20], oneHand: false },
  m249:        { right: [ 0.01, -0.10,  0.07], left: [-0.03, -0.04, -0.24], oneHand: false },
  vss:         { right: [ 0.00, -0.08,  0.08], left: [-0.02, -0.03, -0.18], oneHand: false },
  m12:         { right: [ 0.00, -0.08,  0.08], left: [-0.02, -0.04, -0.26], oneHand: false },
  uzi:         { right: [ 0.00, -0.08,  0.04], left: [-0.02, -0.04, -0.14], oneHand: false },
  p9:          { right: [ 0.00, -0.07,  0.04], left: null,                  oneHand: true  },
  sw500:       { right: [ 0.00, -0.07,  0.04], left: null,                  oneHand: true  }
};

const DEFAULT_SOCKET = { right: [0.00, -0.09, 0.05], left: [-0.02, -0.03, -0.20], oneHand: false };

export class ViewmodelArms {
  constructor(mountGroup) {
    this.mount = mountGroup;
    this.activeWeaponId = 'ar15';

    this.root = new THREE.Group();
    this.root.name = 'ViewmodelTacticalArms';
    this.mount.add(this.root);

    this.mats = createCharacterMaterials(THREE);

    this.leftArm = createTacticalArm(THREE, 'left', this.mats);
    this.rightArm = createTacticalArm(THREE, 'right', this.mats);

    // Oculta os bulbos de ombro/deltoide para que NUNCA clipeem na tela em 1ª pessoa
    const bulbL = this.leftArm.shoulder.getObjectByName('shoulder_bulb_Left');
    if (bulbL) bulbL.visible = false;
    const bulbR = this.rightArm.shoulder.getObjectByName('shoulder_bulb_Right');
    if (bulbR) bulbR.visible = false;

    this.root.add(this.leftArm.shoulder);
    this.root.add(this.rightArm.shoulder);

    this.setWeapon('ar15');
  }

  setWeapon(weaponId) {
    this.activeWeaponId = weaponId;
    this._solvePose(weaponId, { isADS: false, reloadProgress: 0, isSprinting: false });
  }

  _solvePose(weaponId, { isADS = false, reloadProgress = 0, isSprinting = false } = {}) {
    const socket = WEAPON_HAND_SOCKETS[weaponId] || DEFAULT_SOCKET;
    const isOneHand = socket.oneHand === true;

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. MÃO DIREITA (EMPUNHADURA / PISTOL GRIP & GATILHO)
    // ═══════════════════════════════════════════════════════════════════════════
    const rGrip = socket.right;

    if (isOneHand) {
      // Postura de uma mão só (P-9 e SW500): Ombro mais centralizado e braço firme
      this.rightArm.shoulder.position.set(0.12, -0.32, 0.12);
      this.rightArm.upperArm.rotation.set(1.68, -0.06, -0.65);
      this.rightArm.elbow.rotation.set(1.72, 0, 0);
      this.rightArm.wrist.position.set(rGrip[0] * 0.5, -0.25, rGrip[2] * 0.5);
      this.rightArm.hand.rotation.set(-0.25, -0.10, 0.15);
    } else {
      // Postura de fuzil/arma longa (SCAR-H, HK416, AK47, M249, VSS, etc.)
      // Precisão submilimétrica na empunhadura da arma
      const deltaZ = (rGrip[2] - 0.06) * 0.8;
      const deltaY = (rGrip[1] - (-0.09)) * 0.8;
      this.rightArm.shoulder.position.set(0.14, -0.36 + deltaY, 0.16 + deltaZ);
      this.rightArm.upperArm.rotation.set(1.75, -0.05, -0.80);
      this.rightArm.elbow.rotation.set(1.85, 0, 0);
      this.rightArm.wrist.position.set(rGrip[0] * 0.3, -0.25, rGrip[2] * 0.3);
      this.rightArm.hand.rotation.set(-0.30, -0.12, 0.18);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. MÃO ESQUERDA (CANO / GUARDA-MÃO À FRENTE DO CARREGADOR OU OCULTO)
    // ═══════════════════════════════════════════════════════════════════════════
    if (isOneHand) {
      // Para pistolas e revólveres (P-9 e SW500): Mão esquerda 100% oculta
      this.leftArm.shoulder.visible = false;
    } else {
      this.leftArm.shoulder.visible = true;

      if (reloadProgress > 0) {
        // Animação de recarga tática: mão esquerda sai do cano e desce para o carregador
        const dip = Math.sin(reloadProgress * Math.PI);
        this.leftArm.shoulder.position.set(-0.18, -0.36 - dip * 0.12, 0.12 - dip * 0.05);
        this.leftArm.upperArm.rotation.set(1.65 - dip * 0.55, 0.60 - dip * 0.30, 0.70);
        this.leftArm.elbow.rotation.set(0.70 + dip * 0.40, 0, 0);
        this.leftArm.hand.rotation.set(-0.35 - dip * 0.45, 0.20, -0.20);
      } else {
        // Empunhadura firme do cano / guarda-mão à frente do carregador
        const lGrip = socket.left;
        const deltaZ = (lGrip[2] - (-0.22)) * 0.7;
        const deltaY = (lGrip[1] - (-0.03)) * 0.7;
        this.leftArm.shoulder.position.set(-0.18, -0.36 + deltaY, 0.12 + deltaZ);
        this.leftArm.upperArm.rotation.set(1.65, 0.60, 0.70);
        this.leftArm.elbow.rotation.set(0.70, 0, 0);
        this.leftArm.wrist.position.set(lGrip[0] * 0.3, -0.25, lGrip[2] * 0.3);
        this.leftArm.hand.rotation.set(-0.35, 0.22, -0.25);
      }
    }

    // Leve adaptação de postura em corrida (sprint)
    if (isSprinting) {
      this.rightArm.shoulder.rotation.x -= 0.10;
      if (!isOneHand) {
        this.leftArm.shoulder.rotation.x -= 0.08;
      }
    }
  }

  update(weaponId, { isADS = false, isSprinting = false, reloadProgress = 0 } = {}) {
    this._solvePose(weaponId || this.activeWeaponId, { isADS, isSprinting, reloadProgress });
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  destroy() {
    if (this.root && this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
