/**
 * ============================================================================
 *               P-9 TACTICAL COMBAT PISTOL — FACELIFT PROCEDURAL
 * ============================================================================
 * Pistola tática semi-automática de alta precisão.
 * Modelagem procedural refinada com ferrolho chanfrado usinado CNC,
 * serrilhados de manejo frontais/traseiros, câmara/cano de aço fosfatizado,
 * extrator mecânico, armação de polímero com trilho Picatinny MIL-STD-1913,
 * punho anatômico com beavertail anti-mordedura de ferrolho e miras de trítio
 * de 3 pontos alinhadas.
 * ============================================================================
 */

import * as THREE from 'three';

// Materiais PBR Táticos da P-9
const M_SLIDE_MATTE = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.22, metalness: 0.90 });
const M_SLIDE_BEVEL = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.18, metalness: 0.94 });
const M_FRAME_POLY  = new THREE.MeshStandardMaterial({ color: 0x0f1114, roughness: 0.72, metalness: 0.15 });
const M_GRIP_PANEL  = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.90, metalness: 0.05 });
const M_BARREL_STEEL= new THREE.MeshStandardMaterial({ color: 0x3d434d, roughness: 0.14, metalness: 0.96 });
const M_CHAMBER_GOLD= new THREE.MeshStandardMaterial({ color: 0xdeb340, roughness: 0.20, metalness: 0.92 });
const M_EXTRACTOR   = new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 0.15, metalness: 0.95 });
const M_TRIT_GREEN  = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
const M_SIGHT_BODY  = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.35, metalness: 0.80 });

export function buildP9() {
  const g = new THREE.Group();

  /* =========================================================
     1. FERROLHO USINADO (SLIDE) & MECANISMO DE DISPARO
     ========================================================= */
  // Corpo central do slide
  const slideMain = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.027, 0.170), M_SLIDE_MATTE);
  slideMain.position.set(0, 0.016, -0.015);

  // Topo chanfrado do ferrolho
  const slideTop = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.168), M_SLIDE_BEVEL);
  slideTop.position.set(0, 0.030, -0.015);

  // Serrilhados de manejo traseiros (serrations)
  for (let i = 0; i < 5; i++) {
    const z = 0.040 + i * 0.005;
    const serL = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.018, 0.0022), M_SLIDE_BEVEL);
    serL.position.set(-0.0132, 0.018, z);
    const serR = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.018, 0.0022), M_SLIDE_BEVEL);
    serR.position.set(0.0132, 0.018, z);
    g.add(serL, serR);
  }

  // Serrilhados de manejo frontais (press check serrations)
  for (let i = 0; i < 4; i++) {
    const z = -0.065 + i * 0.005;
    const serFL = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.016, 0.0022), M_SLIDE_BEVEL);
    serFL.position.set(-0.0132, 0.017, z);
    const serFR = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.016, 0.0022), M_SLIDE_BEVEL);
    serFR.position.set(0.0132, 0.017, z);
    g.add(serFL, serFR);
  }

  // Janela de ejeção de cartuchos e câmara (Ejection Port)
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.015, 0.032), M_CHAMBER_GOLD);
  chamber.position.set(0.004, 0.022, -0.010);

  // Extrator mecânico de estojos lateral
  const extractor = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.014), M_EXTRACTOR);
  extractor.position.set(0.0134, 0.022, 0.004);

  // Cano usinado de aço visível na frente do ferrolho (Barrel & Crown)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.020, 14), M_BARREL_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.014, -0.103);

  // Orifício vazado do cano (Bore hole)
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 12), M_GRIP_PANEL);
  bore.rotation.x = Math.PI / 2;
  bore.position.set(0, 0.014, -0.111);

  /* =========================================================
     2. ARMAÇÃO DE POLÍMERO (FRAME) & ACESSÓRIOS
     ========================================================= */
  // Armação superior do chassi
  const frameMain = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.032, 0.125), M_FRAME_POLY);
  frameMain.position.set(0, -0.010, -0.012);

  // Trilho de acessórios táticos inferior (Picatinny rail 1913)
  const underRail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.052), M_FRAME_POLY);
  underRail.position.set(0, -0.012, -0.065);
  // Ranhura transversal do trilho Picatinny
  const railSlot = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.003, 0.005), M_SLIDE_BEVEL);
  railSlot.position.set(0, -0.014, -0.065);

  // Alavanca de desmontagem tática e retém do ferrolho (Slide Catch)
  const slideCatch = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.016), M_BARREL_STEEL);
  slideCatch.position.set(-0.0132, 0.004, 0.005);

  /* =========================================================
     3. PUNHO ERGONÔMICO (PISTOL GRIP) & GUARDA-MATO
     ========================================================= */
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

  /* =========================================================
     4. MIRAS DE TRÍTIO TÁTICAS DE 3 PONTOS (3-DOT NIGHT SIGHTS)
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

  g.add(
    slideMain, slideTop, chamber, extractor, barrel, bore,
    frameMain, underRail, railSlot, slideCatch,
    grip, panelL, panelR, beavertail, magBase,
    trigGuard, trigGuardFront, trigger,
    frontPost, frontDot, rearBase, rearL, rearR, rearDotL, rearDotR
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

