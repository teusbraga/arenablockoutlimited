/**
 * ============================================================================
 *               M249 SAW 5.56mm — MODELO PROCEDURAL MILITAR V2
 * ============================================================================
 * Metralhadora leve de esquadra (Squad Automatic Weapon) em acabamento tático
 * fosco e aço usinado.
 *
 * DETALHES DE ALTA FIDELIDADE:
 *   - Fita de munição (bullet belt) curvada em arco realista com elos de cinta M27
 *     metálicos pretos e projéteis 5.56mm detalhados em latão e ponta de cobre.
 *   - Caixa de munição de 100 cartuchos (Ammo Box / Nut Sack) com trava, nervuras
 *     e suporte lateral em aço.
 *   - Janela de alimentação (feed tray) e tampa superior com ranhuras e mola.
 *   - Trilho Picatinny usinado sobre o receptor.
 *   - Escudo térmico ventilado (heat shield) com slots de arrefecimento.
 *   - Tubo de gás com regulador e anéis estriados.
 *   - Alça de transporte tática dobrável angular (carry handle) ergonômica.
 *   - Bipé tático dobrável com pés serrilhados e molas de articulação.
 *   - Miras militares: alça de mira traseira estilo tambor/folha e massa de mira
 *     dianteira com anéis protetores (hood) e ponto de trítio verde neon.
 * ============================================================================
 */

import * as THREE from 'three';

