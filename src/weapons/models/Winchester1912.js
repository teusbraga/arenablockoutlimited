/**
 * ============================================================================
 *         WINCHESTER MODEL 1912 (M12) TRENCH GUN — PROCEDURAL 3D MODEL
 * ============================================================================
 * A lendária escopeta de repetição por ação de bomba (Pump-Action Shotgun)
 * calibre 12, versão militar Trench Gun da Primeira e Segunda Guerra Mundial.
 *
 * DETALHES DE ALTA FIDELIDADE:
 *   1. Coronha e Telha em Nogueira Americana Envernizada (Rich American Walnut):
 *      - Coronha clássica com empunhadura semi-pistola, soleira em aço escuro e zarelho.
 *      - Telha cilíndrica de madeira estriada ("corncob" grooved pump forend)
 *        com anéis concêntricos usinados e braço de acionamento em aço.
 *   2. Receptor em Aço Forjado (Milled Steel Receiver):
 *      - Perfil arqueado contínuo característico do Model 12, sem ressaltos.
 *      - Janela de ejeção lateral direita com ferrolho usinado sincronizado.
 *      - Guarda-mato arredondado clássico com gatilho curvo.
 *   3. Depósito Tubular e Cano de 20 Polegadas:
 *      - Tubo do depósito em aço sob o cano com tampa frontal estriada.
 *      - Cano calibre 12 com escudo térmico perfurado (Perforated Heat Shield).
 *   4. Adaptador Frontal de Trincheira (Bayonet Lug & Front Swivel):
 *      - Braçadeira frontal militar com trilho para baioneta e anel de bandoleira.
 *      - Massa de mira em esfera de latão polido (Brass Bead).
 *   5. Física de Ação de Bomba (Pump-Action Physics):
 *      - Movimento mecânico real da telha deslizando para trás e para frente a cada tiro.
 *      - Abertura sincronizada do ferrolho e emissão do som metálico de "rack-back / rack-forward".
 * ============================================================================
 */

import * as THREE from 'three';
import { emit } from '../../core/EventBus.js';

// Materiais PBR Fiéis à Winchester Model 1912 Trench Gun
export const M_W12_WOOD = new THREE.MeshStandardMaterial({
  color: 0x7c411d,
  roughness: 0.38,
  metalness: 0.08
});

export const M_W12_WOOD_DARK = new THREE.MeshStandardMaterial({
  color: 0x562a10,
  roughness: 0.44,
  metalness: 0.06
});

export const M_W12_RECEIVER = new THREE.MeshStandardMaterial({
  color: 0x34383e,
  roughness: 0.32,
  metalness: 0.88
});

export const M_W12_STEEL = new THREE.MeshStandardMaterial({
  color: 0x3d4249,
  roughness: 0.28,
  metalness: 0.92
});

export const M_W12_STEEL_BRT = new THREE.MeshStandardMaterial({
  color: 0x7a818c,
  roughness: 0.20,
  metalness: 0.96
});

export const M_W12_STEEL_DARK = new THREE.MeshStandardMaterial({
  color: 0x222529,
  roughness: 0.42,
  metalness: 0.85
});

export const M_W12_BEAD = new THREE.MeshStandardMaterial({
  color: 0xdfb850,
  roughness: 0.18,
  metalness: 0.95
});

/* ============================================================
   FÍSICA DA AÇÃO DE BOMBA (PUMP-ACTION & BOLT CYCLE)
   ============================================================ */
export class M12Physics {
  constructor(pumpHandle, bolt, basePumpZ, baseBoltZ) {
    this.pumpHandle = pumpHandle;
    this.bolt = bolt;
    this.basePumpZ = basePumpZ;
    this.baseBoltZ = baseBoltZ;

    this.pumpTimer = 0;
    this.pumpDuration = 0.36; // Ciclo de pump ágil para coincidir com fireInterval de 0.4s
    this.isPumping = false;

    this.playedBack = false;
    this.playedForward = false;
    this.shake = 0;
  }

  onFire(ammo) {
    this.isPumping = true;
    this.pumpTimer = 0;
    this.playedBack = false;
    this.playedForward = false;
    this.shake = 0.25;
  }

  onReload() {
    // Durante reload, dá um leve curso no pump
  }

