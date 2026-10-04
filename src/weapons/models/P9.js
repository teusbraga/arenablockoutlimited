/**
 * ============================================================================
 *               P-9 TACTICAL COMBAT PISTOL — FACELIFT PROCEDURAL
 * ============================================================================
 * Pistola tática semi-automática de alta precisão.
 * Modelagem procedural refinada com ferrolho usinado (Slide), sistema de blowback
 * dinâmico, alavanca de manejo tática (Slide Racker CNC), câmara dourada/cano
 * de aço fosfatizado, extrator mecânico, armação de polímero com trilho Picatinny,
 * punho anatômico, miras de trítio de 3 pontos alinhadas e física de recuo
 * herdada da arquitetura do protótipo (slide lock no último tiro e retorno no reload).
 * ============================================================================
 */

import * as THREE from 'three';
import { GLOW_TEX } from './RiflePrototype.js';

// Materiais PBR Táticos da P-9
const M_SLIDE_MATTE  = new THREE.MeshStandardMaterial({ color: 0x6e7681, roughness: 0.22, metalness: 0.90 });
const M_SLIDE_BEVEL  = new THREE.MeshStandardMaterial({ color: 0x868e96, roughness: 0.18, metalness: 0.94 });
const M_FRAME_POLY   = new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.72, metalness: 0.15 });
const M_GRIP_PANEL   = new THREE.MeshStandardMaterial({ color: 0x212529, roughness: 0.90, metalness: 0.05 });
const M_BARREL_STEEL = new THREE.MeshStandardMaterial({ color: 0x8f99a5, roughness: 0.14, metalness: 0.96 });
const M_CHAMBER_GOLD = new THREE.MeshStandardMaterial({ color: 0xdfb850, roughness: 0.20, metalness: 0.92 });
const M_EXTRACTOR    = new THREE.MeshStandardMaterial({ color: 0x9ca6b3, roughness: 0.15, metalness: 0.95 });
const M_TRIT_GREEN   = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
const M_SIGHT_BODY   = new THREE.MeshStandardMaterial({ color: 0x545b64, roughness: 0.35, metalness: 0.80 });

/* ============================================================
   FÍSICA DO SLIDE & SISTEMA DE BLOWBACK DA P-9
   (Baseada na arquitetura e dinâmica de manejo do RiflePrototype)
   ============================================================ */
export class P9Physics {
  constructor(pistol, slide, flashObj) {
    this.pistol = pistol;
    this.slide = slide;
    this.flashObj = flashObj;

    this.recoil = 0;
    this.shake = 0;
    this.slideCycle = 1;
    this.slideOpen = false;
    this.slideOpenAmt = 0;
    this.flashTimer = 0;
  }

  onFire(ammo = 12) {
    // 1. Inicia ciclo seco e rápido de blowback do ferrolho
    this.slideCycle = 0;

    // 2. Impulso de recuo elástico e muzzle flip
    this.recoil = Math.min(this.recoil + 0.38, 1.0);
    this.shake = Math.min(this.shake + 0.45, 0.9);

    // 3. Muzzle Flash dinâmico
    if (this.flashObj) {
      this.flashTimer = 0.045;
      const { muzzleFlash, muzzleFlash2, muzzleLight } = this.flashObj;
      if (muzzleFlash) {
        muzzleFlash.visible = true;
        if (muzzleFlash2) muzzleFlash2.visible = true;
        const sc = 0.65 + Math.random() * 0.35;
        muzzleFlash.scale.setScalar(sc);
        if (muzzleFlash2) muzzleFlash2.scale.setScalar(sc * 0.85);
        muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
        if (muzzleLight) muzzleLight.intensity = 10;
      }
    }
  }

  onReload() {
    // Ao recarregar, destrava o retém do ferrolho e avança o slide para a frente
    this.slideOpen = false;
  }