// Materiais PBR Táticos da M249
const M_RECEIVER_PARK = new THREE.MeshStandardMaterial({ color: 0x484f56, roughness: 0.38, metalness: 0.88 });
const M_STEEL_GUN     = new THREE.MeshStandardMaterial({ color: 0x7c858e, roughness: 0.20, metalness: 0.94 });
const M_STEEL_DARK    = new THREE.MeshStandardMaterial({ color: 0x2b3035, roughness: 0.45, metalness: 0.85 });
const M_AMMO_BOX      = new THREE.MeshStandardMaterial({ color: 0x434c38, roughness: 0.70, metalness: 0.20 }); // Ranger Olive Drab
const M_AMMO_LATCH    = new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.50, metalness: 0.80 });
const M_BRASS_CASE    = new THREE.MeshStandardMaterial({ color: 0xdfb850, roughness: 0.18, metalness: 0.92 }); // Latão polido
const M_COPPER_TIP    = new THREE.MeshStandardMaterial({ color: 0xc86432, roughness: 0.25, metalness: 0.85 }); // Ponta de cobre FMJ
const M_BELT_LINK     = new THREE.MeshStandardMaterial({ color: 0x1d2125, roughness: 0.40, metalness: 0.90 }); // Elos M27 em aço fosfatizado
const M_POLYMER_BLACK = new THREE.MeshStandardMaterial({ color: 0x24282d, roughness: 0.82, metalness: 0.15 });
const M_HEAT_SHIELD   = new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: 0.32, metalness: 0.80 });
const M_TRIT          = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildM249() {
  const g = new THREE.Group();

  // 1. RECEPTOR PRINCIPAL (Receiver Box & Lower)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.064, 0.34), M_RECEIVER_PARK);
  receiver.position.set(0, 0.015, -0.06);

  // Placas laterais reforçadas com rebites
  const sidePlateL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.048, 0.26), M_STEEL_DARK);
  sidePlateL.position.set(-0.025, 0.015, -0.06);
  const sidePlateR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.048, 0.26), M_STEEL_DARK);
  sidePlateR.position.set(0.025, 0.015, -0.06);

  // Tampa de alimentação superior articulada (Feed Tray Cover)
  const feedCover = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.020, 0.23), M_RECEIVER_PARK);
  feedCover.position.set(0, 0.053, -0.08);

  // Travas da tampa de alimentação
  const feedLatch = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.016, 0.018), M_STEEL_GUN);
  feedLatch.position.set(0, 0.055, 0.038);

  // Trilho Picatinny MIL-STD-1913 sobre a tampa
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.18), M_STEEL_GUN);
  topRail.position.set(0, 0.066, -0.08);

  // Dentes do trilho Picatinny (alívio visual)
  for (let z = -0.16; z <= 0; z += 0.022) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.003, 0.008), M_STEEL_DARK);
    tooth.position.set(0, 0.071, z);
    g.add(tooth);
  }

  // Janela de ejeção de estojos e elos (lado direito)
  const ejectPort = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.06), M_STEEL_DARK);
  ejectPort.position.set(0.023, 0.016, -0.06);

  // Calha de alimentação de fita (feed tray flap - lado esquerdo)
  const feedTrayFlap = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.016, 0.05), M_STEEL_DARK);
  feedTrayFlap.position.set(-0.026, 0.042, -0.075);

  // 2. CANO PESADO, QUEBRA-CHAMAS & SISTEMA DE GÁS
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.011, 0.24, 12), M_STEEL_GUN);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.020, -0.33);

  // Anel de fixação e troca rápida de cano (barrel lock nut)
  const barrelNut = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.022, 12), M_STEEL_DARK);
  barrelNut.rotation.x = Math.PI / 2;
  barrelNut.position.set(0, 0.020, -0.21);

  // Quebra-chamas tático SAW com ranhuras longitudinais
  const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0115, 0.048, 12), M_STEEL_GUN);
  flashHider.rotation.x = Math.PI / 2;
  flashHider.position.set(0, 0.020, -0.455);

  // Escudo térmico perfurado ventilado superior (Heat Shield)
  const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.028, 0.17), M_HEAT_SHIELD);
  heatShield.position.set(0, 0.038, -0.27);

  // Aberturas de ventilação no escudo térmico
  for (let z = -0.33; z <= -0.21; z += 0.03) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.008, 0.012), M_STEEL_DARK);
    vent.position.set(0, 0.044, z);
    g.add(vent);
  }

  // Tubo de gás inferior de alto impacto e regulador cilíndrico
  const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.20, 10), M_STEEL_GUN);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, -0.006, -0.28);

  const gasRegulator = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.012, 0.024, 10), M_STEEL_DARK);
  gasRegulator.rotation.x = Math.PI / 2;
  gasRegulator.position.set(0, -0.006, -0.385);

  // 3. CAIXA DE MUNIÇÃO (AMMO BOX / 100-ROUND NUT SACK)
  const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.105, 0.092), M_AMMO_BOX);
  ammoBox.position.set(-0.016, -0.065, -0.075);

  // Tampa com presilha e suporte de encaixe em metal
  const boxBracket = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.045, 0.080), M_STEEL_DARK);
  boxBracket.position.set(0.018, -0.040, -0.075);

  const boxLatch = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.010, 0.014), M_AMMO_LATCH);
  boxLatch.position.set(-0.016, -0.020, -0.028);

  // 4. BULLET BELT ALINHADA E ARQUEADA COM MUNIÇÃO 5.56x45mm & ELOS M27
  // Curvatura precisa saindo da caixa de munição e entrando na feed tray
  const beltRounds = [
    { x: -0.024, y: 0.038, z: -0.076, rotZ: 0.05,  rotY: 0.00 }, // Na boca do receptor
    { x: -0.032, y: 0.028, z: -0.075, rotZ: 0.25,  rotY: 0.04 },
    { x: -0.039, y: 0.014, z: -0.074, rotZ: 0.55,  rotY: 0.06 },
    { x: -0.044, y: -0.004, z: -0.073, rotZ: 0.95, rotY: 0.08 },
    { x: -0.042, y: -0.024, z: -0.072, rotZ: 1.45, rotY: 0.06 },
    { x: -0.034, y: -0.040, z: -0.072, rotZ: 1.70, rotY: 0.02 }, // Entrando na caixa
  ];

  beltRounds.forEach(pos => {
    const roundGroup = new THREE.Group();
    roundGroup.position.set(pos.x, pos.y, pos.z);
    roundGroup.rotation.z = pos.rotZ;
    roundGroup.rotation.y = pos.rotY;

    // Estojo de latão 5.56mm
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.0044, 0.0044, 0.022, 10), M_BRASS_CASE);
    casing.rotation.x = Math.PI / 2;
    casing.position.set(0, 0, 0);

    // Culote / Aro de extração
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.003, 10), M_BRASS_CASE);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0, 0.011);

    // Ponta do projétil FMJ (cobre/jaquetada)
    const bulletTip = new THREE.Mesh(new THREE.ConeGeometry(0.0036, 0.009, 10), M_COPPER_TIP);
    bulletTip.rotation.x = -Math.PI / 2;
    bulletTip.position.set(0, 0, -0.015);

    // Elo de cinta metálico M27 preto fosco
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.012, 10, 1, true), M_BELT_LINK);
    link.rotation.x = Math.PI / 2;
    link.position.set(0, 0, -0.001);

    roundGroup.add(casing, rim, bulletTip, link);
    g.add(roundGroup);
  });

  // 5. EMPUNHADURA DE PISTOLA TÁTICA (SAW Pistol Grip & Trigger Group)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.098, 0.046), M_POLYMER_BLACK);
  grip.position.set(0, -0.056, 0.05);
  grip.rotation.x = -0.22;

  // Nervuras antiderrapantes no punho
  for (let y = -0.08; y <= -0.03; y += 0.012) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.003, 0.038), M_STEEL_DARK);
    rib.position.set(0, y, 0.045);
    rib.rotation.x = -0.22;
    g.add(rib);
  }

  // Guarda-mato alargado e Gatilho
  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.007, 0.048), M_RECEIVER_PARK);
  trigGuard.position.set(0, -0.036, 0.012);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.008), M_STEEL_GUN);
  trigger.position.set(0, -0.023, 0.012);
  trigger.rotation.x = 0.22;

  // 6. CORONHA MILITAR CLUBFOOT (M249 Heavy Stock)
  const stockMount = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.052, 0.038), M_RECEIVER_PARK);
  stockMount.position.set(0, 0.018, 0.125);

  const stockBuffer = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.10, 10), M_STEEL_GUN);
  stockBuffer.rotation.x = Math.PI / 2;
  stockBuffer.position.set(0, 0.024, 0.17);

  // Corpo Clubfoot com apoio de ombro móvel de metal
  const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.092, 0.095), M_POLYMER_BLACK);
  stockBody.position.set(0, 0.014, 0.225);

  const buttPad = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.108, 0.016), M_STEEL_DARK);
  buttPad.position.set(0, 0.014, 0.278);

  const shoulderRest = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.008, 0.08), M_STEEL_GUN);
  shoulderRest.position.set(0, 0.068, 0.23);

  // 7. ALÇA DE TRANSPORTE TÁTICA ANGULADA (Carry Handle)
  const handleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.024, 10), M_STEEL_DARK);
  handleBase.rotation.z = Math.PI / 2;
  handleBase.position.set(0.022, 0.035, -0.16);

  const handleArm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.048, 0.014), M_RECEIVER_PARK);
  handleArm.position.set(0.032, 0.060, -0.16);
  handleArm.rotation.z = -0.35;

  const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.075, 10), M_POLYMER_BLACK);
  handleGrip.rotation.x = Math.PI / 2;
  handleGrip.position.set(0.046, 0.082, -0.16);

  // 8. BIPÉ TÁTICO DOBRADO (Tucked Bipod com Travas e Sapatas)
  const bipodPivot = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.016, 0.024), M_STEEL_DARK);
  bipodPivot.position.set(0, -0.014, -0.37);

  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.004, 0.19, 8), M_STEEL_GUN);
  bipodL.rotation.x = Math.PI / 2;
  bipodL.position.set(-0.024, -0.012, -0.27);

  const bipodFootL = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.014, 0.018), M_STEEL_DARK);
  bipodFootL.position.set(-0.024, -0.012, -0.18);

  const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.004, 0.19, 8), M_STEEL_GUN);
  bipodR.rotation.x = Math.PI / 2;
  bipodR.position.set(0.024, -0.012, -0.27);

  const bipodFootR = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.014, 0.018), M_STEEL_DARK);
  bipodFootR.position.set(0.024, -0.012, -0.18);

  // 9. MIRAS DE FERRO M249 MILITARES
  // Alça de mira traseira ajustável (aperture leaf / drum)
  const rearSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.014, 0.028), M_RECEIVER_PARK);
  rearSightBase.position.set(0, 0.070, 0.025);

  const rearSightAperture = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 10), M_STEEL_DARK);
  rearSightAperture.rotation.x = Math.PI / 2;
  rearSightAperture.position.set(0, 0.082, 0.025);

  // Massa de mira frontal militar com anel protetor (Hooded front sight)
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.028, 0.018), M_RECEIVER_PARK);
  frontSightBase.position.set(0, 0.046, -0.38);

  const frontHood = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0016, 8, 12), M_STEEL_DARK);
  frontHood.position.set(0, 0.062, -0.38);

  const frontPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.008, 8), M_STEEL_GUN);
  frontPin.position.set(0, 0.059, -0.38);

  const frontTritium = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 8), M_TRIT);
  frontTritium.position.set(0, 0.0625, -0.38);

  g.add(
    receiver, sidePlateL, sidePlateR,
    feedCover, feedLatch, topRail, ejectPort, feedTrayFlap,
    barrel, barrelNut, flashHider, heatShield, gasTube, gasRegulator,
    ammoBox, boxBracket, boxLatch,
    grip, trigGuard, trigger,
    stockMount, stockBuffer, stockBody, buttPad, shoulderRest,
    handleBase, handleArm, handleGrip,
    bipodPivot, bipodL, bipodFootL, bipodR, bipodFootR,
    rearSightBase, rearSightAperture,
    frontSightBase, frontHood, frontPin, frontTritium
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
