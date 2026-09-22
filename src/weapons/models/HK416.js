/**
 * ============================================================================
 *               HECKLER & KOCH HK416 — MONUMENTO PROCEDURAL
 * ============================================================================
 * Marco de engenharia e modelagem procedural comemorativo da versão final do 
 * protótipo FPS Blocky (Three.js).
 * 
 * Todo construído exclusivamente com primitivas geométricas (Box, Cylinder, 
 * Torus, Sphere) e materiais PBR de alto brilho anodizado militar.
 * 
 * ANATOMIA ESTRUTURAL:
 *   1. Upper & Lower Receiver:
 *      - Perfil elevado característico do sistema de pistão de curso curto HK.
 *      - Magwell alargado e chanfrado (flared magwell) com placas de reforço.
 *      - Pinos de desmontagem tática, seletor de tiro ambidestro (Safe/Auto),
 *        retém do ferrolho (bolt catch), retém do carregador e guarda-mato curvo.
 * 
 *   2. Conjunto de Ejeção & Assistência de Avanço:
 *      - Janela de ejeção chanfrada com tampa contra poeira (dust cover) aberta.
 *      - Ferrolho usinado cromado (bolt carrier) com cartucho 5.56mm em latão.
 *      - Defletor de estojos (brass deflector) e forward assist cilíndrico a 45°.
 *      - Alavanca de manejo tática ambidestra (charging handle) com trava larga.
 * 
 *   3. Guarda-Mão Quad-Rail (HK Free-Float Handguard):
 *      - Trilho Picatinny superior contínuo com dentes 3D usinados individualmente.
 *      - Trilhos laterais e inferior com janelas de arrefecimento em baixo relevo.
 *      - Parafuso mestre de fixação HK (cross-locking hex bolt).
 * 
 *   4. Sistema de Gás, Cano & Quebra-Chamas:
 *      - Bloco de gás com regulador de pressão de pistão.
 *      - Cano flutuante usinado em aço com anel espaçador (crush washer).
 *      - Quebra-chamas tático HK Birdcage com ranhuras longitudinais de alívio.
 * 
 *   5. Carregador Estilo P-MAG:
 *      - Curvatura ergonômica STANAG com nervuras horizontais antiderrapantes.
 *      - Baseplate alargado de polímero de alta densidade com orifício de extração.
 * 
 *   6. Punho Ergonômico HK Battle Grip V2:
 *      - Inclinação tática com beavertail traseiro e ressalto anatômico frontal.
 * 
 *   7. Coronha Telescópica HK E1 / SlimLine:
 *      - Tubo amortecedor mil-spec em aço com porca castelo e alavanca de ajuste.
 *      - Soleira de borracha estriada convexa com soquetes QD de bandoleira.
 * 
 *   8. Conjunto de Miras Diópter HK (Alinhamento Preciso no ADS):
 *      - Alça de mira traseira: tambor giratório cilíndrico (rotary drum diopter).
 *      - Massa de mira dianteira: anel protetor circular (hooded ring) com pino
 *        central e ponto de trítio verde neon de alta visibilidade.
 * ============================================================================
 */

import * as THREE from 'three';

// Materiais PBR Táticos da HK416 (Preto Anodizado Brilhante de Alta Definição)
export const M_HK_GLOSS    = new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.12, metalness: 0.95 });
export const M_HK_RECEIVER = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.20, metalness: 0.90 });
export const M_HK_STEEL    = new THREE.MeshStandardMaterial({ color: 0x484f59, roughness: 0.12, metalness: 0.98 });
export const M_HK_POLYMER  = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.52, metalness: 0.30 });
export const M_HK_MAG      = new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.30, metalness: 0.70 });
export const M_HK_BRASS    = new THREE.MeshStandardMaterial({ color: 0xdeb340, roughness: 0.18, metalness: 0.92 });
export const M_HK_TRIT     = new THREE.MeshBasicMaterial({ color: 0x33ff66 });
export const M_HK_RED      = new THREE.MeshBasicMaterial({ color: 0xdd2222 });
export const M_HK_WHITE    = new THREE.MeshBasicMaterial({ color: 0xdddddd });

