/**
 * ============================================================================
 *     SMITH & WESSON MODEL 500 MAGNUM — PERFORMANCE CENTER FACELIFT v2.0
 * ============================================================================
 * Aço inoxidável escovado procedural, tambor de 6 câmaras carregado com
 * cartuchos .500 Magnum em latão/cobre e miras de alvo de alto contraste
 * preservadas em Y = 0.046.
 * ============================================================================
 */

import * as THREE from 'three';

function makeBrushedStainlessTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 128, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#e3e8ee');
  grad.addColorStop(0.5, '#cfd6df');
  grad.addColorStop(1.0, '#dfe4eb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SW_STAINLESS_TEX = makeBrushedStainlessTexture();

// Materiais PBR Fiéis ao Smith & Wesson 500 Magnum
export const M_SW_STAINLESS = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: SW_STAINLESS_TEX,
  roughness: 0.20,
  metalness: 0.86
});

export const M_SW_STEEL_DARK = new THREE.MeshStandardMaterial({
  color: 0x22252a,
  roughness: 0.34,
  metalness: 0.65
});

export const M_SW_RUBBER = new THREE.MeshStandardMaterial({
  color: 0x151719,
  roughness: 0.78,
  metalness: 0.10
});

export const M_SW_BORE = new THREE.MeshStandardMaterial({
  color: 0x0c0e10,
  roughness: 0.55,
  metalness: 0.75
});

export const M_SW_RED_RAMP = new THREE.MeshBasicMaterial({
  color: 0xff3824
});

const M_SW_BRASS       = new THREE.MeshStandardMaterial({ color: 0xe2bc52, roughness: 0.18, metalness: 0.92 });
const M_SW_COPPER      = new THREE.MeshStandardMaterial({ color: 0xc86634, roughness: 0.25, metalness: 0.85 });
const M_SW_WHITE_DOT   = new THREE.MeshBasicMaterial({ color: 0xf4f7fa });

/* =========================================================
   FÍSICA DE RECUO DRAMÁTICO DE 1.10s DO S&W 500 MAGNUM
   ========================================================= */
export class SW500Physics {
  constructor(revolver, cylinder, hammer, flashObj) {
    this.revolver = revolver;
    this.cylinder = cylinder;
    this.hammer = hammer;
    this.flashObj = flashObj;

    this.DURATION = 1.10;
    this.RISE_TIME = 0.075;
    this.timer = 0;
    this.active = false;
    this.shake = 0;

    this.currentCylRot = 0;
    this.targetCylRot = 0;
    this.flashTimer = 0;
  }

  onFire() {
    this.timer = 0.0001;
    this.active = true;
    this.shake = 0.95;

    this.targetCylRot += Math.PI / 3;

    if (this.flashObj) {
      this.flashTimer = 0.065;
      const { muzzleFlash, muzzleLight } = this.flashObj;
      if (muzzleFlash) {
        muzzleFlash.visible = true;
        const sc = 1.1 + Math.random() * 0.5;
        muzzleFlash.scale.setScalar(sc);
        muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
      }
      if (muzzleLight) muzzleLight.intensity = 18;
    }
  }

  onReload() {
    this.targetCylRot += Math.PI * 2;
  }

  update(dt, camera) {
    if (this.active) {
      this.timer += dt;
      if (this.timer >= this.DURATION) {
        this.timer = 0;
        this.active = false;
        this.revolver.position.set(0, 0, 0);
        this.revolver.rotation.set(0, 0, 0);
        if (this.hammer) this.hammer.rotation.x = 0;
      } else {
        let k = 0;
        if (this.timer < this.RISE_TIME) {
          const u = this.timer / this.RISE_TIME;
          k = 1 - Math.pow(1 - u, 3);
        } else {
          const d = (this.timer - this.RISE_TIME) / (this.DURATION - this.RISE_TIME);
          k = Math.pow(1 - d, 1.65);
        }

        this.revolver.rotation.x = k * 0.78;
        this.revolver.rotation.z = k * 0.12;
        this.revolver.position.y = k * 0.045;
        this.revolver.position.z = k * 0.068;

        if (this.hammer) {
          this.hammer.rotation.x = this.timer < 0.18 ? 0.45 : k * 0.20;
        }
      }
    }

    this.currentCylRot += (this.targetCylRot - this.currentCylRot) * (1 - Math.exp(-dt * 14));
    if (this.cylinder) {
      this.cylinder.rotation.z = this.currentCylRot;
    }

    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 8));

    if (this.flashTimer > 0 && this.flashObj) {
      this.flashTimer -= dt;
      const f = Math.max(0, this.flashTimer / 0.065);
      if (this.flashObj.muzzleLight) this.flashObj.muzzleLight.intensity = 18 * f;
      if (this.flashTimer <= 0) {
        if (this.flashObj.muzzleFlash) this.flashObj.muzzleFlash.visible = false;
        if (this.flashObj.muzzleLight) this.flashObj.muzzleLight.intensity = 0;
      }
    }
  }
}

