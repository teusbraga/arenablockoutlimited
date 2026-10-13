/**
 * ============================================================================
 *         AVTOMAT KALASHNIKOVA AK-47 — SOVIET MASTERWORK FACELIFT v2.0
 * ============================================================================
 * Madeira laminada russa envernizada procedural, carregador com nervuras em
 * aço oxidado / Bakelite, ferrolho cromado polido e miras abertas de alta
 * nitidez preservadas no eixo Y = 0.060.
 * ============================================================================
 */

import * as THREE from 'three';

function makeRussianWoodTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 128, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0.0, '#9a4418');
  grad.addColorStop(0.5, '#b35622');
  grad.addColorStop(1.0, '#78300e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Veios longitudinais da madeira laminada soviética
  ctx.fillStyle = 'rgba(45, 14, 4, 0.24)';
  for (let y = 2; y < h; y += 5) {
    ctx.fillRect(0, y, w, 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const AK_WOOD_TEX = makeRussianWoodTexture();

// Paleta PBR Fiel à AK-47 (Madeira Envernizada + Aço Soviético Oxidado)
export const M_AK_WOOD       = new THREE.MeshStandardMaterial({ color: 0xffffff, map: AK_WOOD_TEX, roughness: 0.30, metalness: 0.08 });
export const M_AK_WOOD_DARK  = new THREE.MeshStandardMaterial({ color: 0x6b2c0e, roughness: 0.38, metalness: 0.06 });
export const M_AK_RECEIVER   = new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.36, metalness: 0.68 });
export const M_AK_STEEL      = new THREE.MeshStandardMaterial({ color: 0x2f343a, roughness: 0.32, metalness: 0.75 });
export const M_AK_STEEL_BRT  = new THREE.MeshStandardMaterial({ color: 0xd0d7de, roughness: 0.16, metalness: 0.92 });
export const M_AK_MAG        = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.42, metalness: 0.62 });
export const M_AK_DARK       = new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.48, metalness: 0.45 });
const M_AK_FRONT_DOT         = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildAK47() {
  const g = new THREE.Group();

  /* =========================================================
     1. CAIXA DA CULATRA (RECEIVER & DUST COVER)
     ========================================================= */
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.052, 0.20), M_AK_RECEIVER);
  receiver.position.set(0, 0.015, -0.01);

  const dustCover = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.19), M_AK_STEEL);
  dustCover.position.set(0, 0.043, -0.01);

  const dustRib = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.004, 0.16), M_AK_DARK);
  dustRib.position.set(0, 0.052, -0.01);

  const takedownLug = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.016), M_AK_STEEL_BRT);
  takedownLug.position.set(0, 0.038, 0.088);

  const dimpleL = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.010, 0.036), M_AK_DARK);
  dimpleL.position.set(-0.0195, 0.008, -0.045);
  const dimpleR = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.010, 0.036), M_AK_DARK);
  dimpleR.position.set(0.0195, 0.008, -0.045);

  const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.042, 8), M_AK_STEEL_BRT);
  pin1.rotation.z = Math.PI / 2;
  pin1.position.set(0, 0.005, 0.02);

  const pin2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.042, 8), M_AK_STEEL_BRT);
  pin2.rotation.z = Math.PI / 2;
  pin2.position.set(0, 0.012, 0.05);

  const trigGuardFront = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.026, 0.004), M_AK_RECEIVER);
  trigGuardFront.position.set(0, -0.024, -0.005);
  const trigGuardBot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.004, 0.042), M_AK_RECEIVER);
  trigGuardBot.position.set(0, -0.036, 0.016);
  const trigGuardRear = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.018, 0.004), M_AK_RECEIVER);
  trigGuardRear.position.set(0, -0.026, 0.037);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.008), M_AK_STEEL_BRT);
  trigger.rotation.x = -0.35;
  trigger.position.set(0, -0.024, 0.018);

  const magCatch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.020, 0.006), M_AK_STEEL);
  magCatch.rotation.x = 0.40;
  magCatch.position.set(0, -0.020, -0.015);

  /* =========================================================
     2. LADO DIREITO: FERROLHO CROMADO, MANEJO E SELETOR
     ========================================================= */
  const ejectCutout = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.018, 0.060), M_AK_DARK);
  ejectCutout.position.set(0.018, 0.030, -0.035);

  const boltCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.055), M_AK_STEEL_BRT);
  boltCarrier.position.set(0.0175, 0.030, -0.035);

  const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 8), M_AK_STEEL_BRT);
  handleStem.rotation.z = Math.PI / 2;
  handleStem.position.set(0.027, 0.032, -0.025);

  const handleKnob = new THREE.Mesh(new THREE.SphereGeometry(0.0048, 8, 8), M_AK_STEEL_BRT);
  handleKnob.position.set(0.036, 0.035, -0.025);

  const selectorPivot = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), M_AK_STEEL);
  selectorPivot.rotation.z = Math.PI / 2;
  selectorPivot.position.set(0.0195, 0.024, 0.048);

  const selectorArm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.010, 0.065), M_AK_STEEL);
  selectorArm.rotation.x = -0.08;
  selectorArm.position.set(0.0195, 0.017, 0.016);

  const selectorTab = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.006, 0.018), M_AK_STEEL_BRT);
  selectorTab.position.set(0.0205, 0.016, -0.012);

  /* =========================================================
     3. EMPUNHADURA DE MADEIRA / BAKELITE (PISTOL GRIP)
     ========================================================= */
  const grip = new THREE.Group();
  grip.position.set(0, -0.012, 0.050);
  grip.rotation.x = -0.22;

  const gripFerrule = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.008, 0.038), M_AK_STEEL);
  gripFerrule.position.set(0, -0.004, 0);
  grip.add(gripFerrule);

  const gripMain = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.085, 0.036), M_AK_WOOD_DARK);
  gripMain.position.set(0, -0.048, 0);
  grip.add(gripMain);

  const gripFinger = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.022, 0.008), M_AK_WOOD);
  gripFinger.position.set(0, -0.040, -0.018);
  grip.add(gripFinger);

  const gripBack = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.055, 0.006), M_AK_WOOD);
  gripBack.position.set(0, -0.052, 0.018);
  grip.add(gripBack);

  const gripCap = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.006, 0.036), M_AK_STEEL);
  gripCap.position.set(0, -0.092, 0);
  grip.add(gripCap);

  /* =========================================================
     4. CORONHA FIXA DE MADEIRA LAMINADA RUSSA (WOOD BUTTSTOCK)
     ========================================================= */
  const stockTangUpper = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.024), M_AK_STEEL);
  stockTangUpper.position.set(0, 0.038, 0.096);
  const stockTangLower = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.024), M_AK_STEEL);
  stockTangLower.position.set(0, -0.008, 0.096);

  const stockWood = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.068, 0.18), M_AK_WOOD);
  stockWood.rotation.x = -0.10;
  stockWood.position.set(0, 0.008, 0.195);

  const stockComb = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.018, 0.14), M_AK_WOOD_DARK);
  stockComb.rotation.x = -0.10;
  stockComb.position.set(0, 0.042, 0.190);

  const stockHeel = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.07), M_AK_WOOD);
  stockHeel.rotation.x = -0.06;
  stockHeel.position.set(0, -0.025, 0.25);

  const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.092, 0.008), M_AK_DARK);
  buttplate.rotation.x = -0.08;
  buttplate.position.set(0, -0.005, 0.285);

  const buttScrew1 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M_AK_STEEL_BRT);
  buttScrew1.rotation.x = Math.PI / 2;
  buttScrew1.position.set(0, 0.025, 0.288);
  const buttScrew2 = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M_AK_STEEL_BRT);
  buttScrew2.rotation.x = Math.PI / 2;
  buttScrew2.position.set(0, -0.035, 0.288);

  const slingMount = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.012), M_AK_STEEL);
  slingMount.position.set(0, -0.048, 0.245);
  const slingRing = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0016, 6, 12), M_AK_STEEL_BRT);
  slingRing.position.set(0, -0.056, 0.245);

  /* =========================================================
     5. CARREGADOR CURVO DE 30 TIROS (BANANA MAGAZINE)
     ========================================================= */
  const mag = new THREE.Group();
  mag.position.set(0, -0.015, -0.040);

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

    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.003, 0.052), M_AK_DARK);
    rib1.position.set(0, curY - segHeight * 0.35, curZ);
    rib1.rotation.x = curAngle;
    mag.add(rib1);

    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.029, 0.003, 0.052), M_AK_DARK);
    rib2.position.set(0, curY - segHeight * 0.70, curZ);
    rib2.rotation.x = curAngle;
    mag.add(rib2);

    curAngle += 0.09;
    curY -= segHeight * Math.cos(curAngle);
    curZ -= segHeight * Math.sin(curAngle);
  }

  const magSpine = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.14, 0.005), M_AK_DARK);
  magSpine.rotation.x = 0.22;
  magSpine.position.set(0, -0.085, 0.020);
  mag.add(magSpine);

  const floorplate = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.070), M_AK_STEEL);
  floorplate.position.set(0, curY, curZ);
  floorplate.rotation.x = curAngle;
  mag.add(floorplate);

  /* =========================================================
     6. GUARDA-MÃO DE MADEIRA (WOOD HANDGUARD & GAS TUBE)
     ========================================================= */
  const frontTrunnion = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.050), M_AK_RECEIVER);
  frontTrunnion.position.set(0, 0.022, -0.125);

  const rearHandRetainer = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.050, 0.008), M_AK_STEEL);
  rearHandRetainer.position.set(0, 0.022, -0.150);

  const lowerHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.038, 0.13), M_AK_WOOD);
  lowerHandguard.position.set(0, 0.005, -0.215);

  const palmSwellL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.09), M_AK_WOOD_DARK);
  palmSwellL.position.set(-0.0215, 0.008, -0.215);
  const palmSwellR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.09), M_AK_WOOD_DARK);
  palmSwellR.position.set(0.0215, 0.008, -0.215);

  const upperHandguard = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.11), M_AK_WOOD);
  upperHandguard.position.set(0, 0.041, -0.210);

  const upperWoodTop = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.11, 10), M_AK_WOOD_DARK);
  upperWoodTop.rotation.x = Math.PI / 2;
  upperWoodTop.position.set(0, 0.045, -0.210);

  const frontHandRetainer = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.046, 0.010), M_AK_STEEL);
  frontHandRetainer.position.set(0, 0.022, -0.275);

  const retainerLock = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.006), M_AK_STEEL_BRT);
  retainerLock.position.set(0.019, 0.030, -0.275);

  /* =========================================================
     7. TUBO DE GÁS, BLOCO DE GÁS E CANO EM AÇO
     ========================================================= */
  const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.09, 12), M_AK_STEEL);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, 0.042, -0.325);

  const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.042, 0.032), M_AK_STEEL);
  gasBlock.position.set(0, 0.032, -0.380);

  const gasBlockSlant = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.020, 0.022), M_AK_STEEL);
  gasBlockSlant.rotation.x = 0.78;
  gasBlockSlant.position.set(0, 0.040, -0.370);

  const gasPortL = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.028, 6), M_AK_DARK);
  gasPortL.rotation.z = Math.PI / 2;
  gasPortL.position.set(0, 0.044, -0.380);

  const bayonetLug = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, 0.020), M_AK_STEEL);
  bayonetLug.position.set(0, 0.008, -0.380);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.38, 12), M_AK_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.020, -0.340);

  const cleaningRod = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.35, 8), M_AK_STEEL_BRT);
  cleaningRod.rotation.x = Math.PI / 2;
  cleaningRod.position.set(0, 0.006, -0.330);

  const rodHead = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.014, 8), M_AK_STEEL_BRT);
  rodHead.rotation.x = Math.PI / 2;
  rodHead.position.set(0, 0.006, -0.505);

  /* =========================================================
     8. MASSA DE MIRA DIANTEIRA E BOCA DO CANO (Y = 0.060 EXATO)
     ========================================================= */
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.038, 0.024), M_AK_STEEL);
  frontSightBase.position.set(0, 0.032, -0.490);

  const sightWingL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.024, 0.016), M_AK_DARK);
  sightWingL.position.set(-0.0085, 0.060, -0.490);

  const sightWingR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.024, 0.016), M_AK_DARK);
  sightWingR.position.set(0.0085, 0.060, -0.490);

  const frontSightPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0014, 0.014, 8), M_AK_DARK);
  frontSightPin.position.set(0, 0.056, -0.490);

  // Esfera de trítio verde tático soviético na ponta da massa (X=0, Y=0.062)
  const frontSightTip = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 8), M_AK_FRONT_DOT);
  frontSightTip.position.set(0, 0.062, -0.490);

  const muzzleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.015, 12), M_AK_STEEL);
  muzzleBase.rotation.x = Math.PI / 2;
  muzzleBase.position.set(0, 0.020, -0.518);

  const muzzleSlant = new THREE.Mesh(new THREE.CylinderGeometry(0.0092, 0.0092, 0.022, 12), M_AK_STEEL);
  muzzleSlant.rotation.x = (Math.PI / 2) + 0.25;
  muzzleSlant.position.set(0, 0.021, -0.534);

  const muzzleHole = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.010, 8), M_AK_DARK);
  muzzleHole.rotation.x = Math.PI / 2;
  muzzleHole.position.set(0, 0.020, -0.545);

  /* =========================================================
     9. ALÇA DE MIRA TRASEIRA (REAR TANGENT SIGHT)
     ========================================================= */
  const rearSightMount = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.016, 0.045), M_AK_STEEL);
  rearSightMount.position.set(0, 0.046, -0.125);

  const sightLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.005, 0.040), M_AK_DARK);
  sightLeaf.rotation.x = -0.05;
  sightLeaf.position.set(0, 0.054, -0.122);

  const sightSlider = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.010), M_AK_STEEL_BRT);
  sightSlider.rotation.x = -0.05;
  sightSlider.position.set(0, 0.056, -0.132);

  const notchL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.005), M_AK_DARK);
  notchL.position.set(-0.006, 0.059, -0.104);

  const notchR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.010, 0.005), M_AK_DARK);
  notchR.position.set(0.006, 0.059, -0.104);

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

  g.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return g;
}