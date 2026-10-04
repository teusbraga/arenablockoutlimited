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
    this.gun = pumpHandle.parent;
    this.bolt = bolt;
    this.basePumpZ = basePumpZ;
    this.baseBoltZ = baseBoltZ;

    this.state = 'IDLE'; 
    this.timer = 0;
    
    this.recoilY = 0; 
    this.recoilZ = 0; 
    this.maxSlide = 0.08; 

    this.playedClick = false;
    this.playedClack = false;
    this.ejectedCase = false;
    this.lastAmmo = -1;
  }

  onFire(ammo) {
    if (this.state === 'RELOAD_HOLD' || this.state === 'RELOAD_BACK' || this.state === 'RELOAD_FWD') return;
    
    this.state = 'RECOIL';
    this.timer = 0;
    
    // Muzzle flip: Sobe rápido e desce devagar
    this.recoilZ = 1.0; 
    this.recoilY = 1.0;

    this.playedClick = false;
    this.playedClack = false;
    this.ejectedCase = false;
  }

  onReload() {
    this.state = 'RELOAD_BACK';
    this.timer = 0;
    this.playedClick = false;
    this.playedClack = false;
  }

  update(dt, camera, ammo) {
    // FÍSICA DE RECUO INDEPENDENTE DA TELHA (SEMPRE APLICADA)
    if (this.recoilZ > 0) this.recoilZ = Math.max(0, this.recoilZ - dt * 8.0); // Z kick recover fast
    if (this.recoilY > 0) this.recoilY = Math.max(0, this.recoilY - dt * 4.0); // Y flip recover slow
    
    if (this.gun) {
      this.gun.position.z = this.recoilZ * 0.035; 
      this.gun.rotation.x = this.recoilY * 0.15;  
    }

    let slideOffset = 0;

    // DETECÇÃO DE TÉRMINO DO RELOAD: A munição aumentou (ou encheu) e a telha estava travada atrás
    if (this.lastAmmo !== -1 && ammo > this.lastAmmo && this.state === 'RELOAD_HOLD') {
      this.state = 'RELOAD_FWD';
      this.timer = 0;
    }
    // Proteção: caso o reload seja cancelado de outra forma
    if (this.state === 'RELOAD_HOLD' && ammo === this.lastAmmo) {
      // continua no hold aguardando
    }
    this.lastAmmo = ammo;

    // MÁQUINA DE ESTADOS RESTRITA
    switch (this.state) {
      case 'IDLE':
        slideOffset = 0;
        break;

      case 'RECOIL':
        slideOffset = 0;
        // EXCLUSIVAMENTE APÓS O RECUO RESETAR (ex: y < 0.05) COMEÇA A TELHA
        if (this.recoilY <= 0.05) { 
          this.state = 'PUMP_BACK';
          this.timer = 0;
        }
        break;

      case 'PUMP_BACK':
        this.timer += dt;
        const tBack = Math.min(this.timer / 0.10, 1.0); // Exatos 100ms
        
        slideOffset = this.easeInOutSine(tBack) * this.maxSlide;

        if (tBack >= 1.0) {
          this.state = 'PUMP_PAUSE';
          this.timer = 0;
        }
        break;

      case 'PUMP_PAUSE':
        slideOffset = this.maxSlide;
        
        // Exclusivamente quando chega aqui e para: click + eject case
        if (!this.playedClick) {
          emit('weapon:pump', { stage: 'back' });
          this.playedClick = true;
        }
        if (!this.ejectedCase) {
          // Calcula vetores e posições no mundo baseados na câmera e na arma
          if (camera) {
            const right = new THREE.Vector3();
            const up = new THREE.Vector3();
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            right.crossVectors(forward, camera.up).normalize();
            up.crossVectors(right, forward).normalize();
            
            const ejectLocal = new THREE.Vector3(0.022, 0.022, -0.01);
            const ejectWorld = this.gun.localToWorld(ejectLocal);
            
            emit('weapon:manual_eject_fx', { 
              ejectWorld, right, up, forward, isShotgun: true 
            });
          }
          this.ejectedCase = true;
        }

        this.timer += dt;
        // Pausa de 100ms para cérebro processar a ejeção antes de avançar
        if (this.timer >= 0.10) {
          this.state = 'PUMP_FWD';
          this.timer = 0;
        }
        break;

      case 'PUMP_FWD':
        this.timer += dt;
        const tFwd = Math.min(this.timer / 0.15, 1.0); // Exatos 150ms
        
        slideOffset = (1.0 - this.easeInOutSine(tFwd)) * this.maxSlide;

        if (tFwd >= 1.0) {
          if (!this.playedClack) {
            emit('weapon:pump', { stage: 'forward' });
            this.playedClack = true;
          }
          this.state = 'IDLE';
        }
        break;

      case 'RELOAD_BACK':
        this.timer += dt;
        const tRBack = Math.min(this.timer / 0.10, 1.0); // 100ms pra abrir no reload
        slideOffset = this.easeInOutSine(tRBack) * this.maxSlide;
        
        if (tRBack >= 1.0) {
          if (!this.playedClick) {
            emit('weapon:pump', { stage: 'back' });
            this.playedClick = true;
          }
          this.state = 'RELOAD_HOLD';
        }
        break;

      case 'RELOAD_HOLD':
        // Fica travada atrás durante toda a animação de colocar as balas no tubo
        slideOffset = this.maxSlide;
        break;
        
      case 'RELOAD_FWD':
        this.timer += dt;
        // Tempo de volta (100ms com clack no final)
        const tRFwd = Math.min(this.timer / 0.10, 1.0);
        slideOffset = (1.0 - this.easeInOutSine(tRFwd)) * this.maxSlide;
        
        if (tRFwd >= 1.0) {
          if (!this.playedClack) {
            emit('weapon:pump', { stage: 'forward' });
            this.playedClack = true;
          }
          this.state = 'IDLE';
        }
        break;
    }

    // APLICA O OFFSET VISUAL À TELHA E AO FERROLHO
    if (this.pumpHandle) {
      this.pumpHandle.position.z = this.basePumpZ + slideOffset;
    }
    if (this.bolt) {
      this.bolt.position.z = this.baseBoltZ + slideOffset * 0.95;
    }
  }

  easeInOutSine(x) {
    return -(Math.cos(Math.PI * x) - 1) / 2;
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

  // Esfera para suavizar a quebra do cilindro traseiro
  const receiverSphere = new THREE.Mesh(new THREE.SphereGeometry(0.019, 16, 16), M_W12_RECEIVER);
  receiverSphere.position.set(0, 0.036, 0.08);
  g.add(receiverSphere);

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

  // Cano principal em aço super grosso conectado direto na culatra
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.48, 18), M_W12_STEEL);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.024, -0.340);

  /* =========================================================
     4. TELHA MÓVEL "CORNOCOB" (PUMP FOREND ANIMADO)
     ========================================================= */
  const pumpGroup = new THREE.Group();
  const basePumpZ = -0.240;
  pumpGroup.position.set(0, 0.005, basePumpZ);

  // Luva interna metálica de deslizamento (Forend Tube)
  const pumpTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.155, 14), M_W12_STEEL_DARK);
  pumpTube.rotation.x = Math.PI / 2;
  pumpGroup.add(pumpTube);

  // Corpo principal da telha de nogueira estriada (ESCALA AUMENTADA)
  const pumpWood = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.145, 20), M_W12_WOOD);
  pumpWood.rotation.x = Math.PI / 2;
  pumpGroup.add(pumpWood);

  // Anéis concêntricos usinados na madeira (mais grossos)
  const numRibs = 12; // Menos anéis, mais espaçados
  const ribSpacing = 0.125 / (numRibs - 1);
  for (let i = 0; i < numRibs; i++) {
    const rz = -0.0625 + i * ribSpacing;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.002, 6, 20), M_W12_WOOD_DARK);
    rib.position.set(0, 0, rz);
    pumpGroup.add(rib);
  }

  // Barra de manobra em aço polido (Action Slide Bar) ligando a telha ao ferrolho
  const actionBar = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.18), M_W12_STEEL_BRT);
  actionBar.position.set(-0.016, 0.010, 0.09);
  pumpGroup.add(actionBar);

  /* =========================================================
     5. ANÉIS DE RETENÇÃO (TORUS) E MASSA DE MIRA
     ========================================================= */
  const frontRingsGroup = new THREE.Group();
  
  // Anéis toroidais no cano simulando braçadeiras de retenção (escala aumentada)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.003, 8, 20), M_W12_STEEL_DARK);
  ring1.position.set(0, 0.024, -0.480);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.003, 8, 20), M_W12_STEEL_DARK);
  ring2.position.set(0, 0.024, -0.520);
  frontRingsGroup.add(ring1, ring2);

  // Massa de mira proeminente ajustada para a nova altura do cano (Elevada para evitar clipping no ADS)
  const frontSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.010), M_W12_STEEL_DARK);
  frontSightBase.position.set(0, 0.055, -0.560);
  const frontBead = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 8), M_W12_BEAD);
  frontBead.position.set(0, 0.063, -0.560);
  frontRingsGroup.add(frontSightBase, frontBead);

  /* =========================================================
     6. ADAPTADOR FRONTAL DE TRINCHEIRA
     ========================================================= */
  const muzzleAssembly = new THREE.Group();
  muzzleAssembly.position.set(0, 0.015, -0.555);

  // Bloco adaptador militar escalado para abraçar o cano grosso
  const bayonetLugAdapter = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.060, 0.040), M_W12_RECEIVER);
  bayonetLugAdapter.position.set(0, 0.005, 0);
  muzzleAssembly.add(bayonetLugAdapter);

  // Trilho de fixação da baioneta M1917 sob o adaptador
  const bayonetLug = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.028), M_W12_STEEL);
  bayonetLug.position.set(0, -0.026, 0);
  muzzleAssembly.add(bayonetLug);

  // Zarelho frontal articulado de bandoleira
  const frontSwivelLoop = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.0018, 6, 12), M_W12_STEEL);
  frontSwivelLoop.position.set(0, -0.038, 0.008);
  muzzleAssembly.add(frontSwivelLoop);

  // Boca do cano calibre 12 ajustada para o super bull barrel
  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.025, 16), M_W12_STEEL_DARK);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.009, -0.022);
  muzzleAssembly.add(muzzleTip);

  const boreHole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.010, 12), M_W12_STEEL_DARK);
  boreHole.rotation.x = Math.PI / 2;
  boreHole.position.set(0, 0.009, -0.033);
  muzzleAssembly.add(boreHole);

  /* =========================================================
     7. MONTAGEM FINAL DO GRUPO
     ========================================================= */
  g.add(
    receiver, receiverTop, sightGroove, ejectPort, bolt, takedownRing,
    tgLoop, tgFront, tgRear, trigger,
    stock, magTube, magCap, barrel,
    pumpGroup, frontRingsGroup, muzzleAssembly
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
