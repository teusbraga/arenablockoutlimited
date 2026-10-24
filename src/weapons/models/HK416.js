/**
 * ============================================================================
 *         HECKLER & KOCH HK416 — FACELIFT v2.0 (M249 ADS SIGHT SYSTEM)
 * ============================================================================
 * Facelift visual PBR de alto contraste (Anodized HK Black, Gunmetal Steel,
 * Polymer Matte & RAL8000/Bronze accents) combinado com a arquitetura de
 * mira de ferro de visada limpa da M249 cravada no socket Y = 0.076.
 * ============================================================================
 */

import * as THREE from 'three';

function makeHKRailTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 128, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#24282e';
  ctx.fillRect(0, 0, w, h);

  // Linhas de usinagem do Quad-Rail HK
  ctx.fillStyle = '#16191d';
  ctx.fillRect(0, 10, w, 4);
  ctx.fillRect(0, 50, w, 4);

  // Janelas ovais de ventilação em baixo-relevo
  ctx.fillStyle = '#0f1114';
  for (let x = 14; x < w - 14; x += 22) {
    ctx.fillRect(x, 20, 14, 10);
    ctx.fillRect(x, 36, 14, 10);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const HK_RAIL_TEX = makeHKRailTexture();

// Materiais PBR Táticos da HK416 (Alto Contraste Militar)
export const M_HK_GLOSS    = new THREE.MeshStandardMaterial({ color: 0x262b31, roughness: 0.30, metalness: 0.68 });
export const M_HK_RECEIVER = new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.36, metalness: 0.62 });
export const M_HK_STEEL    = new THREE.MeshStandardMaterial({ color: 0x828c96, roughness: 0.22, metalness: 0.88 });
export const M_HK_POLYMER  = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.72, metalness: 0.14 });
export const M_HK_MAG      = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.55, metalness: 0.30 });
export const M_HK_BRASS    = new THREE.MeshStandardMaterial({ color: 0xdfb850, roughness: 0.18, metalness: 0.92 });
export const M_HK_TRIT     = new THREE.MeshBasicMaterial({ color: 0x55ff77 });
export const M_HK_RED      = new THREE.MeshBasicMaterial({ color: 0xe62222 });
export const M_HK_WHITE    = new THREE.MeshBasicMaterial({ color: 0xeeeeee });

const M_HK_HANDGUARD = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: HK_RAIL_TEX,
  roughness: 0.34,
  metalness: 0.65
});
const M_HK_DARK_STEEL = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.42, metalness: 0.82 });
const M_HK_RAL8000    = new THREE.MeshStandardMaterial({ color: 0x8c734b, roughness: 0.32, metalness: 0.65 });

