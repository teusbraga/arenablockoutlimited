import * as THREE from 'three';
import { createTacticalCharacter, TACTICAL_PALETTES, getTacticalMaterials } from './models/TacticalManModel.js';

const GHOST_COLORS = [
  0xff1e1e, // Blinky (Vermelho)
  0xff85d0, // Pinky (Rosa)
  0x00f0ff, // Inky (Ciano)
  0xff9900, // Clyde (Laranja)
];

export class CharacterView {
  constructor(character, scene, options = {}) {
    this.character = character;
    this.scene = scene;
    this.skinType = options.skinType || 'soldier';
    this.id = options.id || 1;

    this.root = new THREE.Group();
    this.head = null;
    this.body = null;
    this.muzzleFlash = null;
    this.flashTimer = 0;

    this.floatTime = Math.random() * 10;
    this.walkTime = Math.random() * 10;
    this.idleTime = Math.random() * 10;
    this.moveBlend = 0;
    this.currentBodyYaw = 0;
    this.hasInitYaw = false;

    this.tactical = null;

    this._buildMesh();
    if (this.scene) {
      this.scene.add(this.root);
    }
  }

  _buildMesh() {
    if (this.skinType === 'ghost') {
      const color = GHOST_COLORS[(this.id - 1) % GHOST_COLORS.length];
      const ghostMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.32,
        metalness: 0.15,
      });