export function buildHK416() {
  const g = new THREE.Group();

  /* =========================================================
     1. RECEIVER SUPERIOR & INFERIOR (UPPER & LOWER)
     ========================================================= */
  // Upper Receiver - Perfil clássico HK416 (mais alto que M4 para pistão de gás)
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.052, 0.22), M_HK_RECEIVER);
  upper.position.set(0, 0.018, -0.02);

  // Lower Receiver
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.058, 0.16), M_HK_RECEIVER);
  lower.position.set(0, -0.030, 0.02);

  // Magwell beveled alargado (Estilo HK flared magwell)
  const magwell = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.068, 0.076), M_HK_GLOSS);
  magwell.position.set(0, -0.052, -0.042);
  const magwellLip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.082), M_HK_GLOSS);
  magwellLip.position.set(0, -0.082, -0.042);

  // Relevo lateral do Magwell (Logotipo / rebaixo do receiver)
  const magwellPlateL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.038, 0.050), M_HK_STEEL);
  magwellPlateL.position.set(-0.0245, -0.052, -0.042);
  const magwellPlateR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.038, 0.050), M_HK_STEEL);
  magwellPlateR.position.set(0.0245, -0.052, -0.042);

  // Pinos de desmontagem tática (Takedown Pins)
  const pinFront = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.050, 10), M_HK_STEEL);
  pinFront.rotation.z = Math.PI / 2;
  pinFront.position.set(0, -0.012, -0.070);

  const pinRear = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.050, 10), M_HK_STEEL);
  pinRear.rotation.z = Math.PI / 2;
  pinRear.position.set(0, -0.006, 0.085);

  // Seletor de tiro ambidestro (Safe / Semi / Auto)
  const selectorL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.022), M_HK_STEEL);
  selectorL.position.set(-0.025, -0.018, 0.052);
  selectorL.rotation.x = -0.4;
  const indSafe = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.003, 0.006), M_HK_WHITE);
  indSafe.position.set(-0.024, -0.010, 0.045);
  const indAuto = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.003, 0.006), M_HK_RED);
  indAuto.position.set(-0.024, -0.010, 0.060);

  // Retém do ferrolho (Bolt Catch Paddle) à esquerda
  const boltCatch = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.020, 0.014), M_HK_STEEL);
  boltCatch.position.set(-0.024, 0.008, -0.018);

  // Retém do carregador (Mag Release) à direita
  const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.014), M_HK_STEEL);
  magRelease.position.set(0.024, -0.032, -0.035);

  // Guarda-mato tático curvado
  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.055), M_HK_POLYMER);
  trigGuard.position.set(0, -0.074, 0.028);

  // Gatilho tático estilizado
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.010), M_HK_STEEL);
  trigger.position.set(0, -0.054, 0.024);
  trigger.rotation.x = 0.28;

  /* =========================================================
     2. EJECTION PORT, BOLT CARRIER & FORWARD ASSIST
     ========================================================= */
  // Janela de ejeção chanfrada (lado direito)
  const ejectPort = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.065), M_HK_GLOSS);
  ejectPort.position.set(0.021, 0.022, -0.010);

  // Ferrolho cromado usinado visível dentro da janela (Bolt Carrier Group)
  const boltCarrier = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.062, 12), M_HK_STEEL);
  boltCarrier.rotation.x = Math.PI / 2;
  boltCarrier.position.set(0.012, 0.022, -0.010);

  // Cartucho 5.56mm dourado visível na câmara
  const brassCase = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.022, 10), M_HK_BRASS);
  brassCase.rotation.x = Math.PI / 2;
  brassCase.position.set(0.015, 0.020, -0.024);

  // Tampa contra poeira aberta (Dust Cover abaixada)
  const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.018, 0.065), M_HK_RECEIVER);
  dustCover.position.set(0.024, 0.006, -0.010);
  dustCover.rotation.z = -0.55;

  // Defletor de estojos (Brass Deflector wedge)
  const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.020, 0.022), M_HK_GLOSS);
  deflector.position.set(0.026, 0.022, 0.038);
  deflector.rotation.y = -0.35;

  // Assistente de avanço (Forward Assist cilíndrico a 45 graus)
  const fwdAssistHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.026, 10), M_HK_GLOSS);
  fwdAssistHousing.rotation.z = -Math.PI / 4;
  fwdAssistHousing.position.set(0.028, 0.026, 0.070);

  const fwdAssistButton = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.014, 10), M_HK_STEEL);
  fwdAssistButton.rotation.z = -Math.PI / 4;
  fwdAssistButton.position.set(0.037, 0.035, 0.070);

  // Alavanca de manejo tática ambidestra traseira (Charging Handle)
  const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.010, 0.022), M_HK_RECEIVER);
  chargingHandle.position.set(0, 0.046, 0.102);
  const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.014, 0.014), M_HK_GLOSS);
  latchL.position.set(-0.024, 0.046, 0.102);

  /* =========================================================
     3. QUAD-RAIL HANDGUARD HK416 (M-LOK / PICATINNY HYBRID)
     ========================================================= */
  // Corpo do Guarda-mão octogonal alongado
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.054, 0.22), M_HK_GLOSS);
  handguard.position.set(0, 0.019, -0.22);

  // Parafuso Mestre de fixação HK (Cross-Locking Hex Bolt)
  const hkHexBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.054, 8), M_HK_STEEL);
  hkHexBolt.rotation.z = Math.PI / 2;
  hkHexBolt.position.set(0, 0.010, -0.125);

  // Trilho Picatinny Superior Contínuo Elevado (HK monolithic rail)
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.013, 0.44), M_HK_GLOSS);
  topRail.position.set(0, 0.048, -0.13);

  // Ranhuras/Dentes Picatinny usinados no topo (Relevo 3D de alta definição)
  for (let z = 0.06; z >= -0.32; z -= 0.020) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.004, 0.008), M_HK_STEEL);
    slot.position.set(0, 0.053, z);
    g.add(slot);
  }

  // Trilhos Laterais (Quad Rail Picatinny esquerdo e direito)
  const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.022, 0.19), M_HK_GLOSS);
  sideRailL.position.set(-0.027, 0.019, -0.22);

  const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.022, 0.19), M_HK_GLOSS);
  sideRailR.position.set(0.027, 0.019, -0.22);

  // Trilho Picatinny Inferior para grip / lanterna
  const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.007, 0.19), M_HK_GLOSS);
  bottomRail.position.set(0, -0.010, -0.22);

  // Janelas de ventilação do pistão de gás (Cooling Vents em baixo relevo)
  for (let vz = -0.15; vz >= -0.29; vz -= 0.038) {
    const ventL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.009, 0.022), M_HK_STEEL);
    ventL.position.set(-0.025, 0.034, vz);
    const ventR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.009, 0.022), M_HK_STEEL);
    ventR.position.set(0.025, 0.034, vz);
    g.add(ventL, ventR);
  }

  /* =========================================================
     4. SISTEMA DE GÁS, CANO & QUEBRA-CHAMAS (BARREL & MUZZLE)
     ========================================================= */
  // Bloco de gás com pistão de curso curto (Short-Stroke Gas Block)
  const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.046, 0.032), M_HK_RECEIVER);
  gasBlock.position.set(0, 0.030, -0.345);

  const gasRegulator = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 10), M_HK_STEEL);
  gasRegulator.rotation.x = Math.PI / 2;
  gasRegulator.position.set(0, 0.044, -0.360);

  // Cano de precisão em aço fosfatizado usinado
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 16), M_HK_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.019, -0.40);

  // Anel espaçador de boca de cano (Crush Washer)
  const crushWasher = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 12), M_HK_STEEL);
  crushWasher.rotation.x = Math.PI / 2;
  crushWasher.position.set(0, 0.019, -0.490);

  // Quebra-chamas tático HK Birdcage com ranhuras longitudinais
  const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.046, 16), M_HK_GLOSS);
  flashHider.rotation.x = Math.PI / 2;
  flashHider.position.set(0, 0.019, -0.515);

  // Coroa estriada na boca do quebra-chamas
  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.008, 16), M_HK_STEEL);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.019, -0.540);

  /* =========================================================
     5. CARREGADOR P-MAG COM NERVURAS (MAGAZINE)
     ========================================================= */
  // Corpo curvado com formato Stanag / Magpul
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.155, 0.060), M_HK_MAG);
  mag.position.set(0, -0.118, -0.030);
  mag.rotation.x = -0.16;

  // Nervuras antiderrapantes horizontais em relevo no carregador
  for (let my = -0.07; my >= -0.16; my -= 0.018) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.056), M_HK_GLOSS);
    rib.position.set(0, my, -0.030 + (my * 0.16));
    rib.rotation.x = -0.16;
    g.add(rib);
  }

  // Baseplate alargado de polímero com orifício de drenagem
  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.018, 0.066), M_HK_POLYMER);
  magBase.position.set(0, -0.198, -0.042);
  magBase.rotation.x = -0.16;

  /* =========================================================
     6. PUNHO PISTOL GRIP ERGONÔMICO (HK BATTLE GRIP V2)
     ========================================================= */
  // Corpo anatômico do punho inclinado
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.105, 0.046), M_HK_POLYMER);
  grip.position.set(0, -0.105, 0.108);
  grip.rotation.x = -0.32;

  // Ressalto frontal para apoio do dedo indicador/médio (Finger Ridge)
  const fingerRidge = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.014, 0.010), M_HK_GLOSS);
  fingerRidge.position.set(0, -0.098, 0.088);
  fingerRidge.rotation.x = -0.32;

  // Beavertail superior do punho que abraça a junção do receiver
  const beavertail = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, 0.032), M_HK_POLYMER);
  beavertail.position.set(0, -0.052, 0.095);
  beavertail.rotation.x = -0.12;

  // Tampa inferior do punho com parafuso
  const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.048), M_HK_GLOSS);
  gripCap.position.set(0, -0.155, 0.126);
  gripCap.rotation.x = -0.32;

  /* =========================================================
     7. CORONHA TELESCÓPICA HK E1 / SLIMLINE (STOCK)
     ========================================================= */
  // Tubo amortecedor mil-spec (Buffer Tube) em aço usinado brilhante
  const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 16), M_HK_STEEL);
  bufferTube.rotation.x = Math.PI / 2;
  bufferTube.position.set(0, 0.008, 0.18);

  // Porca castelo do buffer tube (Castle Nut entalhada)
  const castleNut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), M_HK_GLOSS);
  castleNut.rotation.x = Math.PI / 2;
  castleNut.position.set(0, 0.008, 0.105);

  // Corpo principal da coronha HK com perfil trapezoidal e apoio de bochecha
  const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.075, 0.15), M_HK_GLOSS);
  stockBody.position.set(0, -0.008, 0.24);

  // Alavanca inferior de ajuste de posição da coronha
  const stockLever = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.024, 0.08), M_HK_POLYMER);
  stockLever.position.set(0, -0.052, 0.23);

  // Soleira de borracha convexa ergonômica (Buttpad estriado)
  const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.115, 0.022), M_HK_POLYMER);
  buttpad.position.set(0, -0.020, 0.315);
  buttpad.rotation.x = -0.08;

  // Frisos de tração da soleira
  for (let sy = 0.02; sy >= -0.06; sy -= 0.022) {
    const padRib = new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.006, 0.004), M_HK_GLOSS);
    padRib.position.set(0, sy, 0.326 + (sy * 0.08));
    padRib.rotation.x = -0.08;
    g.add(padRib);
  }

  // Soquetes QD (Quick-Detach) para bandoleira em ambos os lados da coronha
  const qdL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), M_HK_STEEL);
  qdL.rotation.z = Math.PI / 2;
  qdL.position.set(-0.020, -0.008, 0.26);

  const qdR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), M_HK_STEEL);
  qdR.rotation.z = Math.PI / 2;
  qdR.position.set(0.020, -0.008, 0.26);

  /* =========================================================
     8. MIRA DIÓPTER ROTATIVA CLÁSSICA HECKLER & KOCH (SIGHTS)
     ========================================================= */
  // --- MIRA TRASEIRA (HK Rotary Drum Diopter) ---
  const rearMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.026), M_HK_GLOSS);
  rearMount.position.set(0, 0.060, 0.050);

  // Tambor diópter giratório chanfrado
  const rearDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.018, 14), M_HK_RECEIVER);
  rearDrum.rotation.x = Math.PI / 2;
  rearDrum.position.set(0, 0.076, 0.050);

  // Abertura circular vazada (Peep Hole exato centrado em Y=0.076)
  const rearApertureL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.018, 0.010), M_HK_RECEIVER);
  rearApertureL.position.set(-0.0078, 0.076, 0.050);
  const rearApertureR = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.018, 0.010), M_HK_RECEIVER);
  rearApertureR.position.set(0.0078, 0.076, 0.050);
  const rearApertureTop = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.006, 0.010), M_HK_RECEIVER);
  rearApertureTop.position.set(0, 0.085, 0.050);

  // Parafuso lateral de ajuste de vento (Windage screw)
  const windageKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.030, 10), M_HK_STEEL);
  windageKnob.rotation.z = Math.PI / 2;
  windageKnob.position.set(0, 0.060, 0.050);

  // --- MIRA DIANTEIRA (HK Hooded Front Sight - Anel Protetor Icônico) ---
  const frontMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.014, 0.024), M_HK_GLOSS);
  frontMount.position.set(0, 0.058, -0.260);

  // Anel de proteção circular da alça de mira (Hood)
  const frontHoodRing = new THREE.Mesh(new THREE.TorusGeometry(0.0092, 0.0016, 8, 20), M_HK_STEEL);
  frontHoodRing.position.set(0, 0.076, -0.260);

  // Pino central fino de aço
  const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.012, 8), M_HK_STEEL);
  frontPost.position.set(0, 0.071, -0.260);

  // Ponto de Trítio Verde Neon brilhante na ponta da massa de mira
  const frontTrit = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 10, 10), M_HK_TRIT);
  frontTrit.position.set(0, 0.076, -0.260);

  /* =========================================================
     9. MONTAGEM FINAL DO CONJUNTO
     ========================================================= */
  g.add(
    upper, lower, magwell, magwellLip, magwellPlateL, magwellPlateR,
    pinFront, pinRear, selectorL, indSafe, indAuto,
    boltCatch, magRelease, trigGuard, trigger,
    ejectPort, boltCarrier, brassCase, dustCover, deflector,
    fwdAssistHousing, fwdAssistButton, chargingHandle, latchL,
    handguard, hkHexBolt, topRail, sideRailL, sideRailR, bottomRail,
    gasBlock, gasRegulator, barrel, crushWasher, flashHider, muzzleTip,
    mag, magBase, grip, fingerRidge, beavertail, gripCap,
    bufferTube, castleNut, stockBody, stockLever, buttpad, qdL, qdR,
    rearMount, rearDrum, rearApertureL, rearApertureR, rearApertureTop, windageKnob,
    frontMount, frontHoodRing, frontPost, frontTrit
  );

  g.traverse(o => { 
    if (o.isMesh) {
      o.castShadow = true; 
      o.receiveShadow = true;
    } 
  });

  return g;
}