export function buildHK416() {
  const g = new THREE.Group();

  /* =========================================================
     1. RECEIVER SUPERIOR & INFERIOR (UPPER & LOWER)
     ========================================================= */
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.052, 0.22), M_HK_RECEIVER);
  upper.position.set(0, 0.018, -0.02);

  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.058, 0.16), M_HK_RECEIVER);
  lower.position.set(0, -0.030, 0.02);

  // Magwell chanfrado HK416
  const magwell = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.068, 0.076), M_HK_GLOSS);
  magwell.position.set(0, -0.052, -0.042);
  const magwellLip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.082), M_HK_DARK_STEEL);
  magwellLip.position.set(0, -0.082, -0.042);

  const magwellPlateL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.038, 0.050), M_HK_GLOSS);
  magwellPlateL.position.set(-0.0245, -0.052, -0.042);
  const magwellPlateR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.038, 0.050), M_HK_GLOSS);
  magwellPlateR.position.set(0.0245, -0.052, -0.042);

  // Pinos de desmontagem tática
  const pinFront = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.050, 10), M_HK_DARK_STEEL);
  pinFront.rotation.z = Math.PI / 2;
  pinFront.position.set(0, -0.012, -0.070);

  const pinRear = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.050, 10), M_HK_DARK_STEEL);
  pinRear.rotation.z = Math.PI / 2;
  pinRear.position.set(0, -0.006, 0.085);

  // Seletor de tiro ambidestro HK (pictogramas Branco / Vermelho)
  const selectorL = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.022), M_HK_DARK_STEEL);
  selectorL.position.set(-0.025, -0.018, 0.052);
  selectorL.rotation.x = -0.4;
  const indSafe = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.003, 0.006), M_HK_WHITE);
  indSafe.position.set(-0.024, -0.010, 0.045);
  const indAuto = new THREE.Mesh(new THREE.BoxGeometry(0.001, 0.003, 0.006), M_HK_RED);
  indAuto.position.set(-0.024, -0.010, 0.060);

  const boltCatch = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.020, 0.014), M_HK_STEEL);
  boltCatch.position.set(-0.024, 0.008, -0.018);

  const magRelease = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.012, 0.014), M_HK_RAL8000);
  magRelease.position.set(0.024, -0.032, -0.035);

  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.055), M_HK_POLYMER);
  trigGuard.position.set(0, -0.074, 0.028);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.010), M_HK_STEEL);
  trigger.position.set(0, -0.054, 0.024);
  trigger.rotation.x = 0.28;

  /* =========================================================
     2. EJECTION PORT, BOLT CARRIER & FORWARD ASSIST
     ========================================================= */
  const ejectPort = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.022, 0.065), M_HK_DARK_STEEL);
  ejectPort.position.set(0.021, 0.022, -0.010);

  const boltCarrier = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.062, 12), M_HK_STEEL);
  boltCarrier.rotation.x = Math.PI / 2;
  boltCarrier.position.set(0.012, 0.022, -0.010);

  const brassCase = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.022, 10), M_HK_BRASS);
  brassCase.rotation.x = Math.PI / 2;
  brassCase.position.set(0.015, 0.020, -0.024);

  const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.018, 0.065), M_HK_GLOSS);
  dustCover.position.set(0.024, 0.006, -0.010);
  dustCover.rotation.z = -0.55;

  const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.020, 0.022), M_HK_GLOSS);
  deflector.position.set(0.026, 0.022, 0.038);
  deflector.rotation.y = -0.35;

  const fwdAssistHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.026, 10), M_HK_GLOSS);
  fwdAssistHousing.rotation.z = -Math.PI / 4;
  fwdAssistHousing.position.set(0.028, 0.026, 0.070);

  const fwdAssistButton = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.014, 10), M_HK_DARK_STEEL);
  fwdAssistButton.rotation.z = -Math.PI / 4;
  fwdAssistButton.position.set(0.037, 0.035, 0.070);

  // Charging Handle tático ambidestro com travas em RAL8000
  const chargingHandle = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.010, 0.022), M_HK_DARK_STEEL);
  chargingHandle.position.set(0, 0.046, 0.102);
  const latchL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.014), M_HK_RAL8000);
  latchL.position.set(-0.024, 0.046, 0.102);

  /* =========================================================
     3. QUAD-RAIL HANDGUARD HK416 (COM TEXTURA PROCEDURAL)
     ========================================================= */
  const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.054, 0.22), M_HK_HANDGUARD);
  handguard.position.set(0, 0.019, -0.22);

  // Parafuso Mestre de fixação HK (Cross-Locking Hex Bolt)
  const hkHexBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.054, 8), M_HK_STEEL);
  hkHexBolt.rotation.z = Math.PI / 2;
  hkHexBolt.position.set(0, -0.002, -0.125);

  // Trilho Picatinny Superior Contínuo
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.012, 0.44), M_HK_GLOSS);
  topRail.position.set(0, 0.048, -0.13);

  for (let z = 0.06; z >= -0.32; z -= 0.022) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.003, 0.008), M_HK_DARK_STEEL);
    slot.position.set(0, 0.054, z);
    g.add(slot);
  }

  const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.020, 0.19), M_HK_GLOSS);
  sideRailL.position.set(-0.027, 0.019, -0.22);

  const sideRailR = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.020, 0.19), M_HK_GLOSS);
  sideRailR.position.set(0.027, 0.019, -0.22);

  const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.007, 0.19), M_HK_GLOSS);
  bottomRail.position.set(0, -0.010, -0.22);

  /* =========================================================
     4. SISTEMA DE GÁS, CANO & QUEBRA-CHAMAS (BARREL & MUZZLE)
     ========================================================= */
  const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.044, 0.032), M_HK_DARK_STEEL);
  gasBlock.position.set(0, 0.028, -0.345);

  const gasRegulator = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.018, 10), M_HK_RAL8000);
  gasRegulator.rotation.x = Math.PI / 2;
  gasRegulator.position.set(0, 0.042, -0.360);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 16), M_HK_DARK_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.019, -0.40);

  const crushWasher = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.006, 12), M_HK_RAL8000);
  crushWasher.rotation.x = Math.PI / 2;
  crushWasher.position.set(0, 0.019, -0.490);

  const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.046, 16), M_HK_GLOSS);
  flashHider.rotation.x = Math.PI / 2;
  flashHider.position.set(0, 0.019, -0.515);

  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.008, 16), M_HK_STEEL);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.019, -0.540);

  /* =========================================================
     5. CARREGADOR P-MAG / HK MARITIME (MAGAZINE)
     ========================================================= */
  const magGroup = new THREE.Group();
  magGroup.name = 'magazine';

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.155, 0.060), M_HK_MAG);
  mag.position.set(0, -0.118, -0.030);
  mag.rotation.x = -0.16;
  magGroup.add(mag);

  for (let my = -0.07; my >= -0.16; my -= 0.018) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.005, 0.056), M_HK_POLYMER);
    rib.position.set(0, my, -0.030 + (my * 0.16));
    rib.rotation.x = -0.16;
    magGroup.add(rib);
  }

  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.018, 0.066), M_HK_POLYMER);
  magBase.position.set(0, -0.198, -0.042);
  magBase.rotation.x = -0.16;
  magGroup.add(magBase);

  g.add(magGroup);

  /* =========================================================
     6. PUNHO PISTOL GRIP ERGONÔMICO (HK BATTLE GRIP V2)
     ========================================================= */
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.105, 0.046), M_HK_POLYMER);
  grip.position.set(0, -0.105, 0.108);
  grip.rotation.x = -0.32;

  const fingerRidge = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.014, 0.010), M_HK_GLOSS);
  fingerRidge.position.set(0, -0.098, 0.088);
  fingerRidge.rotation.x = -0.32;

  const beavertail = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, 0.032), M_HK_POLYMER);
  beavertail.position.set(0, -0.052, 0.095);
  beavertail.rotation.x = -0.12;

  const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.048), M_HK_RED);
  gripCap.position.set(0, -0.155, 0.126);
  gripCap.rotation.x = -0.32;

  /* =========================================================
     7. CORONHA TELESCÓPICA HK E1 / SLIMLINE (STOCK)
     ========================================================= */
  const bufferTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 16), M_HK_RAL8000);
  bufferTube.rotation.x = Math.PI / 2;
  bufferTube.position.set(0, 0.008, 0.18);

  const castleNut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.014, 12), M_HK_DARK_STEEL);
  castleNut.rotation.x = Math.PI / 2;
  castleNut.position.set(0, 0.008, 0.105);

  const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.075, 0.15), M_HK_POLYMER);
  stockBody.position.set(0, -0.008, 0.24);

  // Detalhe superior de apoio de bochecha da HK SlimLine
  const stockCheek = new THREE.Mesh(new THREE.BoxGeometry(0.041, 0.024, 0.13), M_HK_GLOSS);
  stockCheek.position.set(0, 0.018, 0.242);

  const stockLever = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.024, 0.08), M_HK_GLOSS);
  stockLever.position.set(0, -0.052, 0.23);

  const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.115, 0.022), M_HK_DARK_STEEL);
  buttpad.position.set(0, -0.020, 0.315);
  buttpad.rotation.x = -0.08;

  const qdL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), M_HK_STEEL);
  qdL.rotation.z = Math.PI / 2;
  qdL.position.set(-0.021, -0.008, 0.26);

  const qdR = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), M_HK_STEEL);
  qdR.rotation.z = Math.PI / 2;
  qdR.position.set(0.021, -0.008, 0.26);

  /* =========================================================
     8. SISTEMA DE MIRAS DE FERRO (MODELO DE REFERÊNCIA)
        (Alça de mira com abertura circular 'peep', tambor
         lateral direito e aletas chanfradas; Massa de mira
         aberta com pino central e aletas chanfradas)
     ========================================================= */
  // --- ALÇA DE MIRA TRASEIRA (REAR SIGHT) ---
  // Base de montagem sobre o trilho Picatinny com parafuso transversal
  const rearSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.024), M_HK_DARK_STEEL);
  rearSightBase.position.set(0, 0.058, 0.045);

  const rearClampPlate = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.022), M_HK_GLOSS);
  rearClampPlate.position.set(0.013, 0.058, 0.045);

  const rearClampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.030, 8), M_HK_STEEL);
  rearClampBolt.rotation.z = Math.PI / 2;
  rearClampBolt.position.set(0, 0.056, 0.045);

  // Torre vertical de elevação rebaixada para abrir visada limpa
  const rearTower = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.010, 0.016), M_HK_DARK_STEEL);
  rearTower.position.set(0, 0.064, 0.045);

  // Aletas protetoras verticais proporcionais (flanqueiam o anel suavemente, sem dominar a tela)
  const rearWingL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.012, 0.014), M_HK_DARK_STEEL);
  rearWingL.position.set(-0.0085, 0.074, 0.045);

  const rearWingL_bevel = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0045, 0.014), M_HK_DARK_STEEL);
  rearWingL_bevel.position.set(-0.0095, 0.0805, 0.045);
  rearWingL_bevel.rotation.z = -0.45;

  const rearWingR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.012, 0.014), M_HK_DARK_STEEL);
  rearWingR.position.set(0.0085, 0.074, 0.045);

  const rearWingR_bevel = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0045, 0.014), M_HK_DARK_STEEL);
  rearWingR_bevel.position.set(0.0095, 0.0805, 0.045);
  rearWingR_bevel.rotation.z = 0.45;

  // Tambor de vento compacto e proporcional à direita (dimensões táticas autênticas)
  const rearDrumWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.0025, 14), M_HK_DARK_STEEL);
  rearDrumWheel.rotation.z = Math.PI / 2;
  rearDrumWheel.position.set(0.0115, 0.071, 0.045);

  const rearKnobMain = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.003, 16), M_HK_STEEL);
  rearKnobMain.rotation.z = Math.PI / 2;
  rearKnobMain.position.set(0.014, 0.071, 0.045);

  const rearKnobCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0048, 0.002, 16), M_HK_DARK_STEEL);
  rearKnobCap.rotation.z = Math.PI / 2;
  rearKnobCap.position.set(0.0165, 0.071, 0.045);

  // Eixo transversal do parafuso de ajuste
  const rearAxleL = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.0025, 10), M_HK_STEEL);
  rearAxleL.rotation.z = Math.PI / 2;
  rearAxleL.position.set(-0.0105, 0.071, 0.045);

  // Haste de suporte central do toro (fina e rebaixada, sem cobrir o orifício)
  const peepStem = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.005, 0.003), M_HK_DARK_STEEL);
  peepStem.position.set(0, 0.069, 0.045);

  // Anel metálico com orifício circular preciso cravado no eixo Y = 0.076
  const peepRing = new THREE.Mesh(new THREE.TorusGeometry(0.0034, 0.0011, 10, 20), M_HK_DARK_STEEL);
  peepRing.position.set(0, 0.076, 0.045);

  // --- MASSA DE MIRA DIANTEIRA (FRONT SIGHT) ---
  // Base de fixação sobre o bloco de gás / início do trilho
  const frontMount = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.022), M_HK_DARK_STEEL);
  frontMount.position.set(0, 0.058, -0.340);

  const frontClampPlate = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.020), M_HK_GLOSS);
  frontClampPlate.position.set(0.012, 0.058, -0.340);

  const frontClampBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.028, 8), M_HK_STEEL);
  frontClampBolt.rotation.z = Math.PI / 2;
  frontClampBolt.position.set(0, 0.056, -0.340);

  // Bloco vertical dianteiro
  const frontTower = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.010, 0.016), M_HK_DARK_STEEL);
  frontTower.position.set(0, 0.064, -0.340);

  // Aletas protetoras dianteiras chanfradas no topo (Abertas, proporcionais ao pino)
  const frontWingL = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.013, 0.014), M_HK_DARK_STEEL);
  frontWingL.position.set(-0.0065, 0.0725, -0.340);

  const frontWingL_bevel = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.004, 0.014), M_HK_DARK_STEEL);
  frontWingL_bevel.position.set(-0.0073, 0.0785, -0.340);
  frontWingL_bevel.rotation.z = -0.38;

  const frontWingR = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.013, 0.014), M_HK_DARK_STEEL);
  frontWingR.position.set(0.0065, 0.0725, -0.340);

  const frontWingR_bevel = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.004, 0.014), M_HK_DARK_STEEL);
  frontWingR_bevel.position.set(0.0073, 0.0785, -0.340);
  frontWingR_bevel.rotation.z = 0.38;

  // Base do pino de mira
  const frontPostBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 10), M_HK_DARK_STEEL);
  frontPostBase.position.set(0, 0.068, -0.340);

  // Pino central afilado (Front Post)
  const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0010, 0.010, 8), M_HK_STEEL);
  frontPost.position.set(0, 0.072, -0.340);

  // Ponto de trítio neon verde na ponta do pino central (Y = 0.076 no sweetspot de disparo)
  const frontTrit = new THREE.Mesh(new THREE.SphereGeometry(0.0011, 8, 8), M_HK_TRIT);
  frontTrit.position.set(0, 0.076, -0.340);

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
    grip, fingerRidge, beavertail, gripCap,
    bufferTube, castleNut, stockBody, stockCheek, stockLever, buttpad, qdL, qdR,
    rearSightBase, rearClampPlate, rearClampBolt, rearTower,
    rearWingL, rearWingL_bevel, rearWingR, rearWingR_bevel,
    rearDrumWheel, rearKnobMain, rearKnobCap, rearAxleL,
    peepStem, peepRing,
    frontMount, frontClampPlate, frontClampBolt, frontTower,
    frontWingL, frontWingL_bevel, frontWingR, frontWingR_bevel,
    frontPostBase, frontPost, frontTrit
  );

  g.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return g;
}

export function createHK416MagazineMesh() {
  const g = new THREE.Group();
  g.name = 'magazine_drop';

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.155, 0.060), M_HK_MAG);
  mag.position.set(0, 0.077, 0);
  g.add(mag);

  for (let my = 0.035; my <= 0.125; my += 0.018) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.031, 0.005, 0.056), M_HK_POLYMER);
    rib.position.set(0, my, 0);
    g.add(rib);
  }

  const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.033, 0.018, 0.066), M_HK_POLYMER);
  magBase.position.set(0, 0.009, 0);
  g.add(magBase);

  g.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return g;
}
