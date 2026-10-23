import * as THREE from 'three';
import { createTacticalArm, createCharacterMaterials } from '../view/models/TacticalManContinuous.js';

/**
 * Socket offsets para empunhadura tática em 1ª pessoa calibrados por arma (estilo CS / Tactical FPS).
 * No espaço do mount da arma:
 * - Cano / Guarda-mão aponta para -Z
 * - Coronha / Jogador aponta para +Z
 * - Topo da arma aponta para +Y
 * - Lado direito da arma aponta para +X, lado esquerdo para -X
 *
 * Mão Esquerda: Apoia por BAIXO e pela ESQUERDA do guarda-mão (à frente do carregador).
 * Mão Direita: Empunha o cabo (pistol grip) por trás, dedo no gatilho.
 * Pistolas (p9 / sw500): Modo 1 mão (braço esquerdo 100% oculto).
 */
const WEAPON_HAND_SOCKETS = {
  scar_h: {
    right: { wrist: [0.01, -0.13, 0.08], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.07, -0.23], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  hk416: {
    right: { wrist: [0.01, -0.13, 0.07], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.07, -0.21], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  ar15: {
    right: { wrist: [0.01, -0.13, 0.07], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.07, -0.21], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  ak47: {
    right: { wrist: [0.01, -0.13, 0.08], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.07, -0.23], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  rifle_proto: {
    right: { wrist: [0.01, -0.13, 0.08], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.07, -0.21], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  m249: {
    right: { wrist: [0.01, -0.14, 0.09], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.08, -0.25], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  vss: {
    right: { wrist: [0.01, -0.11, 0.09], fingers: [0.00, -0.75, -0.65], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.06, -0.18], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  m12: {
    right: { wrist: [0.01, -0.11, 0.09], fingers: [0.00, -0.75, -0.65], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.07, -0.26], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  uzi: {
    right: { wrist: [0.01, -0.12, 0.05], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  { wrist: [-0.04, -0.06, -0.14], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
    oneHand: false
  },
  p9: {
    right: { wrist: [0.01, -0.11, 0.05], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  null,
    oneHand: true
  },
  sw500: {
    right: { wrist: [0.01, -0.11, 0.05], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
    left:  null,
    oneHand: true
  }
};

const DEFAULT_SOCKET = {
  right: { wrist: [0.01, -0.13, 0.07], fingers: [0.00, -0.80, -0.60], palm: [-0.20, 0.40, -0.90] },
  left:  { wrist: [-0.04, -0.07, -0.21], fingers: [0.15, 0.20, -0.96], palm: [0.40, 0.90, -0.15] },
  oneHand: false
};

const REST_ARM_DIR = new THREE.Vector3(0, -1, 0);

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

    // Oculta os bulbos de ombro/deltoide para que NUNCA clipeem nas bordas da tela em 1ª pessoa
    const bulbL = this.leftArm.shoulder.getObjectByName('shoulder_bulb_Left');
    if (bulbL) bulbL.visible = false;
    const bulbR = this.rightArm.shoulder.getObjectByName('shoulder_bulb_Right');
    if (bulbR) bulbR.visible = false;

    this.root.add(this.leftArm.shoulder);
    this.root.add(this.rightArm.shoulder);

    // Vetores temporários reutilizáveis para zero alocação de memória (Zero-GC no loop de render)
    this._vTarget = new THREE.Vector3();
    this._vShoulder = new THREE.Vector3();
    this._vToTarget = new THREE.Vector3();
    this._vNormTarget = new THREE.Vector3();
    this._vNormal = new THREE.Vector3();
    this._vElbowPlane = new THREE.Vector3();
    this._vElbowWorld = new THREE.Vector3();
    this._vUpperDir = new THREE.Vector3();
    this._vForeWorld = new THREE.Vector3();
    this._vForeLocal = new THREE.Vector3();
    this._vFingers = new THREE.Vector3();
    this._vPalm = new THREE.Vector3();
    this._vThumb = new THREE.Vector3();
    this._vActualPalm = new THREE.Vector3();
    this._colX = new THREE.Vector3();
    this._colY = new THREE.Vector3();
    this._colZ = new THREE.Vector3();
    this._basisMat = new THREE.Matrix4();
    this._targetHandQ = new THREE.Quaternion();
    this._wristWorldQ = new THREE.Quaternion();
    this._invUpperQ = new THREE.Quaternion();

    this.setWeapon('ar15');
  }

  setWeapon(weaponId) {
    this.activeWeaponId = weaponId;
    this._solvePose(weaponId, { isADS: false, reloadProgress: 0, isSprinting: false });
  }

  /**
   * Resolução cinemática analítica de 2 ossos (Two-Bone IK) + Orientação ortonormal da mão.
   * Garante contato matemático exato da mão na empunhadura e guarda-mão sem aproximações.
   */
  _solveArmIK(arm, side, shoulderPos, targetWristPos, targetFingersDir, targetPalmDir, poleDir) {
    arm.shoulder.position.copy(shoulderPos);
    arm.shoulder.updateMatrixWorld(true);

    const L1 = 0.280; // Comprimento anatômico do braço superior
    const L2 = 0.250; // Comprimento anatômico do antebraço

    const toTarget = this._vToTarget.copy(targetWristPos).sub(shoulderPos);
    const dist = Math.min(Math.max(toTarget.length(), 0.05), (L1 + L2) * 0.998);
    const normTarget = this._vNormTarget.copy(toTarget).normalize();

    // Lei dos Cossenos para o ângulo da junta do cotovelo
    const cosA = (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist);
    const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)));

    // Vetor normal e plano de rotação do cotovelo guiado pelo pole vector
    const normal = this._vNormal.crossVectors(normTarget, poleDir).normalize();
    const elbowPlaneDir = this._vElbowPlane.crossVectors(normal, normTarget).normalize();

    // Posição analítica 3D da junta do cotovelo
    const elbowWorld = this._vElbowWorld.copy(shoulderPos)
      .addScaledVector(normTarget, L1 * Math.cos(angleA))
      .addScaledVector(elbowPlaneDir, L1 * Math.sin(angleA));

    // Rotação do braço superior (UpperArm aponta ao longo de -Y em repouso)
    const upperDir = this._vUpperDir.copy(elbowWorld).sub(shoulderPos).normalize();
    arm.upperArm.quaternion.setFromUnitVectors(REST_ARM_DIR, upperDir);
    arm.upperArm.updateMatrixWorld(true);

    // Rotação do cotovelo / antebraço (Forearm aponta ao longo de -Y em repouso)
    const foreWorldDir = this._vForeWorld.copy(targetWristPos).sub(elbowWorld).normalize();
    const invUpperQ = this._invUpperQ.copy(arm.upperArm.quaternion).invert();
    const foreLocalDir = this._vForeLocal.copy(foreWorldDir).applyQuaternion(invUpperQ);
    arm.elbow.quaternion.setFromUnitVectors(REST_ARM_DIR, foreLocalDir);
    arm.elbow.updateMatrixWorld(true);

    // Orientação ortonormal da mão orgânica tática
    const nFingers = this._vFingers.copy(targetFingersDir).normalize();
    const nPalm = this._vPalm.copy(targetPalmDir).normalize();

    if (side === 'left') {
      // Mão Esquerda: fingers = -Y local, palm = -X local, thumb = +Z local
      // cross(Palm, Fingers) = Thumb
      const targetThumb = this._vThumb.crossVectors(nPalm, nFingers).normalize();
      const actualPalm = this._vActualPalm.crossVectors(nFingers, targetThumb).normalize();

      this._colX.copy(actualPalm).negate();
      this._colY.copy(nFingers).negate();
      this._colZ.copy(targetThumb);
    } else {
      // Mão Direita: fingers = -Y local, palm = +X local, thumb = +Z local
      // cross(Fingers, Palm) = Thumb
      const targetThumb = this._vThumb.crossVectors(nFingers, nPalm).normalize();
      const actualPalm = this._vActualPalm.crossVectors(targetThumb, nFingers).normalize();

      this._colX.copy(actualPalm);
      this._colY.copy(nFingers).negate();
      this._colZ.copy(targetThumb);
    }

    this._basisMat.makeBasis(this._colX, this._colY, this._colZ);
    const targetHandWorldQ = this._targetHandQ.setFromRotationMatrix(this._basisMat);

    // Converte a orientação desejada do espaço de mundo/mount para a junta local do pulso (wrist)
    const wristWorldQ = this._wristWorldQ;
    arm.wrist.getWorldQuaternion(wristWorldQ);
    arm.hand.quaternion.copy(wristWorldQ.invert().multiply(targetHandWorldQ));
  }

  _solvePose(weaponId, { isADS = false, reloadProgress = 0, isSprinting = false } = {}) {
    const socket = WEAPON_HAND_SOCKETS[weaponId] || DEFAULT_SOCKET;
    const isOneHand = socket.oneHand === true;

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. BRAÇO DIREITO (EMPUNHADURA / PISTOL GRIP & GATILHO)
    // ═══════════════════════════════════════════════════════════════════════════
    const rData = socket.right;
    const rWrist = this._vTarget.set(rData.wrist[0], rData.wrist[1], rData.wrist[2]);
    const rFingers = this._vFingers.set(rData.fingers[0], rData.fingers[1], rData.fingers[2]);
    const rPalm = this._vPalm.set(rData.palm[0], rData.palm[1], rData.palm[2]);

    let sR;
    if (isOneHand) {
      // Modo 1 Mão (P-9 e SW500): Postura de tiro unilateral centrada
      sR = this._vShoulder.set(0.12, -0.26, 0.16);
      if (isSprinting) {
        rWrist.y -= 0.05;
        rWrist.z += 0.04;
      }
    } else {
      // Fuzis e armas longas de duas mãos
      sR = this._vShoulder.set(0.18, -0.28, 0.20);
      if (isSprinting) {
        rWrist.y -= 0.04;
        rWrist.z += 0.03;
      }
    }

    // Pole vector do cotovelo direito: aponta para baixo e para fora/direita
    const poleR = this._vElbowPlane.set(0.60, -0.80, 0.10);
    this._solveArmIK(this.rightArm, 'right', sR, rWrist, rFingers, rPalm, poleR);

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. BRAÇO ESQUERDO (CANO / GUARDA-MÃO ESTILO CS OU OCULTO EM 1 MÃO)
    // ═══════════════════════════════════════════════════════════════════════════
    if (isOneHand) {
      // Para pistolas e revólveres: braço esquerdo 100% oculto
      this.leftArm.shoulder.visible = false;
    } else {
      this.leftArm.shoulder.visible = true;

      const lData = socket.left;
      const lWrist = this._vTarget.set(lData.wrist[0], lData.wrist[1], lData.wrist[2]);
      const lFingers = this._vFingers.set(lData.fingers[0], lData.fingers[1], lData.fingers[2]);
      const lPalm = this._vPalm.set(lData.palm[0], lData.palm[1], lData.palm[2]);

      // Base do ombro esquerdo: entra diagonalmente do canto inferior esquerdo da tela
      let shoulderY = -0.28;
      if (reloadProgress > 0) {
        // Animação tática de recarga: mão esquerda sai do cano e desce para trocar o carregador
        const dip = Math.sin(reloadProgress * Math.PI);
        shoulderY -= dip * 0.14;
        lWrist.y -= dip * 0.16;
        lWrist.z += dip * 0.14;
        lPalm.x += dip * 0.30;
      } else if (isSprinting) {
        lWrist.y -= 0.04;
        lWrist.z += 0.03;
      }

      const sL = this._vShoulder.set(-0.22, shoulderY, 0.20);
      // Pole vector do cotovelo esquerdo: aponta para baixo e para fora/esquerda
      const poleL = this._vElbowPlane.set(-0.60, -0.80, 0.10);

      this._solveArmIK(this.leftArm, 'left', sL, lWrist, lFingers, lPalm, poleL);
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
