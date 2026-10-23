import * as THREE from 'three';
import { getSharedGeometries, getTacticalMaterials } from '../view/models/TacticalManModel.js';

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
  p9:          { left: [-0.008, -0.080, -0.042], right: [0.008, -0.070, -0.040] }, // Two-hand pistol grip
  sw500:       { left: [-0.008, -0.080, -0.042], right: [0.008, -0.070, -0.040] }  // Two-hand revolver grip
};

const DEFAULT_SOCKET = { left: [-0.035, -0.032, 0.160], right: [0.010, -0.072, -0.060] };

export class ViewmodelArms {
  constructor(mountGroup, options = {}) {
    this.mount = mountGroup;
    this.paletteIndex = options.paletteIndex || 0;
    this.activeWeaponId = 'ar15';

    this.root = new THREE.Group();
    this.root.name = 'ViewmodelTacticalArms';
    this.mount.add(this.root);

    const T = THREE;
    this.geos = getSharedGeometries(T);
    this.mats = getTacticalMaterials(T, this.paletteIndex);

    this.leftArm = this._createArm('left');
    this.rightArm = this._createArm('right');

    this.root.add(this.leftArm.shoulder);
    this.root.add(this.rightArm.shoulder);

    this.setWeapon('ar15');
  }

  _createArm(side) {
    const isLeft = side === 'left';
    const sgn = isLeft ? 1 : -1;
    const sideStr = isLeft ? 'Left' : 'Right';
    const T = THREE;

    // Ombro no espaço da câmera/arma
    const shoulder = new T.Group();
    shoulder.name = `vm_shoulder_${sideStr}`;
    // Posição base do ombro: ligeiramente recuado e abaixo da câmera
    shoulder.position.set(sgn * 0.24, -0.22, -0.10);

    const upperArm = new T.Group();
    upperArm.name = `vm_upperArm_${sideStr}`;
    shoulder.add(upperArm);

    const upperArmMesh = new T.Mesh(this.geos.upperArmGeo, this.mats.uniformMat);
    upperArmMesh.castShadow = false;
    upperArmMesh.receiveShadow = false;
    upperArm.add(upperArmMesh);

    const elbow = new T.Group();
    elbow.name = `vm_elbow_${sideStr}`;
    elbow.position.set(0, -0.28, 0);
    upperArm.add(elbow);

    // Cotoveleira Tática
    const elbowPad = new T.Mesh(new T.BoxGeometry(0.046, 0.062, 0.022), this.mats.polymerHardPadMat);
    elbowPad.position.set(0, 0, -0.042);
    elbowPad.rotation.x = -0.15;
    elbow.add(elbowPad);

    const forearm = new T.Group();
    forearm.name = `vm_forearm_${sideStr}`;
    elbow.add(forearm);

    const forearmMesh = new T.Mesh(this.geos.forearmGeo, this.mats.uniformMat);
    forearm.add(forearmMesh);

    // Punho tático com velcro cinza
    const cuff = new T.Mesh(new T.CylinderGeometry(0.038, 0.036, 0.022, 12), this.mats.darkTacticalGreyMat);
    cuff.position.set(0, -0.235, 0);
    cuff.rotation.x = Math.PI * 0.5;
    forearm.add(cuff);

    // Relógio Militar no braço esquerdo
    if (isLeft) {
      const watch = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.012, 12), this.mats.buckleMetalMat);
      watch.position.set(0, -0.235, 0.034);
      watch.rotation.x = Math.PI * 0.5;
      forearm.add(watch);
    }

    const wrist = new T.Group();
    wrist.name = `vm_wrist_${sideStr}`;
    wrist.position.set(0, -0.25, 0);
    forearm.add(wrist);

    const hand = new T.Group();
    hand.name = `vm_hand_${sideStr}`;
    wrist.add(hand);

    const palmMesh = new T.Mesh(this.geos.palmGeo, this.mats.skinMat);
    hand.add(palmMesh);

    // Dedos curvados para empunhadura firme
    const fingerCurl = isLeft ? [0.65, 0.75, 0.82, 0.90] : [0.85, 0.95, 0.95, 0.95];
    [-0.020, -0.007, 0.007, 0.020].forEach((tx, idx) => {
      const f = new T.Mesh(this.geos.fingerGeo, this.mats.skinMat);
      f.position.set(sgn * tx, -0.075, 0.015);
      f.rotation.x = fingerCurl[idx];
      f.scale.set(0.9, 0.8, 0.9);
      hand.add(f);
    });

    // Polegar envolvendo o grip
    const thumb = new T.Mesh(this.geos.fingerGeo, this.mats.skinMat);
    thumb.position.set(sgn * 0.025, -0.035, 0.015);
    thumb.rotation.set(0.55, sgn * 0.40, sgn * -0.50);
    thumb.scale.set(1.0, 0.8, 1.0);
    hand.add(thumb);

    return { shoulder, upperArm, elbow, forearm, wrist, hand };
  }

  setWeapon(weaponId) {
    this.activeWeaponId = weaponId;
    this._solvePose(weaponId, { isADS: false, reloadProgress: 0 });
  }

  _solvePose(weaponId, { isADS = false, reloadProgress = 0, isSprinting = false } = {}) {
    const socket = WEAPON_HAND_SOCKETS[weaponId] || DEFAULT_SOCKET;

    // 1. Mão Direita (Sempre firme no gatilho / pistol grip da arma)
    const rHandPos = socket.right;
    this.rightArm.shoulder.position.set(0.19, -0.24, -0.12);
    this.rightArm.shoulder.rotation.set(0.55, -0.28, 0.12);
    this.rightArm.upperArm.rotation.set(0.42, -0.15, 0.05);
    this.rightArm.elbow.rotation.set(-0.85, 0.12, -0.10);
    this.rightArm.forearm.rotation.set(0.35, 0.18, 0.10);
    this.rightArm.wrist.position.set(rHandPos[0] - 0.01, -0.25, rHandPos[2] + 0.08);
    this.rightArm.hand.rotation.set(-0.35, -0.15, 0.22);

    // 2. Mão Esquerda (Segura o handguard/foregrip ou faz animação de recarga)
    if (reloadProgress > 0) {
      // Animação tática de recarga: mão esquerda desce, pega magazine novo e sobe
      const dip = Math.sin(reloadProgress * Math.PI);
      this.leftArm.shoulder.position.set(-0.20, -0.24 - dip * 0.16, -0.10 - dip * 0.05);
      this.leftArm.shoulder.rotation.set(0.45 + dip * 0.65, 0.20, -0.10);
      this.leftArm.upperArm.rotation.set(0.30 + dip * 0.45, 0.10, -0.05);
      this.leftArm.elbow.rotation.set(-0.75 - dip * 0.40, -0.15, 0.10);
      this.leftArm.forearm.rotation.set(0.30 - dip * 0.30, -0.12, -0.05);
      this.leftArm.hand.rotation.set(-0.25 - dip * 0.50, 0.20, -0.20);
    } else {
      const lHandPos = socket.left;
      const adsOffset = isADS ? 0.02 : 0.0;
      this.leftArm.shoulder.position.set(-0.21, -0.23 + adsOffset, -0.10);
      this.leftArm.shoulder.rotation.set(0.62, 0.32, -0.15);
      this.leftArm.upperArm.rotation.set(0.48, 0.18, -0.08);
      this.leftArm.elbow.rotation.set(-1.05, -0.20, 0.15);
      this.leftArm.forearm.rotation.set(0.42, -0.22, -0.12);
      this.leftArm.wrist.position.set(lHandPos[0] + 0.01, -0.25, lHandPos[2] + 0.08);
      this.leftArm.hand.rotation.set(-0.45, 0.25, -0.28);
    }

    // Leve ajuste em sprint
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