  update(dt, camera, ammo) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }

    if (!this.isPumping) return;

    this.pumpTimer += dt;
    const progress = Math.min(this.pumpTimer / this.pumpDuration, 1.0);

    let slideOffset = 0;
    const maxSlide = 0.055; // Deslocamento de 5.5cm do pump

    // Fase 1: Telha puxada para trás (0.0 até 0.48)
    if (progress < 0.48) {
      const t = progress / 0.48;
      // Curva suave de aceleração para trás
      slideOffset = Math.sin(t * Math.PI * 0.5) * maxSlide;

      if (progress >= 0.24 && !this.playedBack) {
        this.playedBack = true;
        emit('weapon:pump', { stage: 'back' });
      }
    } 
    // Fase 2: Telha empurrada para frente de volta à posição de tiro (0.48 até 1.0)
    else {
      const t = (progress - 0.48) / 0.52;
      slideOffset = (1.0 - Math.sin(t * Math.PI * 0.5)) * maxSlide;

      if (progress >= 0.72 && !this.playedForward) {
        this.playedForward = true;
        emit('weapon:pump', { stage: 'forward' });
      }
    }

    // Aplica deslocamento ao longo do eixo Z local (para trás é +Z)
    if (this.pumpHandle) {
      this.pumpHandle.position.z = this.basePumpZ + slideOffset;
    }

    if (this.bolt) {
      this.bolt.position.z = this.baseBoltZ + slideOffset * 0.9;
    }

    if (progress >= 1.0) {
      this.isPumping = false;
      if (this.pumpHandle) this.pumpHandle.position.z = this.basePumpZ;
      if (this.bolt) this.bolt.position.z = this.baseBoltZ;
    }
  }
}