  update(dt, camera, ammo = 12) {
    // ---- 1. Blowback do Ferrolho e Slide Racker ----
    if (this.slideCycle < 1) {
      this.slideCycle = Math.min(1, this.slideCycle + dt / 0.070);
    }

    // Trava aberta (Slide Lock) no último disparo quando esgotar a munição
    if (this.slideCycle >= 1 && ammo <= 0 && !this.slideOpen) {
      this.slideOpen = true;
    }
    const targetOpen = this.slideOpen ? 1 : 0;
    this.slideOpenAmt += (targetOpen - this.slideOpenAmt) * (1 - Math.exp(-dt * 18));

    // Deslocamento do slide ao longo do eixo Z (recua em +Z para trás)
    const slideTravel = 0.038;
    const cycleOff = this.slideCycle < 1
      ? slideTravel * Math.sin(Math.PI * this.slideCycle)
      : 0;
    const openOff = slideTravel * this.slideOpenAmt;
    this.slide.position.z = cycleOff + openOff;

    // ---- 2. Recoil elástico da Pistola (Muzzle Climb) ----
    const recoilDecay = 1 - Math.exp(-dt * 7.5);
    this.recoil += (0 - this.recoil) * recoilDecay;
    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 10));

    const r = this.recoil;
    this.pistol.position.z = r * 0.016;
    this.pistol.position.y = r * 0.007;
    this.pistol.rotation.x = r * 0.088; // Cano empina sutilmente no recuo

    // ---- 3. Muzzle Flash Fade ----
    if (this.flashObj && this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(this.flashTimer / 0.045, 0);
      if (this.flashObj.flashMat) this.flashObj.flashMat.opacity = k * 0.95;
      if (this.flashObj.muzzleLight) this.flashObj.muzzleLight.intensity = 10 * k;
      if (this.flashTimer <= 0) {
        if (this.flashObj.muzzleFlash) this.flashObj.muzzleFlash.visible = false;
        if (this.flashObj.muzzleFlash2) this.flashObj.muzzleFlash2.visible = false;
        if (this.flashObj.muzzleLight) this.flashObj.muzzleLight.intensity = 0;
      } else if (camera && this.flashObj.muzzleFlash) {
        this.flashObj.muzzleFlash.lookAt(camera.position);
        if (this.flashObj.muzzleFlash2) this.flashObj.muzzleFlash2.lookAt(camera.position);
      }
    }
  }
}

