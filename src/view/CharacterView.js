import * as THREE from 'three';

const GHOST_COLORS = [
  0xff1e1e, // Blinky (Vermelho)
  0xff85d0, // Pinky (Rosa)
  0x00f0ff, // Inky (Ciano)
  0xff9900, // Clyde (Laranja)
];

// Paletas militares táticas para os Soldados Blocky
const SOLDIER_PALETTES = [
  { uniform: 0x3b4a34, vest: 0x263322, helmet: 0x2e3b29, pants: 0x344230, skin: 0xdca183 }, // Woodland Green
  { uniform: 0x48515a, vest: 0x2b3137, helmet: 0x384047, pants: 0x3f474f, skin: 0xc69075 }, // Urban Slate
  { uniform: 0x7a6b4c, vest: 0x544730, helmet: 0x695a3d, pants: 0x6e5f41, skin: 0xe0ad91 }, // Desert Tan
  { uniform: 0x252a2f, vest: 0x181c20, helmet: 0x202428, pants: 0x22262a, skin: 0xb57f66 }, // Spec-Ops Dark
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
      /* SOLDADO BLOCKY TÁTICO */
      const pal = SOLDIER_PALETTES[(this.id - 1) % SOLDIER_PALETTES.length];

      const mUniform = new THREE.MeshStandardMaterial({ color: pal.uniform, roughness: 0.65, metalness: 0.1 });
      const mVest    = new THREE.MeshStandardMaterial({ color: pal.vest,    roughness: 0.70, metalness: 0.15 });
      const mHelmet  = new THREE.MeshStandardMaterial({ color: pal.helmet,  roughness: 0.50, metalness: 0.25 });
      const mPants   = new THREE.MeshStandardMaterial({ color: pal.pants,   roughness: 0.75, metalness: 0.05 });
      const mSkin    = new THREE.MeshStandardMaterial({ color: pal.skin,    roughness: 0.60, metalness: 0.05 });
      const mBoots   = new THREE.MeshStandardMaterial({ color: 0x181a1c,    roughness: 0.80, metalness: 0.20 });
      const mGoggles = new THREE.MeshStandardMaterial({ color: 0x11161d,    roughness: 0.20, metalness: 0.85 });
      const mGun     = new THREE.MeshStandardMaterial({ color: 0x2e3338,    roughness: 0.35, metalness: 0.80 });
      const mGunDark = new THREE.MeshStandardMaterial({ color: 0x181a1c,    roughness: 0.45, metalness: 0.60 });

      // ---- 1. Tronco / Torso ----
      this.torso = new THREE.Group();
      this.root.add(this.torso);

      this.body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.28), mUniform);
      this.body.position.y = 0.95;
      this.body.castShadow = true;
      this.body.userData = { type: 'bot', bot: this.character, part: 'body' };
      this.torso.add(this.body);

      const vest = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.44, 0.31), mVest);
      vest.position.set(0, 0.97, 0);
      vest.castShadow = true;

      const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), mVest);
      pouchL.position.set(-0.12, 0.88, 0.18);
      const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.06), mVest);
      pouchR.position.set(0.12, 0.88, 0.18);

      this.torso.add(vest, pouchL, pouchR);

      // ---- 2. Cabeça e Capacete ----
      this.head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), mSkin);
      this.head.position.y = 1.40;
      this.head.castShadow = true;
      this.head.userData = { type: 'bot', bot: this.character, part: 'head' };
      this.torso.add(this.head);

      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), mHelmet);
      helmet.position.set(0, 1.50, 0);
      helmet.castShadow = true;

      const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), mGoggles);
      goggles.position.set(0, 1.41, 0.18);

      this.torso.add(helmet, goggles);

      // ---- 3. Pernas Articuladas ----
      this.leftLegPivot = new THREE.Group();
      this.leftLegPivot.position.set(-0.15, 0.66, 0);
      this.root.add(this.leftLegPivot);

      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.65, 0.20), mPants);
      legL.position.set(0, -0.325, 0);
      legL.castShadow = true;
      const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.25), mBoots);
      bootL.position.set(0, -0.56, 0.02);
      bootL.castShadow = true;
      this.leftLegPivot.add(legL, bootL);

      this.rightLegPivot = new THREE.Group();
      this.rightLegPivot.position.set(0.15, 0.66, 0);
      this.root.add(this.rightLegPivot);

      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.65, 0.20), mPants);
      legR.position.set(0, -0.325, 0);
      legR.castShadow = true;
      const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.18, 0.25), mBoots);
      bootR.position.set(0, -0.56, 0.02);
      bootR.castShadow = true;
      this.rightLegPivot.add(legR, bootR);

      // ---- 4. Braços e Ombros ----
      this.armsGroup = new THREE.Group();
      this.torso.add(this.armsGroup);

      this.rightArmPivot = new THREE.Group();
      this.rightArmPivot.position.set(0.31, 1.15, 0);
      this.armsGroup.add(this.rightArmPivot);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.15), mUniform);
      armR.position.set(0, -0.16, 0.08);
      armR.rotation.x = -0.55;
      armR.rotation.y = -0.22;
      armR.castShadow = true;

      const handR = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), mBoots);
      handR.position.set(-0.06, -0.28, 0.24);
      handR.castShadow = true;
      this.rightArmPivot.add(armR, handR);

      this.leftArmPivot = new THREE.Group();
      this.leftArmPivot.position.set(-0.31, 1.15, 0);
      this.armsGroup.add(this.leftArmPivot);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.38, 0.15), mUniform);
      armL.position.set(0.08, -0.15, 0.12);
      armL.rotation.x = -0.75;
      armL.rotation.y = 0.45;
      armL.castShadow = true;

      const handL = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), mBoots);
      handL.position.set(0.18, -0.23, 0.38);
      handL.castShadow = true;
      this.leftArmPivot.add(armL, handL);

      // ---- 5. Arma Blocky ----
      this.gunGroup = new THREE.Group();
      this.gunGroup.position.set(0.10, 1.02, 0.32);
      this.gunGroup.rotation.y = -0.06;
      this.armsGroup.add(this.gunGroup);

      const gunReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.34), mGun);
      gunReceiver.castShadow = true;

      const gunHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.085, 0.18), mGunDark);
      gunHandguard.position.set(0, 0, 0.19);
      gunHandguard.castShadow = true;

      const gunBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.24), mGun);
      gunBarrel.position.set(0, 0.012, 0.40);
      gunBarrel.castShadow = true;

      const gunMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.06), mGunDark);
      gunMuzzle.position.set(0, 0.012, 0.53);
      gunMuzzle.castShadow = true;

      const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.09), mGunDark);
      gunMag.position.set(0, -0.11, 0.06);
      gunMag.rotation.x = 0.22;
      gunMag.castShadow = true;

      const gunStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.11, 0.16), mGunDark);
      gunStock.position.set(0, 0.005, -0.22);
      gunStock.castShadow = true;

      const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.06), mGunDark);
      gunGrip.position.set(0, -0.08, -0.06);
      gunGrip.rotation.x = -0.28;
      gunGrip.castShadow = true;

      const gunSight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.10), mGunDark);
      gunSight.position.set(0, 0.060, 0.03);
      gunSight.castShadow = true;

      const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });
      this.muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), flashMat);
      this.muzzleFlash.position.set(0, 0.012, 0.58);
      this.muzzleFlash.visible = false;

      this.gunGroup.add(
        gunReceiver, gunHandguard, gunBarrel, gunMuzzle,
        gunMag, gunStock, gunGrip, gunSight, this.muzzleFlash
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
      if (speed > 0.15) {
        this.walkTime += dt * speed * 3.8;
        const swing = Math.sin(this.walkTime);

        this.leftLegPivot.rotation.x = swing * 0.65;
        this.rightLegPivot.rotation.x = -swing * 0.65;
        this.torso.position.y = Math.abs(swing) * 0.035;
        this.gunGroup.position.y = 1.02 + Math.abs(swing) * 0.02;
        this.gunGroup.rotation.z = -swing * 0.03;
      } else {
        this.leftLegPivot.rotation.x *= Math.max(0, 1 - dt * 12);
        this.rightLegPivot.rotation.x *= Math.max(0, 1 - dt * 12);
        this.torso.position.y *= Math.max(0, 1 - dt * 12);

        this.idleTime += dt * 2.2;
        this.gunGroup.position.y = 1.02 + Math.sin(this.idleTime) * 0.006;
        this.gunGroup.rotation.z *= Math.max(0, 1 - dt * 8);
      }

      // Aplicação de Lean / Peek tático no tronco e arma do Soldado
      const lean = this.character.lean || 0;
      if (this.torso) {
        this.torso.rotation.z = -lean * 0.20; // ~11.5 graus de inclinação
        this.torso.position.x = lean * 0.15;  // 15cm de deslocamento lateral da cabeça/tronco
      }
      if (this.gunGroup) {
        this.gunGroup.rotation.z += -lean * 0.16;
        this.gunGroup.position.x = 0.08 + lean * 0.14;
      }

      this.root.position.set(charPos.x, charPos.y, charPos.z);
    }

    this.root.rotation.y = this.character.yaw;
  }

  destroy() {
    if (this.root) {
      this.root.traverse(o => {
        if (o.geometry) {
          o.geometry.dispose();
        }
        if (o.material) {
          if (Array.isArray(o.material)) {
            o.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
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
