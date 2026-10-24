import * as THREE from 'three';
import createCharacter, { applyPaletteToCharacter } from './models/TacticalManContinuous.js';

const GHOST_COLORS = [
  0xff1e1e, // Blinky (Vermelho)
  0xff85d0, // Pinky (Rosa)
  0x00f0ff, // Inky (Ciano)
  0xff9900, // Clyde (Laranja)
];

const toRad = (deg) => deg * (Math.PI / 180);

export class CharacterView {
  constructor(character, scene, options = {}) {
    this.character = character;
    this.scene = scene;
    this.options = options;
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
    this.joints = null;

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
      /* SOLDADO TÁTICO CONTÍNUO (TACTIC MAN CONTINUOUS AUTÊNTICO COM PALETA DE CORES POR BOT OU PLAYER) */
      const palIdx = Math.max(0, (this.id - 1) % 5);
      const soldierSkin = this.options.soldierSkin || this.options.palette || null;
      this.tactical = createCharacter(THREE, {
        paletteIndex: palIdx,
        palette: soldierSkin,
        skinTone: this.options.skinTone || null
      });
      this.root.add(this.tactical);

      const joints = this.tactical.userData.joints;
      this.joints = joints;

      // Vincula referências anatômicas
      this.torso = joints.chest;
      this.headGroup = joints.neck;

      // Obtém as malhas específicas para registro de hitboxes de tiro (headshot e body hit)
      this.head = joints.head.getObjectByName('tactical_head_face') || joints.head;
      this.body = joints.chest.getObjectByName('combat_shirt_torso_mesh') || joints.chest;

      this.head.userData = { type: 'character', character: this.character, bot: this.character, part: 'head' };
      this.body.userData = { type: 'character', character: this.character, bot: this.character, part: 'body' };

      // Pivôs de articulação para compatibilidade
      this.leftLegPivot = joints.hipLeft;
      this.rightLegPivot = joints.hipRight;
      this.leftArmPivot = joints.shoulderLeft;
      this.rightArmPivot = joints.shoulderRight;

      // Postura tática pronta segurando o fuzil (longgun grip)
      joints.upperArmRight.rotation.set(-toRad(68), toRad(18), 0);
      joints.elbowRight.rotation.x = -toRad(62);
      joints.upperArmLeft.rotation.set(-toRad(52), -toRad(28), 0);
      joints.elbowLeft.rotation.x = -toRad(78);

      // Terceira Pessoa: Fuzil tático posicionado exatamente nas mãos do operador
      const mGun = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.35, metalness: 0.80 });
      const mGunDark = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.45, metalness: 0.60 });

      this.gunGroup = new THREE.Group();
      this.gunGroup.name = 'third_person_gun';
      // Posiciona na altura do peito, alinhado com a empunhadura direita e o guarda-mão esquerdo
      this.gunGroup.position.set(-0.04, 0.23, 0.38);
      joints.chest.add(this.gunGroup);

      const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.32), mGun);
      gunReceiver.castShadow = true;

      const gunHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.075, 0.16), mGunDark);
      gunHandguard.position.set(0, 0, 0.18);
      gunHandguard.castShadow = true;

      const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.22), mGun);
      gunBarrel.position.set(0, 0.01, 0.36);
      gunBarrel.castShadow = true;

      const gunMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), mGunDark);
      gunMuzzle.position.set(0, 0.01, 0.48);
      gunMuzzle.castShadow = true;

      const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.08), mGunDark);
      gunMag.position.set(0, -0.10, 0.06);
      gunMag.rotation.x = 0.20;
      gunMag.castShadow = true;

      const gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.15), mGunDark);
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

      if (this.joints) {
        // Articulação biomecânica das pernas (quadril e joelho dobrando naturalmente)
        this.joints.hipLeft.rotation.x = swing * 0.65;
        this.joints.kneeLeft.rotation.x = Math.max(0, -swing * 0.65);
        this.joints.hipRight.rotation.x = -swing * 0.65;
        this.joints.kneeRight.rotation.x = Math.max(0, swing * 0.75);

        // Respiração e sway sutil na arma
        const walkGunY = 0.23 + Math.abs(swing) * 0.012;
        const idleGunY = 0.23 + Math.sin(this.idleTime) * 0.004;
        if (this.gunGroup) {
          this.gunGroup.position.y = walkGunY * this.moveBlend + idleGunY * (1.0 - this.moveBlend);
          this.gunGroup.rotation.z = -swing * 0.02;
        }

        // Lean tático no tronco e arma (preservado do quadril para cima)
        const lean = this.character.lean || 0;
        this.joints.chest.rotation.z = -lean * 0.20;
        this.joints.chest.position.x = lean * 0.12;

        // Pitch vertical (olhar para cima/baixo na mira)
        const pitch = this.character.pitch || 0;
        this.joints.neck.rotation.x = pitch * 0.75;
        this.joints.shoulderRight.rotation.x = pitch * 0.65;
        this.joints.shoulderLeft.rotation.x = pitch * 0.65;
      } else {
        if (this.leftLegPivot) this.leftLegPivot.rotation.x = swing * 0.65;
        if (this.rightLegPivot) this.rightLegPivot.rotation.x = -swing * 0.65;
      }

      this.root.position.set(charPos.x, charPos.y, charPos.z);
    }

    // Orientação Cinemática do Personagem
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

    if (this.skinType !== 'ghost' && this.moveBlend > 0.01 && walkDir === -1 && this.joints) {
      const swing = -Math.sin(this.walkTime) * this.moveBlend;
      this.joints.hipLeft.rotation.x = swing * 0.65;
      this.joints.kneeLeft.rotation.x = Math.max(0, -swing * 0.65);
      this.joints.hipRight.rotation.x = -swing * 0.65;
      this.joints.kneeRight.rotation.x = Math.max(0, swing * 0.75);
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

  applySoldierSkin(skinConfig) {
    if (this.tactical && skinConfig) {
      applyPaletteToCharacter(this.tactical, skinConfig);
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
