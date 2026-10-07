/**
 * ============================================================================
 *               AVTOMAT KALASHNIKOVA AK-47 — PROCEDURAL MODEL
 * ============================================================================
 * Fuzil de assalto clássico calibre 7.62x39mm Soviético.
 * Modelado proceduralmente em Three.js com geometrias limpas e materiais PBR
 * de alta fidelidade:
 *
 * DETALHES DE ALTA FIDELIDADE:
 *   1. Coronha e Empunhadura em Madeira Envernizada (Rich Varnished Wood):
 *      - Coronha fixa com inclinação clássica russa, soleira de aço e zarelho.
 *      - Empunhadura anatômica em madeira laminada com capa de fixação em aço.
 *   2. Caixa da Culatra em Aço Fosfatizado / Usinado (Milled / Stamped Steel):
 *      - Tampa da caixa (dust cover) abaulada com ranhuras e botão traseiro da mola.
 *      - Grande alavanca seletora de tiro no lado direito (Safe / Auto / Semi).
 *      - Ferrolho cromado e alavanca de manejo curva saliente no lado direito.
 *   3. Carregador Curvo de 30 Tiros (Banana Magazine):
 *      - Formato curvo icônico 7.62mm com nervuras estampadas de reforço.
 *   4. Guarda-Mão Duplo de Madeira (Handguard):
 *      - Guarda-mão inferior anatômico e protetor superior do tubo de gás.
 *      - Anéis de fixação em aço com trava frontal.
 *   5. Sistema de Gás, Cano e Vareta de Limpeza:
 *      - Tubo de gás superior, bloco de gás angular a 45° com orifícios de alívio.
 *      - Cano longo em aço usinado com vareta de limpeza embutida inferior.
 *   6. Conjunto de Miras Abertas (Alinhamento Preciso no ADS):
 *      - Alça de mira traseira estilo régua tangente com entalhe em V (notch).
 *      - Massa de mira dianteira elevada com aletas protetoras e pino central.
 * ============================================================================
 */

import * as THREE from 'three';

// Paleta PBR Fiel à AK-47 (Madeira Quente Envernizada + Aço Fosfatizado Escuro)
export const M_AK_WOOD       = new THREE.MeshStandardMaterial({ color: 0x9e5222, roughness: 0.38, metalness: 0.08 });
export const M_AK_WOOD_DARK  = new THREE.MeshStandardMaterial({ color: 0x733612, roughness: 0.44, metalness: 0.05 });
export const M_AK_RECEIVER   = new THREE.MeshStandardMaterial({ color: 0x2e3237, roughness: 0.40, metalness: 0.45 });
export const M_AK_STEEL      = new THREE.MeshStandardMaterial({ color: 0x3d4147, roughness: 0.35, metalness: 0.50 });
export const M_AK_STEEL_BRT  = new THREE.MeshStandardMaterial({ color: 0x727982, roughness: 0.25, metalness: 0.80 });
export const M_AK_MAG        = new THREE.MeshStandardMaterial({ color: 0x272a2e, roughness: 0.45, metalness: 0.35 });
export const M_AK_DARK       = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.50, metalness: 0.30 });