export function buildWinchester1912() {
  const g = new THREE.Group();

  /* =========================================================
     1. CAIXA DA CULATRA (RECEIVER MODEL 12)
     ========================================================= */
  // Corpo do receptor em aço forjado
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.056, 0.18), M_W12_RECEIVER);
  receiver.position.set(0, 0.015, -0.01);

  // Parte superior arredondada e aerodinâmica clássica do Model 12
  const receiverTop = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.18, 16), M_W12_RECEIVER);
  receiverTop.rotation.x = Math.PI / 2;
  receiverTop.position.set(0, 0.036, -0.01);

  // Sulco de visada ao longo do topo do receptor (Sighting Groove)
  const sightGroove = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.16), M_W12_STEEL_DARK);
  sightGroove.position.set(0, 0.046, -0.01);

  // Janela de ejeção lateral direita (Right Ejection Port)
  const ejectPort = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.022, 0.065), M_W12_STEEL_DARK);
  ejectPort.position.set(0.018, 0.022, -0.015);

  // Ferrolho móvel interno usinado (Bolt)
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.020, 0.060), M_W12_STEEL_BRT);
  const baseBoltZ = -0.015;
  bolt.position.set(0.017, 0.022, baseBoltZ);

  // Colar de encaixe do cano / anel de desmontagem (Takedown Ring)
  const takedownRing = new THREE.Mesh(new THREE.BoxGeometry(0.040, 0.058, 0.018), M_W12_STEEL);
  takedownRing.position.set(0, 0.016, -0.105);

  // Guarda-mato arredondado em aço e gatilho curvo
  const tgLoop = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.046), M_W12_STEEL);
  tgLoop.position.set(0, -0.034, 0.030);

  const tgFront = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.022, 0.004), M_W12_STEEL);
  tgFront.rotation.x = -0.30;
  tgFront.position.set(0, -0.024, 0.010);

  const tgRear = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.020, 0.004), M_W12_STEEL);
  tgRear.rotation.x = 0.32;
  tgRear.position.set(0, -0.024, 0.052);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.018, 0.008), M_W12_STEEL_BRT);
  trigger.rotation.x = -0.35;
  trigger.position.set(0, -0.022, 0.030);

  /* =========================================================
     2. CORONHA DE NOGUEIRA AMERICANA (WALNUT BUTTSTOCK)
     ========================================================= */
  const stock = new THREE.Group();
  stock.position.set(0, 0, 0.08);

  // Encaixe da coronha no receptor (Stock Tang)
  const stockTang = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.052, 0.025), M_W12_STEEL);
  stockTang.position.set(0, 0.014, 0.012);
  stock.add(stockTang);

  // Empunhadura de punho semi-pistola (Semi-Pistol Grip Wrist)
  const stockWrist = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.060, 0.070), M_W12_WOOD);
  stockWrist.rotation.x = 0.28;
  stockWrist.position.set(0, -0.006, 0.048);
  stock.add(stockWrist);

  // Corpo principal da coronha em madeira nobre
  const stockBody = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.078, 0.16), M_W12_WOOD);
  stockBody.rotation.x = -0.08;
  stockBody.position.set(0, -0.005, 0.145);
  stock.add(stockBody);

  // Crista / Apoio de bochecha arredondado (Comb)
  const stockComb = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.020, 0.12), M_W12_WOOD_DARK);
  stockComb.rotation.x = -0.08;
  stockComb.position.set(0, 0.034, 0.135);
  stock.add(stockComb);

  // Expansão inferior traseira da soleira (Heel & Toe)
  const stockHeel = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.06), M_W12_WOOD);
  stockHeel.rotation.x = -0.05;
  stockHeel.position.set(0, -0.036, 0.190);
  stock.add(stockHeel);

  // Soleira de aço escuro (Buttplate)
  const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.105, 0.008), M_W12_STEEL_DARK);
  buttplate.rotation.x = -0.06;
  buttplate.position.set(0, -0.014, 0.225);
  stock.add(buttplate);

  // Parafusos da soleira
  const screwT = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M_W12_STEEL);
  screwT.rotation.x = Math.PI / 2;
  screwT.position.set(0, 0.024, 0.228);
  const screwB = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.004, 6), M_W12_STEEL);
  screwB.rotation.x = Math.PI / 2;
  screwB.position.set(0, -0.048, 0.228);
  stock.add(screwT, screwB);

  // Zarelho inferior traseiro de bandoleira (Sling Swivel)
  const rearSwivelBase = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.012), M_W12_STEEL);
  rearSwivelBase.position.set(0, -0.056, 0.170);
  const rearSwivelLoop = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0016, 6, 12), M_W12_STEEL);
  rearSwivelLoop.position.set(0, -0.064, 0.170);
  stock.add(rearSwivelBase, rearSwivelLoop);

  /* =========================================================
     3. TUBO DO DEPÓSITO E CANO CALIBRE 12 (MAGAZINE & BARREL)
     ========================================================= */
  // Tubo do depósito em aço sob o cano (Tubular Magazine)
  const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 16), M_W12_STEEL);
  magTube.rotation.x = Math.PI / 2;
  magTube.position.set(0, 0.005, -0.320);

  // Tampa serrilhada do tubo do depósito (Magazine End Cap)
  const magCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.016, 16), M_W12_STEEL_DARK);
  magCap.rotation.x = Math.PI / 2;
  magCap.position.set(0, 0.005, -0.535);

  // Cano principal em aço de 20" (Shotgun Barrel)
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.48, 18), M_W12_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.024, -0.340);

  /* =========================================================
     4. TELHA MÓVEL "CORNOCOB" (PUMP FOREND ANIMADO)
     ========================================================= */
  const pumpGroup = new THREE.Group();
  const basePumpZ = -0.240;
  pumpGroup.position.set(0, 0.005, basePumpZ);

  // Luva interna metálica de deslizamento (Forend Tube)
  const pumpTube = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.135, 14), M_W12_STEEL_DARK);
  pumpTube.rotation.x = Math.PI / 2;
  pumpGroup.add(pumpTube);

  // Corpo principal da telha de nogueira estriada
  const pumpWood = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.125, 20), M_W12_WOOD);
  pumpWood.rotation.x = Math.PI / 2;
  pumpGroup.add(pumpWood);

  // 14 anéis concêntricos usinados na madeira (Iconic Corncob Ribs)
  const numRibs = 14;
  const ribSpacing = 0.115 / (numRibs - 1);
  for (let i = 0; i < numRibs; i++) {
    const rz = -0.0575 + i * ribSpacing;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.0194, 0.0013, 6, 20), M_W12_WOOD_DARK);
    rib.position.set(0, 0, rz);
    pumpGroup.add(rib);
  }

  // Barra de manobra em aço polido (Action Slide Bar) ligando a telha ao ferrolho
  const actionBar = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.18), M_W12_STEEL_BRT);
  actionBar.position.set(-0.015, 0.010, 0.09);
  pumpGroup.add(actionBar);

  /* =========================================================
     5. ESCUDO TÉRMICO PERFURADO (PERFORATED HEAT SHIELD)
     ========================================================= */
  const heatShieldGroup = new THREE.Group();
  heatShieldGroup.position.set(0, 0.025, -0.425);

  const shieldLength = 0.22;
  // Capa protetora superior de aço perfurado curvada sobre o cano
  const shieldMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, shieldLength, 16, 1, true, -Math.PI * 0.75, Math.PI * 1.5), M_W12_RECEIVER);
  shieldMesh.rotation.x = Math.PI / 2;
  heatShieldGroup.add(shieldMesh);

  // Simulação das 4 fileiras de furos circulares de ventilação do Trench Gun
  const numHoles = 11;
  const holeSpacing = (shieldLength - 0.03) / (numHoles - 1);
  for (let row = -1; row <= 1; row++) {
    const angle = row * 0.55;
    for (let h = 0; h < numHoles; h++) {
      const hz = -shieldLength * 0.5 + 0.015 + h * holeSpacing;
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 8), M_W12_STEEL_DARK);
      hole.position.set(
        Math.sin(angle) * 0.0138,
        Math.cos(angle) * 0.0138,
        hz
      );
      hole.rotation.z = -angle;
      heatShieldGroup.add(hole);
    }
  }

  // Braçadeiras metálicas traseira e dianteira de retenção do escudo térmico
  const rearBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0142, 0.0142, 0.010, 16), M_W12_STEEL_DARK);
  rearBand.rotation.x = Math.PI / 2;
  rearBand.position.set(0, 0, shieldLength * 0.5 - 0.006);
  heatShieldGroup.add(rearBand);

  /* =========================================================
     6. ADAPTADOR FRONTAL DE TRINCHEIRA & MASSA DE MIRA
     ========================================================= */
  const muzzleAssembly = new THREE.Group();
  muzzleAssembly.position.set(0, 0.015, -0.555);

  // Bloco adaptador militar em aço fundido unindo o cano e o depósito
  const bayonetLugAdapter = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.046, 0.040), M_W12_RECEIVER);
  bayonetLugAdapter.position.set(0, 0, 0);
  muzzleAssembly.add(bayonetLugAdapter);

  // Trilho de fixação da baioneta M1917 sob o adaptador
  const bayonetLug = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.028), M_W12_STEEL);
  bayonetLug.position.set(0, -0.026, 0);
  muzzleAssembly.add(bayonetLug);

  // Zarelho frontal articulado de bandoleira
  const frontSwivelLoop = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0018, 6, 12), M_W12_STEEL);
  frontSwivelLoop.position.set(0, -0.038, 0.008);
  muzzleAssembly.add(frontSwivelLoop);

  // Boca do cano calibre 12 (12-gauge muzzle opening)
  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.025, 16), M_W12_STEEL_DARK);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.009, -0.022);
  muzzleAssembly.add(muzzleTip);

  const boreHole = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 0.010, 12), M_W12_STEEL_DARK);
  boreHole.rotation.x = Math.PI / 2;
  boreHole.position.set(0, 0.009, -0.033);
  muzzleAssembly.add(boreHole);

  // Massa de mira esférica em latão polido (Brass Bead Front Sight)
  // Alinhada exatamente em X=0, Y=0.038, Z=-0.565 para visada ADS precisa
  const beadSight = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 8, 8), M_W12_BEAD);
  beadSight.position.set(0, 0.023, -0.010);
  muzzleAssembly.add(beadSight);

  /* =========================================================
     7. MONTAGEM FINAL DO GRUPO
     ========================================================= */
  g.add(
    receiver, receiverTop, sightGroove, ejectPort, bolt, takedownRing,
    tgLoop, tgFront, tgRear, trigger,
    stock, magTube, magCap, barrel,
    pumpGroup, heatShieldGroup, muzzleAssembly
  );

  g.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const physics = new M12Physics(pumpGroup, bolt, basePumpZ, baseBoltZ);

  return {
    group: g,
    physics
  };
}