      // 1. Cúpula / Cabeça Arredondada (Head hitbox)
      this.head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 14), ghostMat);
      this.head.position.y = 1.38;
      this.head.castShadow = true;
      this.head.userData = { type: 'bot', bot: this.character, part: 'head' };

      // 2. Corpo Cilíndrico (Body hitbox)
      this.body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.75, 16), ghostMat);
      this.body.position.y = 0.85;
      this.body.castShadow = true;
      this.body.userData = { type: 'bot', bot: this.character, part: 'body' };

      // Babados inferiores do fantasma
      for (let i = 0; i < 4; i++) {
        const skirtBrim = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ghostMat);
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
        skirtBrim.position.set(Math.cos(ang) * 0.28, 0.48, Math.sin(ang) * 0.28);
        this.root.add(skirtBrim);
      }

      // Olhos grandes
      const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x0033cc });

      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeWhiteMat);
      eyeL.position.set(-0.14, 1.40, 0.30);
      const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyePupilMat);
      pupilL.position.set(-0.14, 1.40, 0.37);

      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), eyeWhiteMat);
      eyeR.position.set(0.14, 1.40, 0.30);
      const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), eyePupilMat);
      pupilR.position.set(0.14, 1.40, 0.37);

      this.root.add(this.body, this.head, eyeL, pupilL, eyeR, pupilR);

    } else {
      /* SOLDADO TÁTICO CONTÍNUO (TACTIC MAN CONTINUOUS COM VARIAÇÕES E ACESSÓRIOS DE CABEÇA) */
      const palIdx = (this.id - 1) % TACTICAL_PALETTES.length;
      const headVar = (this.id - 1) % 5;

      const tactical = createTacticalCharacter(THREE, {
        paletteIndex: palIdx,
        headVariant: headVar,
        character: this.character
      });

      this.tactical = tactical;
      this.root.add(tactical.root);

      // Referências para hitboxes e compatibilidade
      this.torso = tactical.chest;
      this.body = tactical.torsoMesh;
      this.headGroup = tactical.neck;
      this.head = tactical.headMesh;
      this.leftLegPivot = tactical.leftLeg.hip;
      this.rightLegPivot = tactical.rightLeg.hip;
      this.leftArmPivot = tactical.leftArm.shoulder;
      this.rightArmPivot = tactical.rightArm.shoulder;
      this.armsGroup = new THREE.Group();
      this.torso.add(this.armsGroup);

      // Postura dos braços segurando o fuzil em 3ª pessoa
      tactical.rightArm.upperArm.rotation.set(0.68, -0.18, 0.0);
      tactical.rightArm.elbow.rotation.x = -0.62;
      tactical.leftArm.upperArm.rotation.set(0.52, 0.28, 0.0);
      tactical.leftArm.elbow.rotation.x = -0.78;

      // Arma de 3ª pessoa e Muzzle Flash
      const mats = getTacticalMaterials(THREE, palIdx);
      this.gunGroup = new THREE.Group();
      this.gunGroup.position.set(0.08, 0.04, 0.28);
      this.gunGroup.rotation.y = -0.06;
      this.torso.add(this.gunGroup);

      const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.32), mats.gunMat);
      gunReceiver.castShadow = true;

      const gunHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.16), mats.gunDarkMat);
      gunHandguard.position.set(0, 0, 0.18);
      gunHandguard.castShadow = true;

      const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), mats.gunMat);
      gunBarrel.position.set(0, 0.01, 0.36);
      gunBarrel.castShadow = true;

      const gunMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), mats.gunDarkMat);
      gunMuzzle.position.set(0, 0.01, 0.48);
      gunMuzzle.castShadow = true;

      const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.08), mats.gunDarkMat);
      gunMag.position.set(0, -0.10, 0.06);
      gunMag.rotation.x = 0.20;
      gunMag.castShadow = true;

      const gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.15), mats.gunDarkMat);
      gunStock.position.set(0, 0.005, -0.20);
      gunStock.castShadow = true;

      const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });
      this.muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), flashMat);
      this.muzzleFlash.position.set(0, 0.01, 0.52);
      this.muzzleFlash.visible = false;

      this.gunGroup.add(
        gunReceiver, gunHandguard, gunBarrel, gunMuzzle,
        gunMag, gunStock, this.muzzleFlash
      );
    }
  }

  triggerFlash() {
    if (this.muzzleFlash) {
      this.flashTimer = 0.06;
      this.muzzleFlash.visible = true;
    }
  }

  update(dt) {
    if (!this.character.alive) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;

    // Fade do muzzle flash
    if (this.muzzleFlash && this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.muzzleFlash.visible = false;
      }
    }

    // Animações Procedurais
    const charPos = this.character.renderPos || this.character.pos;
    if (this.skinType === 'ghost') {
      this.floatTime += dt * 4.5;
      const yOffset = Math.sin(this.floatTime) * 0.08 + 0.12;
      this.root.position.set(charPos.x, charPos.y + yOffset, charPos.z);
    } else {
      const speed = Math.hypot(this.character.vel.x, this.character.vel.z);
      const targetBlend = speed > 0.1 ? Math.min(speed / 2.5, 1.0) : 0.0;
      this.moveBlend += (targetBlend - this.moveBlend) * Math.min(dt * 24.0, 1.0);

      this.walkTime += dt * Math.max(speed, 1.2) * 3.8;
      this.idleTime += dt * 2.2;

      const swing = Math.sin(this.walkTime) * this.moveBlend;

      if (this.tactical) {
        // Articulação biomecânica das pernas (quadril e joelho dobrando naturalmente)
        this.tactical.leftLeg.hip.rotation.x = swing * 0.65;
        this.tactical.leftLeg.knee.rotation.x = Math.max(0, -swing * 0.65);
        this.tactical.rightLeg.hip.rotation.x = -swing * 0.65;
        this.tactical.rightLeg.knee.rotation.x = Math.max(0, swing * 0.65);

        // Respiração / Sway sutil na arma e tronco
        const walkGunY = 0.04 + Math.abs(swing) * 0.015;
        const idleGunY = 0.04 + Math.sin(this.idleTime) * 0.005;
        if (this.gunGroup) {
          this.gunGroup.position.y = walkGunY * this.moveBlend + idleGunY * (1.0 - this.moveBlend);
          this.gunGroup.rotation.z = -swing * 0.02;
        }

        // Lean tático no tronco e arma
        const lean = this.character.lean || 0;
        this.tactical.chest.rotation.z = -lean * 0.20;
        this.tactical.chest.position.x = lean * 0.12;

        // Pitch vertical (olhar para cima/baixo)
        const pitch = this.character.pitch || 0;
        this.tactical.neck.rotation.x = pitch * 0.75;
        this.tactical.rightArm.shoulder.rotation.x = pitch * 0.60;
        this.tactical.leftArm.shoulder.rotation.x = pitch * 0.60;
      } else {
        if (this.leftLegPivot) this.leftLegPivot.rotation.x = swing * 0.65;
        if (this.rightLegPivot) this.rightLegPivot.rotation.x = -swing * 0.65;
      }

      this.root.position.set(charPos.x, charPos.y, charPos.z);
    }

    // Orientação Cinemática do Personagem:
    const isCameraConvention = Boolean(this.character.rig);
    const aimYaw = isCameraConvention
      ? (this.character.yaw || 0) + Math.PI
      : (this.character.yaw || 0);

    if (!this.hasInitYaw) {
      this.currentBodyYaw = aimYaw;
      this.hasInitYaw = true;
    }

    const vx = this.character.vel?.x || 0;
    const vz = this.character.vel?.z || 0;
    const moveSpeed = Math.hypot(vx, vz);

    let targetBodyYaw = aimYaw;
    let walkDir = 1;

    // Se estiver em movimento ativo, pés alinham com deslocamento
    if (moveSpeed > 0.35) {
      let moveAngle = Math.atan2(vx, vz);
      let diffMoveAim = moveAngle - aimYaw;
      while (diffMoveAim > Math.PI) diffMoveAim -= Math.PI * 2;
      while (diffMoveAim < -Math.PI) diffMoveAim += Math.PI * 2;

      if (Math.abs(diffMoveAim) > Math.PI * 0.53) {
        moveAngle += Math.PI;
        walkDir = -1;
        diffMoveAim = moveAngle - aimYaw;
        while (diffMoveAim > Math.PI) diffMoveAim -= Math.PI * 2;
        while (diffMoveAim < -Math.PI) diffMoveAim += Math.PI * 2;
      }

      const maxHipOffset = 1.05;
      if (Math.abs(diffMoveAim) > maxHipOffset) {
        moveAngle = aimYaw + Math.sign(diffMoveAim) * maxHipOffset;
      }
      targetBodyYaw = moveAngle;
    } else {
      targetBodyYaw = aimYaw;
    }

    if (this.skinType !== 'ghost' && this.moveBlend > 0.01 && walkDir === -1 && this.tactical) {
      const swing = -Math.sin(this.walkTime) * this.moveBlend;
      this.tactical.leftLeg.hip.rotation.x = swing * 0.65;
      this.tactical.leftLeg.knee.rotation.x = Math.max(0, -swing * 0.65);
      this.tactical.rightLeg.hip.rotation.x = -swing * 0.65;
      this.tactical.rightLeg.knee.rotation.x = Math.max(0, swing * 0.65);
    }

    let diffTarget = targetBodyYaw - this.currentBodyYaw;
    while (diffTarget > Math.PI) diffTarget -= Math.PI * 2;
    while (diffTarget < -Math.PI) diffTarget += Math.PI * 2;
    const rotSpeed = moveSpeed > 0.35 ? 14 : 10;
    this.currentBodyYaw += diffTarget * Math.min(dt * rotSpeed, 1);

    this.root.rotation.y = this.currentBodyYaw;

    // Torso twist
    if (this.torso) {
      let spineTwist = aimYaw - this.currentBodyYaw;
      while (spineTwist > Math.PI) spineTwist -= Math.PI * 2;
      while (spineTwist < -Math.PI) spineTwist += Math.PI * 2;
      const maxSpineTwist = 1.25;
      this.torso.rotation.y = Math.max(-maxSpineTwist, Math.min(maxSpineTwist, spineTwist));
    }
  }

  destroy() {
    if (this.root) {
      this.root.traverse(o => {
        if (o.geometry && !o.geometry.userData?.isShared) {
          o.geometry.dispose();
        }
        if (o.material) {
          if (Array.isArray(o.material)) {
            o.material.forEach(m => {
              if (m.userData?.isShared) return;
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else if (!o.material.userData?.isShared) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        }
      });
      if (this.root.parent) {
        this.root.parent.remove(this.root);
      }
    }
  }
}