export function buildSW500() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);

  /* =========================================================
     1. CHASSI PRINCIPAL X-FRAME (FRAME & RECOIL SHIELD)
     ========================================================= */
  const frameRear = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.062, 0.046), M_SW_STAINLESS);
  frameRear.position.set(0, 0.012, 0.024);

  const recoilShield = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.033, 16), M_SW_STAINLESS);
  recoilShield.rotation.z = Math.PI / 2;
  recoilShield.position.set(0, 0.012, 0.005);

  const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.110), M_SW_STAINLESS);
  topStrap.position.set(0, 0.036, -0.030);

  const bottomStrap = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.010, 0.088), M_SW_STAINLESS);
  bottomStrap.position.set(0, -0.018, -0.032);

  const frameFront = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.058, 0.026), M_SW_STAINLESS);
  frameFront.position.set(0, 0.012, -0.082);

  const tgBottom = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.048), M_SW_STAINLESS);
  tgBottom.position.set(0, -0.042, 0.002);

  const tgFront = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.005), M_SW_STAINLESS);
  tgFront.rotation.x = -0.32;
  tgFront.position.set(0, -0.030, -0.018);

  const tgRear = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.022, 0.005), M_SW_STAINLESS);
  tgRear.rotation.x = 0.35;
  tgRear.position.set(0, -0.032, 0.024);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.008), M_SW_STEEL_DARK);
  trigger.rotation.x = -0.30;
  trigger.position.set(0, -0.028, 0.002);

  const hammerGroup = new THREE.Group();
  hammerGroup.position.set(0, 0.020, 0.032);
  hammerGroup.rotation.x = 0.25;

  const hammerBase = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.024, 0.016), M_SW_STEEL_DARK);
  hammerBase.rotation.x = -0.22;
  hammerBase.position.set(0, 0.006, 0.002);

  const hammerSpur = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.005, 0.014), M_SW_STEEL_DARK);
  hammerSpur.rotation.x = -0.45;
  hammerSpur.position.set(0, 0.014, 0.010);
  hammerGroup.add(hammerBase, hammerSpur);

  const cylinderLatch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.018), M_SW_STEEL_DARK);
  cylinderLatch.position.set(-0.018, 0.020, 0.020);

  const screw1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 8), M_SW_STEEL_DARK);
  screw1.rotation.z = Math.PI / 2;
  screw1.position.set(0.0175, 0.014, 0.032);

  const screw2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 8), M_SW_STEEL_DARK);
  screw2.rotation.z = Math.PI / 2;
  screw2.position.set(0.0175, -0.006, 0.018);

  /* =========================================================
     2. TAMBOR DE 6 TIROS COM MUNIÇÃO .500 MAGNUM (CYLINDER)
     ========================================================= */
  const cylinderGroup = new THREE.Group();
  cylinderGroup.position.set(0, 0.010, -0.036);

  const cylRadius = 0.021;
  const cylLength = 0.068;
  const cylinderMain = new THREE.Mesh(new THREE.CylinderGeometry(cylRadius, cylRadius, cylLength, 24), M_SW_STAINLESS);
  cylinderMain.rotation.x = Math.PI / 2;
  cylinderGroup.add(cylinderMain);

  const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, cylLength + 0.015, 12), M_SW_STEEL_DARK);
  centerPin.rotation.x = Math.PI / 2;
  cylinderGroup.add(centerPin);

  for (let i = 0; i < 6; i++) {
    // Ranhuras externas (Flutes)
    const fluteAngle = (i * Math.PI) / 3;
    const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, cylLength - 0.016, 10), M_SW_STEEL_DARK);
    flute.rotation.x = Math.PI / 2;
    flute.position.set(
      Math.sin(fluteAngle) * (cylRadius - 0.0018),
      Math.cos(fluteAngle) * (cylRadius - 0.0018),
      0
    );
    cylinderGroup.add(flute);

    // Cartuchos .500 S&W Magnum alojados nas 6 câmaras (entre os flutes)
    const chAngle = fluteAngle + Math.PI / 6;
    const cx = Math.sin(chAngle) * 0.0125;
    const cy = Math.cos(chAngle) * 0.0125;

    // Culote de latão visível atrás e ponta de cobre visível na frente do tambor
    const brassRim = new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0044, cylLength + 0.002, 10), M_SW_BRASS);
    brassRim.rotation.x = Math.PI / 2;
    brassRim.position.set(cx, cy, 0.001);
    cylinderGroup.add(brassRim);

    const bulletTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0042, 0.006, 10), M_SW_COPPER);
    bulletTip.rotation.x = Math.PI / 2;
    bulletTip.position.set(cx, cy, -cylLength * 0.5 - 0.001);
    cylinderGroup.add(bulletTip);
  }

  const crane = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.022), M_SW_STAINLESS);
  crane.position.set(0, -0.012, -0.034);
  cylinderGroup.add(crane);

  /* =========================================================
     3. CANO LONGO 8.38" COM CONTRAPESO TOTAL (FULL UNDERLUG)
     ========================================================= */
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.016, -0.095);

  const barrelLength = 0.225;
  const barrelZ = -barrelLength * 0.5;

  const barrelTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0108, 0.0108, barrelLength, 18), M_SW_STAINLESS);
  barrelTube.rotation.x = Math.PI / 2;
  barrelTube.position.set(0, 0, barrelZ);
  barrelGroup.add(barrelTube);

  const underlug = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.019, barrelLength), M_SW_STAINLESS);
  underlug.position.set(0, -0.012, barrelZ);
  barrelGroup.add(underlug);

  const topRib = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, barrelLength), M_SW_STEEL_DARK);
  topRib.position.set(0, 0.014, barrelZ);
  barrelGroup.add(topRib);

  const underlugSlotL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.008, barrelLength - 0.04), M_SW_STEEL_DARK);
  underlugSlotL.position.set(-0.010, -0.012, barrelZ);
  barrelGroup.add(underlugSlotL);

  const underlugSlotR = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.008, barrelLength - 0.04), M_SW_STEEL_DARK);
  underlugSlotR.position.set(0.010, -0.012, barrelZ);
  barrelGroup.add(underlugSlotR);

  const ejectorShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.052, 10), M_SW_STEEL_DARK);
  ejectorShroud.rotation.x = Math.PI / 2;
  ejectorShroud.position.set(0, -0.008, -0.028);
  barrelGroup.add(ejectorShroud);

  /* =========================================================
     4. COMPENSADOR DE BOCA INTEGRADO (MUZZLE COMPENSATOR)
     ========================================================= */
  const compGroup = new THREE.Group();
  const compLength = 0.035;
  compGroup.position.set(0, 0.016, -0.095 - barrelLength);

  const compBody = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.038, compLength), M_SW_STEEL_DARK);
  compBody.position.set(0, -0.004, -compLength * 0.5);
  compGroup.add(compBody);

  const compSlant = new THREE.Mesh(new THREE.BoxGeometry(0.0232, 0.016, 0.018), M_SW_STEEL_DARK);
  compSlant.rotation.x = 0.45;
  compSlant.position.set(0, -0.014, -compLength + 0.006);
  compGroup.add(compSlant);

  const vent1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), M_SW_BORE);
  vent1.position.set(0, 0.012, -0.010);
  compGroup.add(vent1);

  const vent2 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), M_SW_BORE);
  vent2.position.set(0, 0.012, -0.022);
  compGroup.add(vent2);

  const muzzleCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 16), M_SW_BORE);
  muzzleCrown.rotation.x = Math.PI / 2;
  muzzleCrown.position.set(0, 0, -compLength + 0.002);
  compGroup.add(muzzleCrown);

  /* =========================================================
     5. EMPUNHADURA ERGONÔMICA HOGUE RUBBER PRETA
     ========================================================= */
  const gripGroup = new THREE.Group();
  gripGroup.position.set(0, -0.014, 0.040);
  gripGroup.rotation.x = 0.38;

  const gripMain = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.115, 0.042), M_SW_RUBBER);
  gripMain.position.set(0, -0.055, 0.002);
  gripGroup.add(gripMain);

  const gripBack = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.088, 0.012), M_SW_STAINLESS);
  gripBack.position.set(0, -0.048, 0.024);
  gripGroup.add(gripBack);

  const groove1 = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.012), M_SW_RUBBER);
  groove1.position.set(0, -0.024, -0.022);
  gripGroup.add(groove1);

  const groove2 = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.012), M_SW_RUBBER);
  groove2.position.set(0, -0.050, -0.022);
  gripGroup.add(groove2);

  const groove3 = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.012), M_SW_RUBBER);
  groove3.position.set(0, -0.076, -0.022);
  gripGroup.add(groove3);

  const logoL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), M_SW_BRASS);
  logoL.rotation.z = Math.PI / 2;
  logoL.position.set(-0.0165, -0.042, 0.006);
  gripGroup.add(logoL);

  const logoR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), M_SW_BRASS);
  logoR.rotation.z = Math.PI / 2;
  logoR.position.set(0.0165, -0.042, 0.006);
  gripGroup.add(logoR);

  /* =========================================================
     6. CONJUNTO DE MIRAS ALVO (CENTRADO EM Y = 0.046 EXATO)
     ========================================================= */
  const rearSightMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.005, 0.030), M_SW_STEEL_DARK);
  rearSightMount.position.set(0, 0.0435, 0.015);

  const rearBladeL = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.004), M_SW_STEEL_DARK);
  rearBladeL.position.set(-0.008, 0.050, 0.030);

  const rearBladeR = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.004), M_SW_STEEL_DARK);
  rearBladeR.position.set(0.008, 0.050, 0.030);

  // Pontos brancos de alinhamento na alça traseira
  const rearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 6, 6), M_SW_WHITE_DOT);
  rearDotL.position.set(-0.0058, 0.050, 0.032);
  const rearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 6, 6), M_SW_WHITE_DOT);
  rearDotR.position.set(0.0058, 0.050, 0.032);

  const elevScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.002, 8), M_SW_BRASS);
  elevScrew.position.set(0, 0.046, 0.018);

  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.032), M_SW_STAINLESS);
  frontSightBase.position.set(0, 0.038, -0.320);

  const frontBlade = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.024), M_SW_STEEL_DARK);
  frontBlade.position.set(0, 0.046, -0.320);

  const redRamp = new THREE.Mesh(new THREE.BoxGeometry(0.0044, 0.008, 0.012), M_SW_RED_RAMP);
  redRamp.rotation.x = -0.42;
  redRamp.position.set(0, 0.046, -0.316);

  /* =========================================================
     7. CLARÃO DE BOCA & MONTAGEM FINAL DO GRUPO
     ========================================================= */
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffcc55,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), flashMat);
  muzzleFlash.position.set(0, 0.016, -0.375);
  muzzleFlash.visible = false;

  const muzzleLight = new THREE.PointLight(0xffaa44, 0, 9, 1.5);
  muzzleLight.position.set(0, 0.016, -0.375);

  g.add(
    frameRear, recoilShield, topStrap, bottomStrap, frameFront,
    tgBottom, tgFront, tgRear, trigger,
    hammerGroup, cylinderLatch, screw1, screw2,
    cylinderGroup, barrelGroup, compGroup, gripGroup,
    rearSightMount, rearBladeL, rearBladeR, rearDotL, rearDotR, elevScrew,
    frontSightBase, frontBlade, redRamp,
    muzzleFlash, muzzleLight
  );

  root.traverse(o => {
    if (o.isMesh && o !== muzzleFlash) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const physics = new SW500Physics(g, cylinderGroup, hammerGroup, {
    muzzleFlash,
    muzzleLight
  });

  return {
    group: root,
    physics
  };
}