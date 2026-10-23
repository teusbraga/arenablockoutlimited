import * as THREE from 'three';
import { createTacticalArm, createCharacterMaterials } from '../view/models/TacticalManContinuous.js';

/**
 * Socket offsets para empunhadura tática em 1ª pessoa calibrados por arma.
 * Não altera nenhum modelo ou coordenada das armas blindadas (GEMINI.md).
 */
const WEAPON_HAND_SOCKETS = {
  ar15:        { left: [-0.035, -0.032, 0.160], right: [0.010, -0.072, -0.060] },
  hk416:       { left: [-0.035, -0.032, 0.160], right: [0.010, -0.072, -0.060] },
  ak47:        { left: [-0.035, -0.030, 0.180], right: [0.010, -0.072, -0.060] },
  scar_h:      { left: [-0.035, -0.030, 0.170], right: [0.010, -0.072, -0.060] },
  rifle_proto: { left: [-0.035, -0.032, 0.160], right: [0.010, -0.072, -0.060] },
  m249:        { left: [-0.042, -0.025, 0.200], right: [0.012, -0.080, -0.075] },
  vss:         { left: [-0.032, -0.030, 0.150], right: [0.010, -0.070, -0.055] },
  uzi:         { left: [-0.022, -0.050, 0.080], right: [0.008, -0.068, -0.040] },
  m12:         { left: [-0.032, -0.038, 0.220], right: [0.010, -0.072, -0.060] },
  p9:          { left: [-0.008, -0.080, -0.042], right: [0.008, -0.070, -0.040] },
  sw500:       { left: [-0.008, -0.080, -0.042], right: [0.008, -0.070, -0.040] }
};

const DEFAULT_SOCKET = { left: [-0.035, -0.032, 0.160], right: [0.010, -0.072, -0.060] };

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

    this.root.add(this.leftArm.shoulder);
    this.root.add(this.rightArm.shoulder);

    this.setWeapon('ar15');
  }

  setWeapon(weaponId) {
    this.activeWeaponId = weaponId;
    this._solvePose(weaponId, { isADS: false, reloadProgress: 0 });
  }

  _solvePose(weaponId, { isADS = false, reloadProgress = 0, isSprinting = false } = {}) {
    const socket = WEAPON_HAND_SOCKETS[weaponId] || DEFAULT_SOCKET;

    // 1. Mão Direita (empunhadura do gatilho / pistol grip da arma ativa)
    const rHandPos = socket.right;
    this.rightArm.shoulder.position.set(0.20, -0.22, -0.10);
    this.rightArm.shoulder.rotation.set(0.50, -0.25, 0.10);
    this.rightArm.upperArm.rotation.set(0.40, -0.12, 0.05);
    this.rightArm.elbow.rotation.set(-0.85, 0.12, -0.10);
    this.rightArm.forearm.rotation.set(0.35, 0.15, 0.08);
    this.rightArm.wrist.position.set(rHandPos[0] - 0.01, -0.25, rHandPos[2] + 0.08);
    this.rightArm.hand.rotation.set(-0.35, -0.15, 0.20);

    // 2. Mão Esquerda (apoio no guarda-mão ou animação de recarga)
    if (reloadProgress > 0) {
      const dip = Math.sin(reloadProgress * Math.PI);
      this.leftArm.shoulder.position.set(-0.21, -0.23 - dip * 0.16, -0.10 - dip * 0.05);
      this.leftArm.shoulder.rotation.set(0.45 + dip * 0.65, 0.20, -0.10);
      this.leftArm.upperArm.rotation.set(0.30 + dip * 0.45, 0.10, -0.05);
      this.leftArm.elbow.rotation.set(-0.75 - dip * 0.40, -0.15, 0.10);
      this.leftArm.forearm.rotation.set(0.30 - dip * 0.30, -0.12, -0.05);
      this.leftArm.hand.rotation.set(-0.25 - dip * 0.50, 0.20, -0.20);
    } else {
      const lHandPos = socket.left;
      const adsOffset = isADS ? 0.02 : 0.0;
      this.leftArm.shoulder.position.set(-0.21, -0.23 + adsOffset, -0.10);
      this.leftArm.shoulder.rotation.set(0.60, 0.30, -0.14);
      this.leftArm.upperArm.rotation.set(0.46, 0.16, -0.08);
      this.leftArm.elbow.rotation.set(-1.00, -0.18, 0.14);
      this.leftArm.forearm.rotation.set(0.40, -0.20, -0.10);
      this.leftArm.wrist.position.set(lHandPos[0] + 0.01, -0.25, lHandPos[2] + 0.08);
      this.leftArm.hand.rotation.set(-0.45, 0.25, -0.28);
    }

    if (isSprinting) {
      this.leftArm.shoulder.rotation.x -= 0.12;
      this.rightArm.shoulder.rotation.x -= 0.08;
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