export function buildP9() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);

  /* =========================================================
     1. FERROLHO MÓVEL (SLIDE GROUP) & MANEJO (CHARGING HANDLE)
     ========================================================= */
  const slide = new THREE.Group();
  g.add(slide);

  // Bloco frontal do ferrolho (à frente da janela de ejeção)
  const slideFront = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.027, 0.074), M_SLIDE_MATTE);
  slideFront.position.set(0, 0.016, -0.063);

  // Bloco traseiro do ferrolho (atrás da janela de ejeção)
  const slideRear = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.027, 0.064), M_SLIDE_MATTE);
  slideRear.position.set(0, 0.016, 0.038);

  // Ponte lateral esquerda do ferrolho (conecta a frente e a traseira pelo lado esquerdo)
  const slideBridge = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.027, 0.032), M_SLIDE_MATTE);
  slideBridge.position.set(-0.009, 0.016, -0.010);

  // Topo chanfrado do ferrolho
  const slideTopFront = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.074), M_SLIDE_BEVEL);
  slideTopFront.position.set(0, 0.030, -0.063);

  const slideTopRear = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.064), M_SLIDE_BEVEL);
  slideTopRear.position.set(0, 0.030, 0.038);

  const slideTopBridge = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.007, 0.032), M_SLIDE_BEVEL);
  slideTopBridge.position.set(-0.0075, 0.030, -0.010);

  slide.add(slideFront, slideRear, slideBridge, slideTopFront, slideTopRear, slideTopBridge);

  // Serrilhados de manejo traseiros (serrations)
  for (let i = 0; i < 5; i++) {
    const z = 0.040 + i * 0.005;
    const serL = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.018, 0.0022), M_SLIDE_BEVEL);
    serL.position.set(-0.0132, 0.018, z);
    const serR = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.018, 0.0022), M_SLIDE_BEVEL);
    serR.position.set(0.0132, 0.018, z);
    slide.add(serL, serR);
  }

  // Serrilhados de manejo frontais (press check serrations)
  for (let i = 0; i < 4; i++) {
    const z = -0.065 + i * 0.005;
    const serFL = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.016, 0.0022), M_SLIDE_BEVEL);
    serFL.position.set(-0.0132, 0.017, z);
    const serFR = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.016, 0.0022), M_SLIDE_BEVEL);
    serFR.position.set(0.0132, 0.017, z);
    slide.add(serFL, serFR);
  }

  // Extrator mecânico de estojos lateral (montado no slide)
  const extractor = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.014), M_EXTRACTOR);
  extractor.position.set(0.0134, 0.022, 0.004);
  slide.add(extractor);

  /* ---- ALAVANCA DE MANEJO TÁTICA DO SLIDE (SLIDE RACKER CNC) ---- */
  // Inspirada na lógica ergonômica de combate do RiflePrototype, montada no lado esquerdo do ferrolho (-X)
  const slideHandle = new THREE.Group();
  slideHandle.position.set(-0.013, 0.022, 0.045);

  // Haste usinada de encaixe
  const rackerStem = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.012, 8), M_SLIDE_BEVEL);
  rackerStem.rotation.z = Math.PI / 2;
  rackerStem.position.set(-0.006, 0, 0);

  // Manípulo tático de combate estriado (Knurled Combat Knob) em tom dourado/accent
  const rackerKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0048, 0.014, 10), M_CHAMBER_GOLD);
  rackerKnob.rotation.z = Math.PI / 2;
  rackerKnob.position.set(-0.018, 0, 0);

  const rackerTip = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 8), M_SLIDE_MATTE);
  rackerTip.position.set(-0.025, 0, 0);

  slideHandle.add(rackerStem, rackerKnob, rackerTip);
  slide.add(slideHandle);

  /* =========================================================
     2. MIRAS DE TRÍTIO TÁTICAS (MONTADAS NO SLIDE)
     Coordenadas rigorosamente preservadas para exatidão do ADS
     ========================================================= */
  // Poste da massa de mira dianteira
  const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.0085, 0.005), M_SIGHT_BODY);
  frontPost.position.set(0, 0.035, -0.083);
  // Ponto de trítio frontal verde fosforescente
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 8), M_TRIT_GREEN);
  frontDot.position.set(0, 0.036, -0.083);

  // Alça de mira traseira em U (Rear Sight)
  const rearBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.008), M_SIGHT_BODY);
  rearBase.position.set(0, 0.033, 0.058);

  const rearL = new THREE.Mesh(new THREE.BoxGeometry(0.0055, 0.0075, 0.006), M_SIGHT_BODY);
  rearL.position.set(-0.0075, 0.037, 0.058);
  const rearR = new THREE.Mesh(new THREE.BoxGeometry(0.0055, 0.0075, 0.006), M_SIGHT_BODY);
  rearR.position.set(0.0075, 0.037, 0.058);

  // Pontos de trítio traseiros verde fosforescentes
  const rearDotL = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 8, 8), M_TRIT_GREEN);
  rearDotL.position.set(-0.0075, 0.037, 0.057);
  const rearDotR = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 8, 8), M_TRIT_GREEN);
  rearDotR.position.set(0.0075, 0.037, 0.057);

  slide.add(frontPost, frontDot, rearBase, rearL, rearR, rearDotL, rearDotR);

  /* =========================================================
     3. CANO, CÂMARA & ARMAÇÃO FIXA (FRAME)
     ========================================================= */
  // Câmara dourada usinada (visível na janela de ejeção aberta/fechada)
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.030), M_CHAMBER_GOLD);
  chamber.position.set(0.004, 0.021, -0.010);

  // Cano usinado de aço (fica fixo na armação; o slide desliza sobre ele)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.020, 14), M_BARREL_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.014, -0.103);

  // Orifício vazado do cano (Bore hole)
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 12), M_GRIP_PANEL);
  bore.rotation.x = Math.PI / 2;
  bore.position.set(0, 0.014, -0.111);

  // Armação superior do chassi
  const frameMain = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.032, 0.125), M_FRAME_POLY);
  frameMain.position.set(0, -0.010, -0.012);

  // Trilho de acessórios táticos inferior (Picatinny rail 1913)
  const underRail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.052), M_FRAME_POLY);
  underRail.position.set(0, -0.012, -0.065);
  // Ranhura transversal do trilho Picatinny
  const railSlot = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.003, 0.005), M_SLIDE_BEVEL);
  railSlot.position.set(0, -0.014, -0.065);

  // Alavanca de retém do ferrolho (Slide Catch)
  const slideCatch = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.016), M_BARREL_STEEL);
  slideCatch.position.set(-0.0132, 0.004, 0.005);

  // Empunhadura com ângulo natural
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.102, 0.046), M_FRAME_POLY);
  grip.position.set(0, -0.070, 0.050);
  grip.rotation.x = -0.22;

  // Painéis texturizados antiderrapantes nas laterais
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.075, 0.036), M_GRIP_PANEL);
  panelL.position.set(-0.0128, -0.070, 0.050);
  panelL.rotation.x = -0.22;
  const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.075, 0.036), M_GRIP_PANEL);
  panelR.position.set(0.0128, -0.070, 0.050);
  panelR.rotation.x = -0.22;

  // Beavertail ergonômico traseiro
  const beavertail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.024), M_FRAME_POLY);
  beavertail.position.set(0, -0.010, 0.068);
  beavertail.rotation.x = 0.35;

  // Base do carregador (Magazine Baseplate)
  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.008, 0.048), M_SLIDE_MATTE);
  magBase.position.set(0, -0.120, 0.064);
  magBase.rotation.x = -0.22;

  // Guarda-mato tático reforçado com descanso frontal de dedo
  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0045, 0.044), M_FRAME_POLY);
  trigGuard.position.set(0, -0.042, 0.010);
  const trigGuardFront = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.025, 0.0045), M_FRAME_POLY);
  trigGuardFront.position.set(0, -0.030, -0.012);

  // Gatilho anatômico esportivo com lâmina de segurança
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.020, 0.007), M_SLIDE_BEVEL);
  trigger.position.set(0, -0.028, 0.010);
  trigger.rotation.x = 0.28;

  g.add(
    chamber, barrel, bore,
    frameMain, underRail, railSlot, slideCatch,
    grip, panelL, panelR, beavertail, magBase,
    trigGuard, trigGuardFront, trigger
  );

  /* =========================================================
     4. MUZZLE FLASH E LIGHT DINÂMICOS
     ========================================================= */
  const MUZZLE_LOCAL = new THREE.Vector3(0, 0.014, -0.115);

  const flashMat = new THREE.MeshBasicMaterial({
    map: GLOW_TEX,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffea70
  });

  const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
  muzzleFlash.position.copy(MUZZLE_LOCAL);
  muzzleFlash.visible = false;
  g.add(muzzleFlash);

  const muzzleFlash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
  muzzleFlash2.position.copy(MUZZLE_LOCAL);
  muzzleFlash2.rotation.x = Math.PI / 2;
  muzzleFlash2.visible = false;
  g.add(muzzleFlash2);

  const muzzleLight = new THREE.PointLight(0xffcc44, 0, 1.2, 1.8);
  muzzleLight.position.set(0, 0.02, -0.12);
  g.add(muzzleLight);

  const physics = new P9Physics(g, slide, {
    muzzleFlash,
    muzzleFlash2,
    muzzleLight,
    flashMat
  });

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });

  return {
    group: root,
    pistol: g,
    slide,
    physics
  };
}