export function buildAK47() {
  const g = new THREE.Group();

  /* =========================================================
     1. CAIXA DA CULATRA (RECEIVER & DUST COVER)
     ========================================================= */
  // Corpo principal do receiver
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.052, 0.20), M_AK_RECEIVER);
  receiver.position.set(0, 0.015, -0.01);

  // Tampa da caixa da culatra (Dust Cover superior abaulado)
  const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.19), M_AK_STEEL);
  dustCover.position.set(0, 0.043, -0.01);

  // Nervura de reforço longitudinal estampada na tampa
  const dustRib = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.004, 0.16), M_AK_DARK);
  dustRib.position.set(0, 0.052, -0.01);

  // Botão traseiro de desmontagem / guia da mola recuperadora
  const takedownLug = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.016), M_AK_STEEL_BRT);
  takedownLug.position.set(0, 0.038, 0.088);

  // Dimple lateral do magwell (rebaixo estampado clássico do AK)
  const dimpleL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.010, 0.036), M_AK_DARK);
  dimpleL.position.set(-0.0195, 0.008, -0.045);
  const dimpleR = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.010, 0.036), M_AK_DARK);
  dimpleR.position.set(0.0195, 0.008, -0.045);

  // Pinos de montagem do mecanismo de disparo (Trigger Pins)
  const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.042, 8), M_AK_STEEL_BRT);
  pin1.rotation.z = Math.PI / 2;
  pin1.position.set(0, 0.005, 0.02);

  const pin2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.042, 8), M_AK_STEEL_BRT);
  pin2.rotation.z = Math.PI / 2;
  pin2.position.set(0, 0.012, 0.05);

  // Guarda-mato e gatilho curvo em aço
  const trigGuardFront = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.026, 0.004), M_AK_RECEIVER);
  trigGuardFront.position.set(0, -0.024, -0.005);
  const trigGuardBot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.042), M_AK_RECEIVER);
  trigGuardBot.position.set(0, -0.036, 0.016);
  const trigGuardRear = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.004), M_AK_RECEIVER);
  trigGuardRear.position.set(0, -0.026, 0.037);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.008), M_AK_STEEL);
  trigger.rotation.x = -0.35;
  trigger.position.set(0, -0.024, 0.018);

  // Retém do carregador (Paddle release lever na frente do guarda-mato)
  const magCatch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.020, 0.006), M_AK_STEEL);
  magCatch.rotation.x = 0.40;
  magCatch.position.set(0, -0.020, -0.015);

  /* =========================================================
     2. LADO DIREITO: FERROLHO, MANEJO E SELETOR
     ========================================================= */
  // Janela de ejeção (rebaixo retangular)
  const ejectCutout = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.060), M_AK_DARK);
  ejectCutout.position.set(0.018, 0.030, -0.035);

  // Corpo do ferrolho (Bolt Carrier em aço usinado)
  const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.055), M_AK_STEEL_BRT);
  boltCarrier.position.set(0.0175, 0.030, -0.035);

  // Alavanca de manejo icônica do AK (Charging Handle curva para cima e direita)
  const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 8), M_AK_STEEL_BRT);
  handleStem.rotation.z = Math.PI / 2;
  handleStem.position.set(0.027, 0.032, -0.025);

  const handleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 8), M_AK_STEEL_BRT);
  handleKnob.position.set(0.036, 0.035, -0.025);

  // Grande alavanca seletora de tiro do AK (Safety / Selector Lever)
  const selectorPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), M_AK_STEEL);
  selectorPivot.rotation.z = Math.PI / 2;
  selectorPivot.position.set(0.0195, 0.024, 0.048);

  const selectorArm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.010, 0.065), M_AK_STEEL);
  selectorArm.rotation.x = -0.08;
  selectorArm.position.set(0.0195, 0.017, 0.016);

  const selectorTab = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.018), M_AK_STEEL_BRT);
  selectorTab.position.set(0.0205, 0.016, -0.012);

  /* =========================================================
     3. EMPUNHADURA DE MADEIRA (WOOD PISTOL GRIP)
     ========================================================= */
  const grip = new THREE.Group();
  grip.position.set(0, -0.012, 0.050);
  grip.rotation.x = -0.22; // Inclinado para trás (na direção do buttstock)

  // Fixador metálico superior
  const gripFerrule = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.038), M_AK_STEEL);
  gripFerrule.position.set(0, -0.004, 0);
  grip.add(gripFerrule);

  // Corpo esculpido em madeira nobre
  const gripMain = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.085, 0.036), M_AK_WOOD);
  gripMain.position.set(0, -0.048, 0);
  grip.add(gripMain);

  // Entalhe anatômico frontal
  const gripFinger = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.008), M_AK_WOOD_DARK);
  gripFinger.position.set(0, -0.040, -0.018);
  grip.add(gripFinger);

  // Curvatura traseira da palma (Beavertail swell)
  const gripBack = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.055, 0.006), M_AK_WOOD_DARK);
  gripBack.position.set(0, -0.052, 0.018);
  grip.add(gripBack);

  // Base metálica com parafuso de fixação
  const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.006, 0.036), M_AK_STEEL);
  gripCap.position.set(0, -0.092, 0);
  grip.add(gripCap);

  /* =========================================================
     4. CORONHA FIXA DE MADEIRA (WOOD BUTTSTOCK)
     ========================================================= */
  // Encaixe metálico do receiver na coronha (Rear tangs)
  const stockTangUpper = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.024), M_AK_STEEL);
  stockTangUpper.position.set(0, 0.038, 0.096);
  const stockTangLower = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.024), M_AK_STEEL);
  stockTangLower.position.set(0, -0.008, 0.096);

  // Corpo principal da coronha em madeira
  const stockWood = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.068, 0.18), M_AK_WOOD);
  stockWood.rotation.x = -0.10; // Queda clássica (drop at comb)
  stockWood.position.set(0, 0.008, 0.195);

  // Parte superior arredondada (Comb do apoio de bochecha)
  const stockComb = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.018, 0.14), M_AK_WOOD_DARK);
  stockComb.rotation.x = -0.10;
  stockComb.position.set(0, 0.042, 0.190);

  // Expansão inferior traseira da coronha
  const stockHeel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.07), M_AK_WOOD);
  stockHeel.rotation.x = -0.06;
  stockHeel.position.set(0, -0.025, 0.25);

  // Soleira de aço na extremidade traseira (Buttplate)
  const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.092, 0.008), M_AK_STEEL);
  buttplate.rotation.x = -0.08;
  buttplate.position.set(0, -0.005, 0.285);

  // Parafusos da soleira
  const buttScrew1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M_AK_DARK);
  buttScrew1.rotation.x = Math.PI / 2;
  buttScrew1.position.set(0, 0.025, 0.288);
  const buttScrew2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M_AK_DARK);
  buttScrew2.rotation.x = Math.PI / 2;
  buttScrew2.position.set(0, -0.035, 0.288);

  // Zarelho inferior de bandoleira (Sling Swivel)
  const slingMount = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.012), M_AK_STEEL);
  slingMount.position.set(0, -0.048, 0.245);
  const slingRing = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0016, 6, 12), M_AK_STEEL);
  slingRing.position.set(0, -0.056, 0.245);

  /* =========================================================
     5. CARREGADOR CURVO DE 30 TIROS (BANANA MAGAZINE)
     ========================================================= */
  const mag = new THREE.Group();
  mag.position.set(0, -0.015, -0.040);

  // Cria o arco do carregador através de segmentos angulados
  const numSegments = 5;
  const segHeight = 0.032;
  let curAngle = 0;
  let curY = 0;
  let curZ = 0;

  for (let i = 0; i < numSegments; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.028, segHeight, 0.065), M_AK_MAG);
    seg.position.set(0, curY - segHeight * 0.5, curZ);
    seg.rotation.x = curAngle;
    mag.add(seg);

    // Nervuras horizontais de reforço estampadas (Ribs de metal)
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.003, 0.052), M_AK_DARK);
    rib1.position.set(0, curY - segHeight * 0.35, curZ);
    rib1.rotation.x = curAngle;
    mag.add(rib1);

    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.003, 0.052), M_AK_DARK);
    rib2.position.set(0, curY - segHeight * 0.70, curZ);
    rib2.rotation.x = curAngle;
    mag.add(rib2);

    // Incrementa curvatura
    curAngle += 0.09;
    curY -= segHeight * Math.cos(curAngle);
    curZ -= segHeight * Math.sin(curAngle);
  }

  // Coluna vertical traseira de reforço (Spine)
  const magSpine = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.14, 0.005), M_AK_DARK);
  magSpine.rotation.x = 0.22;
  magSpine.position.set(0, -0.085, 0.020);
  mag.add(magSpine);

  // Placa base do carregador (Floorplate)
  const floorplate = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.070), M_AK_STEEL);
  floorplate.position.set(0, curY, curZ);
  floorplate.rotation.x = curAngle;
  mag.add(floorplate);

  /* =========================================================
     6. GUARDA-MÃO DE MADEIRA (WOOD HANDGUARD & GAS TUBE)
     ========================================================= */
  // Bloco trunnion dianteiro do receiver (Base da alça de mira)
  const frontTrunnion = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.050), M_AK_RECEIVER);
  frontTrunnion.position.set(0, 0.022, -0.125);

  // Anel metálico traseiro de fixação do guarda-mão (Rear Handguard Retainer)
  const rearHandRetainer = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.050, 0.008), M_AK_STEEL);
  rearHandRetainer.position.set(0, 0.022, -0.150);

  // Guarda-Mão Inferior em Madeira Nobre (Lower Handguard com abaulamento lateral)
  const lowerHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.13), M_AK_WOOD);
  lowerHandguard.position.set(0, 0.005, -0.215);

  // Sulcos laterais para apoio dos dedos (Palm swell grooves)
  const palmSwellL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.09), M_AK_WOOD_DARK);
  palmSwellL.position.set(-0.0215, 0.008, -0.215);
  const palmSwellR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.09), M_AK_WOOD_DARK);
  palmSwellR.position.set(0.0215, 0.008, -0.215);

  // Protetor Superior do Tubo de Gás em Madeira (Upper Handguard)
  const upperHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.11), M_AK_WOOD);
  upperHandguard.position.set(0, 0.041, -0.210);

  const upperWoodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10), M_AK_WOOD);
  upperWoodTop.rotation.x = Math.PI / 2;
  upperWoodTop.position.set(0, 0.045, -0.210);

  // Anel metálico frontal de retenção (Front Handguard Retainer com alavanca de trava)
  const frontHandRetainer = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.010), M_AK_STEEL);
  frontHandRetainer.position.set(0, 0.022, -0.275);

  const retainerLock = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), M_AK_STEEL_BRT);
  retainerLock.position.set(0.019, 0.030, -0.275);

  /* =========================================================
     7. TUBO DE GÁS, BLOCO DE GÁS E CANO EM AÇO
     ========================================================= */
  // Tubo de gás superior em aço (Gas Cylinder Tube)
  const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.09, 12), M_AK_STEEL);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, 0.042, -0.325);

  // Bloco de gás angular a 45° (Gas Block)
  const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.042, 0.032), M_AK_STEEL);
  gasBlock.position.set(0, 0.032, -0.380);

  const gasBlockSlant = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.020, 0.022), M_AK_STEEL);
  gasBlockSlant.rotation.x = 0.78; // 45 graus
  gasBlockSlant.position.set(0, 0.040, -0.370);

  // Furos de alívio de gás no bloco
  const gasPortL = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.028, 6), M_AK_DARK);
  gasPortL.rotation.z = Math.PI / 2;
  gasPortL.position.set(0, 0.044, -0.380);

  // Suporte de baioneta / guia da vareta sob o bloco de gás
  const bayonetLug = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.020), M_AK_STEEL);
  bayonetLug.position.set(0, 0.008, -0.380);

  // Cano principal em aço (Barrel que se estende até o compensador)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.38, 12), M_AK_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.020, -0.340);

  // Vareta de limpeza clássica do AK embaixo do cano (Cleaning Rod)
  const cleaningRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.35, 8), M_AK_STEEL_BRT);
  cleaningRod.rotation.x = Math.PI / 2;
  cleaningRod.position.set(0, 0.006, -0.330);

  const rodHead = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 8), M_AK_STEEL_BRT);
  rodHead.rotation.x = Math.PI / 2;
  rodHead.position.set(0, 0.006, -0.505);

  /* =========================================================
     8. MASSA DE MIRA DIANTEIRA E BOCA DO CANO (FRONT SIGHT & MUZZLE)
     ========================================================= */
  // Torre da massa de mira dianteira (Front Sight Block)
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.038, 0.024), M_AK_STEEL);
  frontSightBase.position.set(0, 0.032, -0.490);

  // Aletas protetoras abertas da massa de mira (Protective Wings/Ears)
  const sightWingL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.024, 0.016), M_AK_STEEL);
  sightWingL.position.set(-0.008, 0.060, -0.490);

  const sightWingR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.024, 0.016), M_AK_STEEL);
  sightWingR.position.set(0.008, 0.060, -0.490);

  // Pino central cilíndrico de mira (Front Sight Post)
  // Perfeitamente centrado em X=0, Y=0.060, Z=-0.490 para visada ADS precisa
  const frontSightPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.014, 8), M_AK_STEEL_BRT);
  frontSightPin.position.set(0, 0.058, -0.490);

  // Ponta fosfatizada contrastante no topo do pino
  const frontSightTip = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 6, 6), M_AK_DARK);
  frontSightTip.position.set(0, 0.063, -0.490);

  // Compensador chanfrado de boca do AKM / Porca do cano (Slanted Muzzle Brake)
  const muzzleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.015, 12), M_AK_STEEL);
  muzzleBase.rotation.x = Math.PI / 2;
  muzzleBase.position.set(0, 0.020, -0.518);

  const muzzleSlant = new THREE.Mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.022, 12), M_AK_STEEL);
  muzzleSlant.rotation.x = (Math.PI / 2) + 0.25; // Corte angular característico do AK
  muzzleSlant.position.set(0, 0.021, -0.534);

  const muzzleHole = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.010, 8), M_AK_DARK);
  muzzleHole.rotation.x = Math.PI / 2;
  muzzleHole.position.set(0, 0.020, -0.545);

  /* =========================================================
     9. ALÇA DE MIRA TRASEIRA (REAR TANGENT SIGHT)
     ========================================================= */
  // Base da régua da alça de mira sobre o trunnion
  const rearSightMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.045), M_AK_STEEL);
  rearSightMount.position.set(0, 0.046, -0.125);

  // Régua tangente inclinada (Sight Leaf)
  const sightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.005, 0.040), M_AK_STEEL);
  sightLeaf.rotation.x = -0.05;
  sightLeaf.position.set(0, 0.054, -0.122);

  // Cursor deslizante com botões de aperto nas laterais (Elevation Slider)
  const sightSlider = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.010), M_AK_STEEL_BRT);
  sightSlider.rotation.x = -0.05;
  sightSlider.position.set(0, 0.056, -0.132);

  // Lâminas da alça traseira formando o entalhe em U/V (Rear Notch)
  // Deixa abertura vazada no centro exatamente alinhada com o pino frontal
  const notchL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.005), M_AK_STEEL);
  notchL.position.set(-0.006, 0.059, -0.104);

  const notchR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.005), M_AK_STEEL);
  notchR.position.set(0.006, 0.059, -0.104);

  /* =========================================================
     10. ADICIONA TODAS AS MALHAS AO GRUPO DA ARMA
     ========================================================= */
  g.add(
    receiver, dustCover, dustRib, takedownLug, dimpleL, dimpleR,
    pin1, pin2, trigGuardFront, trigGuardBot, trigGuardRear, trigger, magCatch,
    ejectCutout, boltCarrier, handleStem, handleKnob,
    selectorPivot, selectorArm, selectorTab,
    grip, stockTangUpper, stockTangLower, stockWood, stockComb, stockHeel,
    buttplate, buttScrew1, buttScrew2, slingMount, slingRing,
    mag, frontTrunnion, rearHandRetainer, lowerHandguard, palmSwellL, palmSwellR,
    upperHandguard, upperWoodTop, frontHandRetainer, retainerLock,
    gasTube, gasBlock, gasBlockSlant, gasPortL, bayonetLug,
    barrel, cleaningRod, rodHead,
    frontSightBase, sightWingL, sightWingR, frontSightPin, frontSightTip,
    muzzleBase, muzzleSlant, muzzleHole,
    rearSightMount, sightLeaf, sightSlider, notchL, notchR
  );

  // Ativa sombras para renderização tática consistente
  g.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return g;
}
