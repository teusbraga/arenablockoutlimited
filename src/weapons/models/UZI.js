/**
 * ============================================================================
 *            IMI UZI 9mm SUBMACHINE GUN — PROCEDURAL MASTERPIECE
 * ============================================================================
 * Micro-SMG lendária com estamparia de aço fosfatizado com pátina militar,
 * cano cilíndrico escalonado com porca estriada, alavanca de armar superior
 * com fenda central de mira intacta, empunhadura anatômica com trava de recuo,
 * carregador estendido com furos de contagem e coronha dobrável tática aberta.
 *
 * * NOTA CRÍTICA DE ALINHAMENTO:
 * As posições, alturas e aberturas exatas do conjunto de mira (sightLocal):
 *   - Alça de mira traseira: z = 0.045, base y = 0.043, asas x = ±0.009
 *   - Massa de mira dianteira: z = -0.15, base y = 0.048, trítio y = 0.053
 * Foram rigorosamente PRESERVADAS para manter o alinhamento de ADS perfeito.
 * ============================================================================
 */

import * as THREE from 'three';

// Paleta PBR Fiel à UZI Militar da Imagem de Referência (Aço estampado com pátina verde-oliva/cáqui envelhecida)
const M_UZI_BODY     = new THREE.MeshStandardMaterial({ color: 0x5a5849, roughness: 0.38, metalness: 0.82 }); // Aço com pátina militar esverdeada/cáqui
const M_UZI_DARK     = new THREE.MeshStandardMaterial({ color: 0x3d3d35, roughness: 0.42, metalness: 0.85 }); // Reentrâncias e chanfros
const M_UZI_STEEL    = new THREE.MeshStandardMaterial({ color: 0x767568, roughness: 0.28, metalness: 0.90 }); // Peças usinadas e cano
const M_UZI_NUT      = new THREE.MeshStandardMaterial({ color: 0x484639, roughness: 0.45, metalness: 0.80 }); // Porca do cano estriada
const M_UZI_GRIP     = new THREE.MeshStandardMaterial({ color: 0x4b4c37, roughness: 0.85, metalness: 0.12 }); // Polímero verde-oliva com ranhuras
const M_UZI_STOCK    = new THREE.MeshStandardMaterial({ color: 0x545447, roughness: 0.35, metalness: 0.88 }); // Coronha metálica articulada
const M_PARKERIZED   = new THREE.MeshStandardMaterial({ color: 0x505247, roughness: 0.30, metalness: 0.84 });
const M_TRIT         = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildUZI() {
  const g = new THREE.Group();

  // 1. RECEPTOR PRINCIPAL DE AÇO ESTAMPADO COM NERVURAS LATERAIS (STAMPED RECEIVER)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.046, 0.23), M_UZI_BODY);
  receiver.position.set(0, 0.012, -0.05);

  // Nervuras de reforço estampadas características da UZI (Upper and Lower Stamping Ribs)
  const ribLeftTop = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.006, 0.15), M_UZI_DARK);
  ribLeftTop.position.set(-0.0185, 0.020, -0.04);
  const ribLeftBot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.006, 0.15), M_UZI_DARK);
  ribLeftBot.position.set(-0.0185, 0.004, -0.04);

  const ribRightTop = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.006, 0.10), M_UZI_DARK);
  ribRightTop.position.set(0.0185, 0.020, -0.06);
  const ribRightBot = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.006, 0.10), M_UZI_DARK);
  ribRightBot.position.set(0.0185, 0.004, -0.06);

  // Placa lateral de reforço com parafusos e pinos mestres
  const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.018, 0.065), M_UZI_DARK);
  sidePlate.position.set(0, -0.004, -0.01);

  // Tampa superior estampada (Top Cover) com calha central
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.012, 0.215), M_UZI_BODY);
  topCover.position.set(0, 0.038, -0.05);

  const coverRim = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.004, 0.218), M_UZI_DARK);
  coverRim.position.set(0, 0.042, -0.05);

  // Botão de armar superior cilíndrico/ranhurado com abertura central para a visada (Charging Handle)
  const chargerBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.004, 0.018), M_PARKERIZED);
  chargerBase.position.set(0, 0.044, -0.03);

  const chargerL = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8), M_UZI_STEEL);
  chargerL.position.set(-0.009, 0.048, -0.03);
  const chargerR = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.008, 8), M_UZI_STEEL);
  chargerR.position.set(0.009, 0.048, -0.03);

  // Janela de ejeção lateral chanfrada com ferrolho interno visível
  const ejectorRim = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.017, 0.042), M_UZI_DARK);
  ejectorRim.position.set(0.017, 0.022, -0.02);

  const boltFace = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.038), M_UZI_STEEL);
  boltFace.position.set(0.015, 0.022, -0.02);

  // Alça de bandoleira dianteira esquerda (Sling Swivel)
  const slingSwivel = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0014, 8, 12), M_UZI_STEEL);
  slingSwivel.position.set(-0.019, 0.016, -0.09);
  slingSwivel.rotation.y = Math.PI / 2;

  // 2. CANO LONGO ESCALONADO & PORCA FRONTAL ESTRIADA
  const barrelCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), M_UZI_NUT);
  barrelCollar.rotation.x = Math.PI / 2;
  barrelCollar.position.set(0, 0.012, -0.165);

  // Porca do cano com ranhuras de aperto serrilhadas (Knurled Barrel Nut)
  const barrelNut = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.024, 14), M_UZI_NUT);
  barrelNut.rotation.x = Math.PI / 2;
  barrelNut.position.set(0, 0.012, -0.180);

  // Anéis estriados na porca
  for (let z = -0.188; z <= -0.172; z += 0.004) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0138, 0.001, 8, 14), M_UZI_DARK);
    ring.position.set(0, 0.012, z);
    g.add(ring);
  }

  // Cano escalonado de precisão (Extended Barrel com boca furada)
  const barrelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.035, 12), M_UZI_STEEL);
  barrelBase.rotation.x = Math.PI / 2;
  barrelBase.position.set(0, 0.012, -0.205);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.085, 12), M_UZI_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.245);

  const barrelCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0075, 0.006, 12), M_UZI_DARK);
  barrelCrown.rotation.x = Math.PI / 2;
  barrelCrown.position.set(0, 0.012, -0.288);

  // 3. EMPUNHADURA CENTRAL ERGONÔMICA (PISTOL GRIP COM NERVURAS HORIZONTAIS)
  const gripFrame = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.105, 0.045), M_UZI_BODY);
  gripFrame.position.set(0, -0.055, -0.02);
  gripFrame.rotation.x = -0.16;

  // Painéis de polímero com ranhuras táteis laterais
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.088, 0.040), M_UZI_GRIP);
  panelL.position.set(-0.016, -0.055, -0.02);
  panelL.rotation.x = -0.16;

  const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.088, 0.040), M_UZI_GRIP);
  panelR.position.set(0.016, -0.055, -0.02);
  panelR.rotation.x = -0.16;

  // Nervuras antiderrapantes em relevo nos painéis
  for (let y = -0.085; y <= -0.025; y += 0.012) {
    const gripRibL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.004, 0.034), M_UZI_DARK);
    gripRibL.position.set(-0.018, y, -0.02 - (y + 0.055) * 0.16);
    gripRibL.rotation.x = -0.16;

    const gripRibR = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.004, 0.034), M_UZI_DARK);
    gripRibR.position.set(0.018, y, -0.02 - (y + 0.055) * 0.16);
    gripRibR.rotation.x = -0.16;

    g.add(gripRibL, gripRibR);
  }

  // Trava de segurança da empunhadura traseira (Grip Safety)
  const gripSafety = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.040, 0.009), M_UZI_STEEL);
  gripSafety.position.set(0, -0.036, 0.005);
  gripSafety.rotation.x = -0.16;

  // Botão retém do carregador na base da empunhadura (Mag Release)
  const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.012, 0.010), M_UZI_STEEL);
  magRelease.position.set(-0.016, -0.098, -0.015);
  magRelease.rotation.x = -0.16;

  // Carregador 9mm estendido com furos de inspeção e baseplate metálico
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.068, 0.036), M_UZI_STEEL);
  mag.position.set(0, -0.135, -0.007);
  mag.rotation.x = -0.16;

  const magBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.027, 0.006, 0.040), M_UZI_DARK);
  magBaseplate.position.set(0, -0.168, 0.002);
  magBaseplate.rotation.x = -0.16;

  // Guarda-mato e Gatilho curvado
  const guardBottom = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.044), M_UZI_BODY);
  guardBottom.position.set(0, -0.043, -0.06);

  const guardFront = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.022, 0.005), M_UZI_BODY);
  guardFront.position.set(0, -0.032, -0.082);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.008), M_UZI_STEEL);
  trigger.position.set(0, -0.028, -0.055);
  trigger.rotation.x = 0.24;

  // Seletor de tiro tático (A-R-S: Automático, Repetição, Seguro)
  const selectorSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.016), M_UZI_STEEL);
  selectorSwitch.position.set(-0.018, -0.016, -0.028);

  // Guarda-mão frontal estriado de polímero verde-oliva militar (Foregrip)
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.032, 0.065), M_UZI_GRIP);
  foregrip.position.set(0, -0.011, -0.125);

  // Ranhuras verticais de empunhadura no foregrip
  for (let z = -0.145; z <= -0.105; z += 0.008) {
    const foreRib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.028, 0.003), M_UZI_DARK);
    foreRib.position.set(0, -0.011, z);
    g.add(foreRib);
  }

  // 4. CORONHA METÁLICA DOBRÁVEL ABERTA (FOLDING METAL STOCK COMO NA REFERÊNCIA)
  // Articulação traseira da coronha (Stock Hinge)
  const stockHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.028, 10), M_UZI_STEEL);
  stockHinge.rotation.z = Math.PI / 2;
  stockHinge.position.set(0, 0.005, 0.075);

  // Hastes telescópicas / barras de extensão superiores e inferiores
  const stockArmTop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.12), M_UZI_STOCK);
  stockArmTop.position.set(0, 0.006, 0.14);

  const stockJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.022, 8), M_UZI_STEEL);
  stockJoint.rotation.z = Math.PI / 2;
  stockJoint.position.set(0, 0.004, 0.20);

  const stockArmBot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.007, 0.06), M_UZI_STOCK);
  stockArmBot.position.set(0, -0.002, 0.23);

  // Soleira de ombro rebatível com curva anatômica (Buttplate)
  const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.072, 0.008), M_UZI_STOCK);
  buttPlate.position.set(0, -0.025, 0.26);

  const buttSlot = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.036, 0.010), M_UZI_DARK);
  buttSlot.position.set(0, -0.025, 0.26);

  // 5. CONJUNTO DE MIRAS UZI (PRESERVADO RIGOROSAMENTE PARA ADS PERFEITO)
  // Alça de mira traseira: base em z = 0.045, altura y = 0.043, aletas em x = ±0.009
  const rearBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.005, 0.006), M_PARKERIZED);
  rearBase.position.set(0, 0.043, 0.045);

  // Asas curvas de proteção da alça de mira traseira
  const rearWingL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.006), M_PARKERIZED);
  rearWingL.position.set(-0.009, 0.051, 0.045);
  const rearWingR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.006), M_PARKERIZED);
  rearWingR.position.set(0.009, 0.051, 0.045);

  const rearFlangeL = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.006, 8), M_PARKERIZED);
  rearFlangeL.rotation.x = Math.PI / 2;
  rearFlangeL.position.set(-0.009, 0.0585, 0.045);

  const rearFlangeR = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.006, 8), M_PARKERIZED);
  rearFlangeR.rotation.x = Math.PI / 2;
  rearFlangeR.position.set(0.009, 0.0585, 0.045);

  // Massa de mira dianteira: aletas curvas, pino central e ponto de trítio neon verde
  const frontWingL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.006), M_PARKERIZED);
  frontWingL.position.set(-0.011, 0.049, -0.15);
  const frontWingR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.006), M_PARKERIZED);
  frontWingR.position.set(0.011, 0.049, -0.15);

  const frontFlangeL = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.006, 8), M_PARKERIZED);
  frontFlangeL.rotation.x = Math.PI / 2;
  frontFlangeL.position.set(-0.011, 0.057, -0.15);

  const frontFlangeR = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.006, 8), M_PARKERIZED);
  frontFlangeR.rotation.x = Math.PI / 2;
  frontFlangeR.position.set(0.011, 0.057, -0.15);

  const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.011, 8), M_PARKERIZED);
  frontPost.position.set(0, 0.048, -0.15);

  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 10, 10), M_TRIT);
  frontDot.position.set(0, 0.053, -0.15);

  g.add(
    receiver, ribLeftTop, ribLeftBot, ribRightTop, ribRightBot, sidePlate,
    topCover, coverRim, chargerBase, chargerL, chargerR, ejectorRim, boltFace, slingSwivel,
    barrelCollar, barrelNut, barrelBase, barrel, barrelCrown,
    gripFrame, panelL, panelR, gripSafety, magRelease, mag, magBaseplate,
    guardBottom, guardFront, trigger, selectorSwitch, foregrip,
    stockHinge, stockArmTop, stockJoint, stockArmBot, buttPlate, buttSlot,
    rearBase, rearWingL, rearWingR, rearFlangeL, rearFlangeR,
    frontWingL, frontWingR, frontFlangeL, frontFlangeR, frontPost, frontDot
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
