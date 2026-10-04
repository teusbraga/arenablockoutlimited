/**
 * ============================================================================
 *         SMITH & WESSON MODEL 500 MAGNUM — PROCEDURAL 3D MODEL
 * ============================================================================
 * O revólver de produção mais potente do mundo (calibre .500 S&W Magnum).
 * Cano longo de 8.38 polegadas com contrapeso total (full underlug),
 * compensador integrado de boca com portas de alívio, chassi X-Frame maciço
 * em aço inoxidável escovado/polido e empunhadura anatômica em borracha Hogue.
 *
 * DETALHES DE ALTA FIDELIDADE:
 *   1. Chassi X-Frame em Aço Inox Acetinado (Satin Stainless Steel):
 *      - Armação maciça com ponte superior pesada (top strap) e guarda-mato curvo.
 *      - Cão externo usinado (hammer) com serrilhado de armar.
 *      - Gatilho esportivo curvo em aço inox polido.
 *      - Botão de abertura do tambor (cylinder release thumb latch) no lado esquerdo.
 *   2. Tambor Maciço de 6 Câmaras (Fluted Cylinder):
 *      - Tambor de grande diâmetro com 6 alívios de rotação usinados (flutes).
 *      - Suporte basculante do tambor (crane / yoke) e haste central do extrator.
 *   3. Conjunto de Cano Longo 8.38" com Contrapeso Total (Full Underlug):
 *      - Cano cilíndrico robusto com cobertura maciça inferior de contrapeso.
 *      - Nervura superior plana antirreflexo ao longo de todo o cano.
 *   4. Compensador de Boca de Alta Eficiência (Muzzle Compensator):
 *      - Extremidade dianteira com corte em chanfro e 2 aberturas superiores
 *        de escape de gases para controle do monumental recuo.
 *      - Boca do cano de grande calibre .50 (12.7mm) escavada.
 *   5. Empunhadura Ergonômica Hogue Rubber Preta:
 *      - Perfil monogrip com 3 sulcos profundos para dedos na frente.
 *      - Apoio de palma anatômico e textura fosca de borracha de alto amortecimento.
 *   6. Conjunto de Miras Alvo (Alinhamento Preciso no ADS):
 *      - Alça de mira traseira quadrada preta ajustável com parafuso micrométrico.
 *      - Massa de mira dianteira alta com rampa em vermelho vivo de alta visibilidade.
 *      - Alinhamento em ADS perfeito e nivelado (`sightLocal: [0, 0.046, -0.15]`).
 * ============================================================================
 */

import * as THREE from 'three';

// Materiais PBR Fiéis ao Smith & Wesson 500 Magnum
export const M_SW_STAINLESS = new THREE.MeshStandardMaterial({
  color: 0xd8dde4,
  roughness: 0.18,
  metalness: 0.94
});

export const M_SW_STEEL_DARK = new THREE.MeshStandardMaterial({
  color: 0x25282c,
  roughness: 0.38,
  metalness: 0.88
});

export const M_SW_RUBBER = new THREE.MeshStandardMaterial({
  color: 0x16181a,
  roughness: 0.88,
  metalness: 0.10
});

export const M_SW_BORE = new THREE.MeshStandardMaterial({
  color: 0x0f1113,
  roughness: 0.60,
  metalness: 0.70
});

export const M_SW_RED_RAMP = new THREE.MeshBasicMaterial({
  color: 0xff3824
});

/* =========================================================
   FÍSICA DE RECUO DRAMÁTICO DE 1.10s DO S&W 500 MAGNUM
   ========================================================= */
export class SW500Physics {
  constructor(revolver, cylinder, hammer, flashObj) {
    this.revolver = revolver;
    this.cylinder = cylinder;
    this.hammer = hammer;
    this.flashObj = flashObj;

    this.DURATION = 1.10;   // Tempo exato de 1.10s sincronizado com fireInterval
    this.RISE_TIME = 0.075; // 75ms para subida explosiva no disparo
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

    // Indexa o tambor de 6 tiros em +60 graus (PI / 3)
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
    // Giro completo do tambor no reload
    this.targetCylRot += Math.PI * 2;
  }

