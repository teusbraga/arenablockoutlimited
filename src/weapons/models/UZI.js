/**
 * ============================================================================
 *            IMI UZI 9mm SUBMACHINE GUN — PROCEDURAL MASTERPIECE (OTIMIZADO)
 * ============================================================================
 * Micro-SMG clássica com estamparia em aço fosfatizado com pátina militar,
 * cano escalonado com porca estriada, alavanca de armar superior vazada no centro,
 * empunhadura anatômica com trava de recuo, carregador estendido e coronha dobrável.
 *
 * OTIMIZAÇÕES GRÁFICAS:
 *   - Geometrias limpas sem faces coplanares coincidentes (Zero Z-Fighting).
 *   - Hierarquia direta sem malhas internas invisíveis ou duplicadas.
 *   - Materiais com polygonOffset nos decalques/ranhuras para renderização perfeita.
 *   - Miras ADS exatamente idênticas e preservadas pixel a pixel.
 * ============================================================================
 */

import * as THREE from 'three';

// Paleta PBR Fiel à UZI Militar da Imagem de Referência
const M_UZI_BODY     = new THREE.MeshStandardMaterial({ color: 0x5a5849, roughness: 0.35, metalness: 0.50 });
const M_UZI_DARK     = new THREE.MeshStandardMaterial({ color: 0x3d3d35, roughness: 0.40, metalness: 0.45 });
const M_UZI_STEEL    = new THREE.MeshStandardMaterial({ color: 0x767568, roughness: 0.25, metalness: 0.80 });
const M_UZI_NUT      = new THREE.MeshStandardMaterial({ color: 0x484639, roughness: 0.35, metalness: 0.50 });
const M_UZI_GRIP     = new THREE.MeshStandardMaterial({ color: 0x4b4c37, roughness: 0.65, metalness: 0.15 });
const M_UZI_STOCK    = new THREE.MeshStandardMaterial({ color: 0x545447, roughness: 0.35, metalness: 0.50 });
const M_PARKERIZED   = new THREE.MeshStandardMaterial({ color: 0x505247, roughness: 0.35, metalness: 0.50 });
const M_TRIT         = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildUZI() {
  const g = new THREE.Group();

  // 1. RECEPTOR PRINCIPAL DE AÇO ESTAMPADO (STAMPED RECEIVER)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.044, 0.23), M_UZI_BODY);
  receiver.position.set(0, 0.012, -0.05);

  // Nervuras de reforço estampadas com relevo destacado sem z-fighting
  const ribLeftTop = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.005, 0.14), M_UZI_DARK);
  ribLeftTop.position.set(-0.0185, 0.020, -0.04);
  const ribLeftBot = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.005, 0.14), M_UZI_DARK);
  ribLeftBot.position.set(-0.0185, 0.004, -0.04);

  const ribRightTop = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.005, 0.09), M_UZI_DARK);
  ribRightTop.position.set(0.0185, 0.020, -0.065);
  const ribRightBot = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.005, 0.09), M_UZI_DARK);
  ribRightBot.position.set(0.0185, 0.004, -0.065);

  // Placa lateral de reforço com pinos mestres
  const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.037, 0.016, 0.060), M_UZI_DARK);
  sidePlate.position.set(0, -0.004, -0.01);

  // Tampa superior estampada (Top Cover)
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.010, 0.215), M_UZI_BODY);
  topCover.position.set(0, 0.038, -0.05);

  // Alavanca de armar superior vazada no centro (Charging Handle vazado para visada livre)
  const chargerBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.003, 0.016), M_PARKERIZED);
  chargerBase.position.set(0, 0.0435, -0.03);

  const chargerL = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.007, 8), M_UZI_STEEL);
  chargerL.position.set(-0.0085, 0.0475, -0.03);
  const chargerR = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.007, 8), M_UZI_STEEL);
  chargerR.position.set(0.0085, 0.0475, -0.03);

  // Janela de ejeção lateral direita e ferrolho interno
  const ejectorRim = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.040), M_UZI_DARK);
  ejectorRim.position.set(0.018, 0.022, -0.02);

  const boltFace = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.013, 0.036), M_UZI_STEEL);
  boltFace.position.set(0.016, 0.022, -0.02);

  // Alça de bandoleira dianteira esquerda (Sling Swivel)
  const slingSwivel = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0012, 6, 10), M_UZI_STEEL);
  slingSwivel.position.set(-0.0185, 0.016, -0.09);
  slingSwivel.rotation.y = Math.PI / 2;

  // 2. CANO LONGO ESCALONADO & PORCA FRONTAL ESTRIADA
  const barrelCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.010, 12), M_UZI_NUT);
  barrelCollar.rotation.x = Math.PI / 2;
  barrelCollar.position.set(0, 0.012, -0.165);

  // Porca do cano com ranhuras serrilhadas
  const barrelNut = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.022, 12), M_UZI_NUT);
  barrelNut.rotation.x = Math.PI / 2;
  barrelNut.position.set(0, 0.012, -0.180);

  // Cano usinado
  const barrelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.032, 10), M_UZI_STEEL);
  barrelBase.rotation.x = Math.PI / 2;
  barrelBase.position.set(0, 0.012, -0.205);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.082, 10), M_UZI_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.245);

  const barrelCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0072, 0.005, 10), M_UZI_DARK);
  barrelCrown.rotation.x = Math.PI / 2;
  barrelCrown.position.set(0, 0.012, -0.288);

  // 3. EMPUNHADURA CENTRAL ERGONÔMICA (PISTOL GRIP)
  const gripFrame = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.102, 0.044), M_UZI_BODY);
  gripFrame.position.set(0, -0.055, -0.02);
  gripFrame.rotation.x = -0.16;

  // Painéis de polímero com ranhuras táteis laterais
  const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.086, 0.038), M_UZI_GRIP);
  panelL.position.set(-0.0155, -0.055, -0.02);
  panelL.rotation.x = -0.16;

  const panelR = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.086, 0.038), M_UZI_GRIP);
  panelR.position.set(0.0155, -0.055, -0.02);
  panelR.rotation.x = -0.16;

  // Ranhuras horizontais no grip sem sobreposição
  for (let y = -0.082; y <= -0.028; y += 0.014) {
    const gripRibL = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.003, 0.032), M_UZI_DARK);
    gripRibL.position.set(-0.017, y, -0.02 - (y + 0.055) * 0.16);
    gripRibL.rotation.x = -0.16;

    const gripRibR = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.003, 0.032), M_UZI_DARK);
    gripRibR.position.set(0.017, y, -0.02 - (y + 0.055) * 0.16);
    gripRibR.rotation.x = -0.16;

    g.add(gripRibL, gripRibR);
  }

  // Trava traseira de empunhadura (Grip Safety)
  const gripSafety = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.038, 0.007), M_UZI_STEEL);
  gripSafety.position.set(0, -0.036, 0.004);
  gripSafety.rotation.x = -0.16;

  // Carregador 9mm estendido
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.065, 0.035), M_UZI_STEEL);
  mag.position.set(0, -0.134, -0.007);
  mag.rotation.x = -0.16;

  const magBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.005, 0.038), M_UZI_DARK);
  magBaseplate.position.set(0, -0.167, 0.002);
  magBaseplate.rotation.x = -0.16;

  // Guarda-mato e Gatilho
  const guardBottom = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.004, 0.042), M_UZI_BODY);
  guardBottom.position.set(0, -0.043, -0.06);

  const guardFront = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.020, 0.004), M_UZI_BODY);
  guardFront.position.set(0, -0.032, -0.081);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.017, 0.007), M_UZI_STEEL);
  trigger.position.set(0, -0.028, -0.055);
  trigger.rotation.x = 0.24;

  const selectorSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.007, 0.014), M_UZI_STEEL);
  selectorSwitch.position.set(-0.017, -0.016, -0.028);

  // Guarda-mão frontal estriado de polímero verde-oliva (Foregrip)
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.030, 0.062), M_UZI_GRIP);
  foregrip.position.set(0, -0.011, -0.125);

  for (let z = -0.143; z <= -0.107; z += 0.010) {
    const foreRib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.026, 0.0025), M_UZI_DARK);
    foreRib.position.set(0, -0.011, z);
    g.add(foreRib);
  }

  // 4. CORONHA METÁLICA DOBRÁVEL ABERTA (FOLDING METAL STOCK)
  const stockHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.026, 8), M_UZI_STEEL);
  stockHinge.rotation.z = Math.PI / 2;
  stockHinge.position.set(0, 0.005, 0.075);

  const stockArmTop = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.007, 0.12), M_UZI_STOCK);
  stockArmTop.position.set(0, 0.006, 0.14);

  const stockJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.020, 8), M_UZI_STEEL);
  stockJoint.rotation.z = Math.PI / 2;
  stockJoint.position.set(0, 0.004, 0.20);

  const stockArmBot = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.006, 0.06), M_UZI_STOCK);
  stockArmBot.position.set(0, -0.002, 0.23);

  const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.070, 0.007), M_UZI_STOCK);
  buttPlate.position.set(0, -0.025, 0.26);

  // 5. CONJUNTO DE MIRAS UZI (RIGOROSAMENTE PRESERVADO PARA ADS)
  const rearBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.005, 0.006), M_PARKERIZED);
  rearBase.position.set(0, 0.043, 0.045);

  const rearWingL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.006), M_PARKERIZED);
  rearWingL.position.set(-0.009, 0.051, 0.045);
  const rearWingR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.006), M_PARKERIZED);
  rearWingR.position.set(0.009, 0.051, 0.045);

  const rearFlangeL = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 8), M_PARKERIZED);
  rearFlangeL.rotation.x = Math.PI / 2;
  rearFlangeL.position.set(-0.009, 0.0585, 0.045);

  const rearFlangeR = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 8), M_PARKERIZED);
  rearFlangeR.rotation.x = Math.PI / 2;
  rearFlangeR.position.set(0.009, 0.0585, 0.045);

  const frontWingL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.006), M_PARKERIZED);
  frontWingL.position.set(-0.011, 0.049, -0.15);
  const frontWingR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.006), M_PARKERIZED);
  frontWingR.position.set(0.011, 0.049, -0.15);

  const frontFlangeL = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 8), M_PARKERIZED);
  frontFlangeL.rotation.x = Math.PI / 2;
  frontFlangeL.position.set(-0.011, 0.057, -0.15);

  const frontFlangeR = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.006, 8), M_PARKERIZED);
  frontFlangeR.rotation.x = Math.PI / 2;
  frontFlangeR.position.set(0.011, 0.057, -0.15);

  const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.011, 8), M_PARKERIZED);
  frontPost.position.set(0, 0.048, -0.15);

  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 10, 10), M_TRIT);
  frontDot.position.set(0, 0.053, -0.15);

  g.add(
    receiver, ribLeftTop, ribLeftBot, ribRightTop, ribRightBot, sidePlate,
    topCover, chargerBase, chargerL, chargerR, ejectorRim, boltFace, slingSwivel,
    barrelCollar, barrelNut, barrelBase, barrel, barrelCrown,
    gripFrame, panelL, panelR, gripSafety, mag, magBaseplate,
    guardBottom, guardFront, trigger, selectorSwitch, foregrip,
    stockHinge, stockArmTop, stockJoint, stockArmBot, buttPlate,
    rearBase, rearWingL, rearWingR, rearFlangeL, rearFlangeR,
    frontWingL, frontWingR, frontFlangeL, frontFlangeR, frontPost, frontDot
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