  update(dt, camera) {
    // 1. Curva de Recuo Dramático Assimétrica de exatamente 1.10s
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
          // Subida explosiva ultra-rápida (0.00s -> 0.075s)
          const u = this.timer / this.RISE_TIME;
          k = 1 - Math.pow(1 - u, 3);
        } else {
          // Retorno lento, pesado e dramático até a posição inicial (0.075s -> 1.10s)
          const d = (this.timer - this.RISE_TIME) / (this.DURATION - this.RISE_TIME);
          k = Math.pow(1 - d, 1.65);
        }

        // Muzzle flip monumental (~45 graus para o alto), coice para trás e torque lateral
        this.revolver.rotation.x = k * 0.78;
        this.revolver.rotation.z = k * 0.12;
        this.revolver.position.y = k * 0.045;
        this.revolver.position.z = k * 0.068;

        // Ação do cão (hammer bate à frente no tiro e rearma durante a descida)
        if (this.hammer) {
          this.hammer.rotation.x = this.timer < 0.18 ? 0.45 : k * 0.20;
        }
      }
    }

    // 2. Rotação mecânica do tambor de 6 câmaras
    this.currentCylRot += (this.targetCylRot - this.currentCylRot) * (1 - Math.exp(-dt * 14));
    if (this.cylinder) {
      this.cylinder.rotation.z = this.currentCylRot;
    }

    // 3. Decaimento de tremor de câmera
    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 8));

    // 4. Muzzle Flash Colossal .500 Magnum
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
  // Corpo central traseiro da armação (atrás do tambor)
  const frameRear = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.062, 0.046), M_SW_STAINLESS);
  frameRear.position.set(0, 0.012, 0.024);

  // Escudo de recuo curvo (Recoil shield arredondado atrás do tambor)
  const recoilShield = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.033, 16), M_SW_STAINLESS);
  recoilShield.rotation.z = Math.PI / 2;
  recoilShield.position.set(0, 0.012, 0.005);

  // Barra superior do chassi sobre o tambor (Top Strap pesada)
  const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.110), M_SW_STAINLESS);
  topStrap.position.set(0, 0.036, -0.030);

  // Barra inferior do chassi sob o tambor
  const bottomStrap = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.010, 0.088), M_SW_STAINLESS);
  bottomStrap.position.set(0, -0.018, -0.032);

  // Bloco dianteiro do chassi que recebe a rosca do cano (Frame front shank)
  const frameFront = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.058, 0.026), M_SW_STAINLESS);
  frameFront.position.set(0, 0.012, -0.082);

  // Guarda-mato curvo em aço inox polido (Trigger Guard)
  const tgBottom = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.048), M_SW_STAINLESS);
  tgBottom.position.set(0, -0.042, 0.002);

  const tgFront = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.025, 0.005), M_SW_STAINLESS);
  tgFront.rotation.x = -0.32;
  tgFront.position.set(0, -0.030, -0.018);

  const tgRear = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.022, 0.005), M_SW_STAINLESS);
  tgRear.rotation.x = 0.35;
  tgRear.position.set(0, -0.032, 0.024);

  // Gatilho esportivo curvo (Trigger)
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.008), M_SW_STAINLESS);
  trigger.rotation.x = -0.30;
  trigger.position.set(0, -0.028, 0.002);

  // Cão externo articulado com espora serrilhada (Hammer Group)
  const hammerGroup = new THREE.Group();
  hammerGroup.position.set(0, 0.024, 0.036);

  const hammerBase = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.024, 0.016), M_SW_STEEL_DARK);
  hammerBase.rotation.x = -0.22;
  hammerBase.position.set(0, 0.010, 0.002);

  const hammerSpur = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.014), M_SW_STEEL_DARK);
  hammerSpur.rotation.x = -0.45;
  hammerSpur.position.set(0, 0.019, 0.012);
  hammerGroup.add(hammerBase, hammerSpur);

  // Botão serrilhado de liberação do tambor (Cylinder Release Latch no lado esquerdo)
  const cylinderLatch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.018), M_SW_STEEL_DARK);
  cylinderLatch.position.set(-0.018, 0.020, 0.020);

  // Parafusos e pinos da placa lateral da armação (Sideplate screws)
  const screw1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 8), M_SW_STEEL_DARK);
  screw1.rotation.z = Math.PI / 2;
  screw1.position.set(0.0175, 0.014, 0.032);

  const screw2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 8), M_SW_STEEL_DARK);
  screw2.rotation.z = Math.PI / 2;
  screw2.position.set(0.0175, -0.006, 0.018);

  /* =========================================================
     2. TAMBOR MACIÇO DE 6 TIROS (6-SHOT CYLINDER & CRANE)
     ========================================================= */
  const cylinderGroup = new THREE.Group();
  cylinderGroup.position.set(0, 0.010, -0.036);

  // Corpo cilíndrico principal do tambor
  const cylRadius = 0.021;
  const cylLength = 0.068;
  const cylinderMain = new THREE.Mesh(new THREE.CylinderGeometry(cylRadius, cylRadius, cylLength, 24), M_SW_STAINLESS);
  cylinderMain.rotation.x = Math.PI / 2;
  cylinderGroup.add(cylinderMain);

  // Eixo central do tambor / vareta do extrator (Center pin / ejector rod)
  const centerPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, cylLength + 0.015, 12), M_SW_STEEL_DARK);
  centerPin.rotation.x = Math.PI / 2;
  cylinderGroup.add(centerPin);

  // Ranhuras de alívio usinadas do tambor (6 Flutes)
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const flute = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, cylLength - 0.016, 10), M_SW_STEEL_DARK);
    flute.rotation.x = Math.PI / 2;
    flute.position.set(
      Math.sin(angle) * (cylRadius - 0.0018),
      Math.cos(angle) * (cylRadius - 0.0018),
      0
    );
    cylinderGroup.add(flute);
  }

  // Suporte basculante do tambor (Crane / Yoke frontal)
  const crane = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.022), M_SW_STAINLESS);
  crane.position.set(0, -0.012, -0.034);
  cylinderGroup.add(crane);

  /* =========================================================
     3. CANO LONGO 8.38" COM CONTRAPESO TOTAL (FULL UNDERLUG BARREL)
     ========================================================= */
  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.016, -0.095);

  const barrelLength = 0.225; // Comprimento maciço do cano 8.38"
  const barrelZ = -barrelLength * 0.5;

  // Tubo cilíndrico superior do cano
  const barrelTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0108, 0.0108, barrelLength, 18), M_SW_STAINLESS);
  barrelTube.rotation.x = Math.PI / 2;
  barrelTube.position.set(0, 0, barrelZ);
  barrelGroup.add(barrelTube);

  // Contrapeso maciço inferior total (Full Underlug)
  const underlug = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.019, barrelLength), M_SW_STAINLESS);
  underlug.position.set(0, -0.012, barrelZ);
  barrelGroup.add(underlug);

  // Nervura superior contínua antirreflexo (Top Rib)
  const topRib = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, barrelLength), M_SW_STAINLESS);
  topRib.position.set(0, 0.014, barrelZ);
  barrelGroup.add(topRib);

  // Ranhuras de alívio e contorno do underlug
  const underlugSlotL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.008, barrelLength - 0.04), M_SW_STEEL_DARK);
  underlugSlotL.position.set(-0.010, -0.012, barrelZ);
  barrelGroup.add(underlugSlotL);

  const underlugSlotR = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.008, barrelLength - 0.04), M_SW_STEEL_DARK);
  underlugSlotR.position.set(0.010, -0.012, barrelZ);
  barrelGroup.add(underlugSlotR);

  // Extremidade da vareta do extrator alojada no contrapeso
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

  // Corpo do compensador com corte chanfrado dianteiro
  const compBody = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.038, compLength), M_SW_STAINLESS);
  compBody.position.set(0, -0.004, -compLength * 0.5);
  compGroup.add(compBody);

  // Chanfro angular frontal (corte clássico S&W 500)
  const compSlant = new THREE.Mesh(new THREE.BoxGeometry(0.0232, 0.016, 0.018), M_SW_STAINLESS);
  compSlant.rotation.x = 0.45;
  compSlant.position.set(0, -0.014, -compLength + 0.006);
  compGroup.add(compSlant);

  // Portas superiores verticais de alívio de gás (2 Muzzle Vents)
  const vent1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), M_SW_BORE);
  vent1.position.set(0, 0.012, -0.010);
  compGroup.add(vent1);

  const vent2 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), M_SW_BORE);
  vent2.position.set(0, 0.012, -0.022);
  compGroup.add(vent2);

  // Boca do cano monstruosa calibre .50 (12.7mm)
  const muzzleCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 16), M_SW_BORE);
  muzzleCrown.rotation.x = Math.PI / 2;
  muzzleCrown.position.set(0, 0, -compLength + 0.002);
  compGroup.add(muzzleCrown);

  /* =========================================================
     5. EMPUNHADURA ERGONÔMICA HOGUE RUBBER PRETA
     ========================================================= */
  const gripGroup = new THREE.Group();
  gripGroup.position.set(0, -0.014, 0.040);
  gripGroup.rotation.x = 0.38; // Inclinação confortável de revólver

  // Corpo principal da empunhadura em borracha texturizada
  const gripMain = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.115, 0.042), M_SW_RUBBER);
  gripMain.position.set(0, -0.055, 0.002);
  gripGroup.add(gripMain);

  // Curvatura traseira da palma (Beavertail & Palm Swell)
  const gripBack = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.088, 0.012), M_SW_RUBBER);
  gripBack.position.set(0, -0.048, 0.024);
  gripGroup.add(gripBack);

  // 3 Sulcos anatômicos profundos para os dedos na frente (Finger Grooves Hogue)
  const groove1 = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.012), M_SW_RUBBER);
  groove1.position.set(0, -0.024, -0.022);
  gripGroup.add(groove1);

  const groove2 = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.012), M_SW_RUBBER);
  groove2.position.set(0, -0.050, -0.022);
  gripGroup.add(groove2);

  const groove3 = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.014, 0.012), M_SW_RUBBER);
  groove3.position.set(0, -0.076, -0.022);
  gripGroup.add(groove3);

  // Emblema circular central S&W embutido na lateral da empunhadura
  const logoL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), M_SW_STAINLESS);
  logoL.rotation.z = Math.PI / 2;
  logoL.position.set(-0.0165, -0.042, 0.006);
  gripGroup.add(logoL);

  const logoR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 12), M_SW_STAINLESS);
  logoR.rotation.z = Math.PI / 2;
  logoR.position.set(0.0165, -0.042, 0.006);
  gripGroup.add(logoR);

  /* =========================================================
     6. CONJUNTO DE MIRAS ALVO (TARGET REAR SIGHT & RED RAMP FRONT)
     ========================================================= */
  // --- ALÇA DE MIRA TRASEIRA (Micro-Adjustable Target Rear Sight) ---
  const rearSightMount = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.042), M_SW_STEEL_DARK);
  rearSightMount.position.set(0, 0.045, 0.012);

  // Lâmina traseira com entalhe quadrado vazado (Square Notch)
  // Alinhada exatamente em Y=0.046
  const rearBladeL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.003), M_SW_STEEL_DARK);
  rearBladeL.position.set(-0.0065, 0.046, 0.032);

  const rearBladeR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.003), M_SW_STEEL_DARK);
  rearBladeR.position.set(0.0065, 0.046, 0.032);

  // Parafuso de elevação micrométrico
  const elevScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 8), M_SW_STEEL_DARK);
  elevScrew.position.set(0, 0.050, 0.018);

  // --- MASSA DE MIRA DIANTEIRA (Pinned Red Ramp Front Sight) ---
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.032), M_SW_STAINLESS);
  frontSightBase.position.set(0, 0.038, -0.320);

  // Lâmina de mira preta de tiro ao alvo
  const frontBlade = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.024), M_SW_STEEL_DARK);
  frontBlade.position.set(0, 0.046, -0.320);

  // Inserto frontal vermelho vivo de alta visibilidade (Red Ramp Insert)
  // Centrado em X=0, Y=0.046 para visada ADS perfeitamente alinhada
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
    frontSightBase, frontBlade, redRamp,
    muzzleFlash, muzzleLight
  );

  // Ativa sombras para renderização tática consistente
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
