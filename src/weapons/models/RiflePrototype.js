/**
 * ============================================================================
 *   RIFLE PROTOTYPE — TACTICOOL FACELIFT v2.0
 * ============================================================================
 * Facelift completo com design moderno militar tático ("sexy & tacticool"):
 *   - Óptica Micro Reflex / Red Dot tática montada em trilho Picatinny elevado
 *     com lente antirreflexo translúcida e retículo Red Dot neon iluminado
 *     alinhado 100% no centro da tela em ADS.
 *   - Miras de backup dobráveis (BUIS - Backup Iron Sights) co-witness.
 *   - Guarda-mão ventilado estilo M-LOK com trilhos Picatinny e Angled Foregrip (AFG).
 *   - Módulo tático PEQ-15 de perfil baixo montado no trilho superior.
 *   - Quebra-chamas tático agressivo compensador (estilo SureFire WarComp).
 *   - Carregador estilo P-MAG com nervuras antiderrapantes e janela com munições em latão.
 *   - Coronha tática moderna estilo Magpul CTR / Crane Stock com soleira de borracha.
 *   - Punho ergonômico com beavertail e guarda-mato tático ampliado.
 *   - Alavanca de manejo ambidestra alargada (Radian Raptor style) e defletor de estojos.
 *   - FÍSICA E ANIMAÇÕES EXATAS DO PROTÓTIPO 100% PRESERVADAS:
 *     recoil elástico, blowback com sin(PI*cycle), câmara vazia, muzzle flash e shake!
 * ============================================================================
 */

import * as THREE from 'three';

/* ============================================================
   1. TEXTURAS PROCEDURAIS
   ============================================================ */

export function makeGlowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,244,190,0.95)');
  g.addColorStop(0.42, 'rgba(255,172,60,0.48)');
  g.addColorStop(0.72, 'rgba(255,96,12,0.13)');
  g.addColorStop(1.00, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSmokeTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(225,228,234,0.60)');
  g.addColorStop(0.5, 'rgba(180,184,194,0.22)');
  g.addColorStop(1.0, 'rgba(150,154,164,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const GLOW_TEX = makeGlowTexture();
export const SMOKE_TEX = makeSmokeTexture();

/* ============================================================
   2. MATERIAIS TÁTICOS PBR
   ============================================================ */

const M = {
  // Metais militares anodizados foscos e cromados
  steel:       new THREE.MeshStandardMaterial({ color: 0x868e96, metalness: 0.94, roughness: 0.32 }),
  darkSteel:   new THREE.MeshStandardMaterial({ color: 0x6e757d, metalness: 0.90, roughness: 0.40 }),
  receiver:    new THREE.MeshStandardMaterial({ color: 0x5d646b, metalness: 0.88, roughness: 0.38 }),
  black:       new THREE.MeshStandardMaterial({ color: 0x2b3035, metalness: 0.40, roughness: 0.75 }),
  polymer:     new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.18, roughness: 0.82 }),
  fdePolymer:  new THREE.MeshStandardMaterial({ color: 0x40464d, metalness: 0.22, roughness: 0.78 }),
  accent:      new THREE.MeshStandardMaterial({ color: 0xa87438, metalness: 0.85, roughness: 0.35 }),
  brass:       new THREE.MeshStandardMaterial({ color: 0xdfb850, metalness: 0.96, roughness: 0.22 }),
  sightBody:   new THREE.MeshStandardMaterial({ color: 0x545b64, metalness: 0.92, roughness: 0.30 }),

  // Lente óptica antirreflexo (vidro azulado translúcido)
  opticGlass:  new THREE.MeshPhysicalMaterial({
    color: 0x44aacc,
    metalness: 0.1,
    roughness: 0.05,
    transmission: 0.85,
    transparent: true,
    opacity: 0.55,
    depthWrite: false
  }),

  // Retículo Red Dot iluminado neon (visibilidade perfeita em qualquer ambiente)
  redDot:      new THREE.MeshBasicMaterial({ color: 0xff1e2d }),
  greenDot:    new THREE.MeshBasicMaterial({ color: 0x33ff66 }),
  indicatorW:  new THREE.MeshBasicMaterial({ color: 0xcccccc }),
  indicatorR:  new THREE.MeshBasicMaterial({ color: 0xdd2222 })
};

function mesh(geo, material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material.clone ? material.clone() : material);
  m.position.set(px, py, pz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ============================================================
   3. FÍSICA E ANIMAÇÕES EXATAS DO PROTÓTIPO
   ============================================================ */

export class PrototypePhysics {
  constructor(rifle, bolt, flashObj) {
    this.rifle = rifle;
    this.bolt = bolt;
    this.flashObj = flashObj;

    // Estado original de recuo e tremor
    this.recoil = 0;
    this.shake = 0;
    this.boltCycle = 1;
    this.boltOpen = false;
    this.boltOpenAmt = 0;
    this.flashTimer = 0;
  }

  onFire(ammo = 30) {
    // 1. Ciclo de blowback
    this.boltCycle = 0;

    // 2. Impulso de recuo (valores exatos do protótipo)
    this.recoil = Math.min(this.recoil + 0.42, 1.15);
    this.shake = Math.min(this.shake + 0.85, 1.6);

    // 3. Muzzle flash
    this.flashTimer = 0.055;
    const { muzzleFlash, muzzleFlash2, muzzleLight } = this.flashObj;
    muzzleFlash.visible = true;
    muzzleFlash2.visible = true;
    const sc = 0.75 + Math.random() * 0.7;
    muzzleFlash.scale.setScalar(sc);
    muzzleFlash2.scale.setScalar(sc * 0.85);
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleFlash2.rotation.z = Math.random() * Math.PI * 2;
    muzzleLight.intensity = 16;
  }

  onReload() {
    this.boltOpen = false;
  }

  update(dt, camera, ammo = 30) {
    /* ---- blowback do ferrolho ---- */
    if (this.boltCycle < 1) {
      this.boltCycle = Math.min(1, this.boltCycle + dt / 0.085);
    }
    // Retém do ferrolho trava aberto quando sem munição
    if (this.boltCycle >= 1 && ammo <= 0 && !this.boltOpen) {
      this.boltOpen = true;
    }
    const targetOpen = this.boltOpen ? 1 : 0;
    this.boltOpenAmt += (targetOpen - this.boltOpenAmt) * (1 - Math.exp(-dt * 13));

    const cycleOff = this.boltCycle < 1
      ? -0.085 * Math.sin(Math.PI * this.boltCycle)
      : 0;
    const openOff = -0.085 * this.boltOpenAmt;
    const boltOffset = cycleOff + openOff;

    this.bolt.position.x = boltOffset;

    /* ---- recoil elástico com as fórmulas originais ---- */
    const recoilDecay = 1 - Math.exp(-dt * 6.5);
    this.recoil += (0 - this.recoil) * recoilDecay;
    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 9));

    const r = this.recoil;
    this.rifle.position.x = -r * 0.055;
    this.rifle.position.y = r * 0.010;
    this.rifle.rotation.z = r * 0.105;
    this.rifle.rotation.y = r * 0.012;

    /* ---- muzzle flash ---- */
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(this.flashTimer / 0.055, 0);
      this.flashObj.flashMat.opacity = k * 0.95;
      this.flashObj.muzzleLight.intensity = 16 * k;
      if (this.flashTimer <= 0) {
        this.flashObj.muzzleFlash.visible = false;
        this.flashObj.muzzleFlash2.visible = false;
        this.flashObj.muzzleLight.intensity = 0;
        this.flashObj.flashMat.opacity = 0;
      } else if (camera) {
        this.flashObj.muzzleFlash.lookAt(camera.position);
        this.flashObj.muzzleFlash2.lookAt(camera.position);
      }
    }
  }
}

/* ============================================================
   4. CONSTRUÇÃO TÁTICA DO RIFLE ("SEXY & TACTICOOL")
   ============================================================ */

export function buildRiflePrototype() {
  const root = new THREE.Group();

  // pivot alinha o rifle com a direção de visão em primeira pessoa (+X cano -> -Z câmera)
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2;
  root.add(pivot);

  // rifle: grupo onde atua o recuo e movimentação do protótipo
  const rifle = new THREE.Group();
  pivot.add(rifle);

  /* ---------- 4.1 UPPER & LOWER RECEIVER TÁTICO ---------- */
  const receiver = new THREE.Group();

  // Upper Receiver reforçado
  receiver.add(mesh(new THREE.BoxGeometry(0.36, 0.054, 0.084), M.receiver, 0, 0.018, 0));
  // Lower Receiver com perfil militar
  receiver.add(mesh(new THREE.BoxGeometry(0.24, 0.046, 0.080), M.receiver, -0.04, -0.026, 0));

  // Magwell alargado tático (Flared Magwell com ranhuras de reforço)
  receiver.add(mesh(new THREE.BoxGeometry(0.088, 0.065, 0.086), M.receiver, 0.075, -0.038, 0));
  receiver.add(mesh(new THREE.BoxGeometry(0.096, 0.010, 0.092), M.darkSteel, 0.075, -0.070, 0));

  // Trilho Picatinny Superior Contínuo (Receiver Top Rail com dentes individuais)
  receiver.add(mesh(new THREE.BoxGeometry(0.36, 0.012, 0.048), M.darkSteel, 0, 0.051, 0));
  for (let i = 0; i < 14; i++) {
    const rx = -0.16 + i * 0.025;
    receiver.add(mesh(new THREE.BoxGeometry(0.010, 0.005, 0.050), M.black, rx, 0.058, 0));
  }

  // Janela de Ejeção com Tampa Anti-Poeira (Dust Cover aberta)
  receiver.add(mesh(new THREE.BoxGeometry(0.125, 0.036, 0.008), M.black, 0.035, 0.018, 0.045));
  receiver.add(mesh(new THREE.BoxGeometry(0.120, 0.008, 0.014), M.darkSteel, 0.035, -0.004, 0.047, 0.35, 0, 0));

  // Defletor de Cápsulas (Brass Deflector chanfrado)
  receiver.add(mesh(new THREE.BoxGeometry(0.028, 0.032, 0.024), M.darkSteel, -0.045, 0.018, 0.048, 0, 0.45, 0));

  // Assistência de Avanço (Forward Assist cilíndrico)
  receiver.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.035, 10), M.darkSteel, -0.075, 0.025, 0.046, 0, 0, -0.55));
  receiver.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 10), M.black, -0.088, 0.033, 0.046, 0, 0, -0.55));

  // Alavanca de Manejo Tática Ambidestra (Radian Raptor style Charging Handle)
  const chargeHandle = new THREE.Group();
  chargeHandle.position.set(-0.190, 0.050, 0);
  chargeHandle.add(mesh(new THREE.BoxGeometry(0.035, 0.014, 0.088), M.darkSteel, 0, 0, 0));
  chargeHandle.add(mesh(new THREE.BoxGeometry(0.014, 0.018, 0.032), M.accent, 0.005, 0.002, -0.048));
  chargeHandle.add(mesh(new THREE.BoxGeometry(0.014, 0.018, 0.032), M.accent, 0.005, 0.002, 0.048));
  receiver.add(chargeHandle);

  // Retém do Ferrolho (Bolt Catch à esquerda)
  receiver.add(mesh(new THREE.BoxGeometry(0.006, 0.024, 0.016), M.steel, 0.020, 0.010, -0.044));

  // Seletor de Disparo Ambidestro com Indicadores
  receiver.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.088, 10), M.darkSteel, -0.055, -0.020, 0, Math.PI / 2, 0, 0));
  receiver.add(mesh(new THREE.BoxGeometry(0.024, 0.006, 0.006), M.accent, -0.050, -0.018, 0.045, 0, 0, -0.3));
  receiver.add(mesh(new THREE.BoxGeometry(0.004, 0.003, 0.002), M.indicatorW, -0.065, -0.010, 0.043));
  receiver.add(mesh(new THREE.BoxGeometry(0.004, 0.003, 0.002), M.indicatorR, -0.045, -0.010, 0.043));

  // Pinos de Desmontagem Tática (Takedown Pins)
  receiver.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.086, 10), M.steel, 0.125, -0.025, 0, Math.PI / 2, 0, 0));
  receiver.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.086, 10), M.steel, -0.150, -0.022, 0, Math.PI / 2, 0, 0));

  rifle.add(receiver);

  /* ---------- 4.2 ÓPTICA MICRO REFLEX TÁTICA & RED DOT (SIGHTS PRECISAS) ---------- */
  // Ponto óptico central exato: X = 0.060, Y = 0.108, Z = 0
  const optic = new THREE.Group();
  optic.position.set(0.060, 0.062, 0);

  // 1. Montagem elevada vazada (High-Rise Skeletonized Mount estilo Unity Tactical)
  optic.add(mesh(new THREE.BoxGeometry(0.095, 0.016, 0.056), M.darkSteel, 0, 0.008, 0));
  optic.add(mesh(new THREE.BoxGeometry(0.018, 0.024, 0.042), M.darkSteel, -0.030, 0.022, 0));
  optic.add(mesh(new THREE.BoxGeometry(0.018, 0.024, 0.042), M.darkSteel, 0.030, 0.022, 0));
  // Parafusos de fixação no trilho
  optic.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.064, 10), M.steel, -0.020, 0.008, 0, Math.PI / 2, 0, 0));
  optic.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.064, 10), M.steel, 0.020, 0.008, 0, Math.PI / 2, 0, 0));

  // 2. Corpo do Red Dot (Carcaça cilíndrica usinada em alumínio aeronáutico T6)
  const opticBody = new THREE.Group();
  opticBody.position.set(0, 0.046, 0); // Y central = 0.062 + 0.046 = 0.108

  // Tubo principal e anéis de proteção solar (Sunshade)
  opticBody.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.088, 20), M.sightBody, 0, 0, 0, 0, 0, Math.PI / 2));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.016, 20), M.darkSteel, 0.042, 0, 0, 0, 0, Math.PI / 2));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 20), M.darkSteel, -0.040, 0, 0, 0, 0, Math.PI / 2));

  // Torres de ajuste de Elevação e Deriva (Windage & Elevation Turrets com tampas)
  opticBody.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 12), M.darkSteel, 0.005, 0.030, 0));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 12), M.darkSteel, 0.005, 0, 0.030, Math.PI / 2, 0, 0));
  // Compartimento de bateria circular (Coin Battery Cap à direita)
  opticBody.add(mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.010, 14), M.accent, 0.005, 0, -0.030, Math.PI / 2, 0, 0));

  // 3. Lentes Ópticas Dianteira e Traseira
  const frontLens = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.002, 18), M.opticGlass, 0.036, 0, 0, 0, 0, Math.PI / 2);
  const rearLensMat = M.opticGlass.clone();
  const rearLens  = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.002, 18), rearLensMat, -0.036, 0, 0, 0, 0, Math.PI / 2);
  opticBody.add(frontLens, rearLens);

  // 4. RETÍCULO RED DOT ILUMINADO NEON (Alinhamento 100% no centro da visada ADS)
  // Ponto central em X=0, Y=0, Z=0 do opticBody (Y mundial = 0.108)
  const redDotMesh = mesh(new THREE.SphereGeometry(0.0016, 12, 12), M.redDot, 0, 0, 0);
  const redDotHalo = mesh(new THREE.RingGeometry(0.0035, 0.0045, 18), M.redDot, -0.001, 0, 0, 0, Math.PI / 2, 0);
  opticBody.add(redDotMesh, redDotHalo);

  optic.add(opticBody);
  rifle.add(optic);

  // Miras de Backup Dobráveis (BUIS - Folding Sights rebatidas de perfil baixo)
  // Alça traseira dobrada
  receiver.add(mesh(new THREE.BoxGeometry(0.032, 0.015, 0.034), M.darkSteel, -0.155, 0.063, 0));
  receiver.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.038, 10), M.steel, -0.155, 0.063, 0, Math.PI / 2, 0, 0));

  /* ---------- 4.3 GUARDA-MÃO TÁTICO M-LOK & TRILHOS ---------- */
  const handguard = new THREE.Group();

  // Corpo octogonal do guarda-mão flutuante (Free-Float Handguard)
  handguard.add(mesh(new THREE.BoxGeometry(0.34, 0.076, 0.078), M.receiver, 0.35, 0.006, 0));
  // Trilho Picatinny superior contínuo
  handguard.add(mesh(new THREE.BoxGeometry(0.34, 0.012, 0.046), M.darkSteel, 0.35, 0.050, 0));
  for (let i = 0; i < 12; i++) {
    const hx = 0.20 + i * 0.026;
    handguard.add(mesh(new THREE.BoxGeometry(0.010, 0.004, 0.048), M.black, hx, 0.056, 0));
  }

  // Trilho inferior
  handguard.add(mesh(new THREE.BoxGeometry(0.32, 0.010, 0.032), M.darkSteel, 0.35, -0.036, 0));
  // Janelas de arrefecimento e ranhuras M-LOK laterais usinadas
  for (let i = 0; i < 5; i++) {
    const sx = 0.22 + i * 0.055;
    handguard.add(mesh(new THREE.BoxGeometry(0.034, 0.022, 0.081), M.black, sx, 0.014, 0));
    handguard.add(mesh(new THREE.BoxGeometry(0.034, 0.016, 0.081), M.black, sx, -0.014, 0));
  }

  // Tampa frontal protetora usinada
  handguard.add(mesh(new THREE.BoxGeometry(0.014, 0.082, 0.084), M.darkSteel, 0.522, 0.006, 0));

  // EMPUNHADURA ANGULAR TÁTICA (Angled Foregrip - AFG estilo Magpul)
  const afg = new THREE.Group();
  afg.position.set(0.33, -0.041, 0);
  afg.add(mesh(new THREE.BoxGeometry(0.14, 0.012, 0.038), M.polymer, 0, -0.006, 0));
  // Rampa ergonômica inclinada para apoio da mão de suporte
  afg.add(mesh(new THREE.BoxGeometry(0.09, 0.045, 0.034), M.fdePolymer, 0.01, -0.028, 0, 0, 0, -0.42));
  afg.add(mesh(new THREE.BoxGeometry(0.035, 0.048, 0.036), M.polymer, -0.045, -0.024, 0, 0, 0, 0.35));
  handguard.add(afg);

  // MÓDULO TÁTICO PEQ-15 (Caixa laser/infravermelho no trilho superior dianteiro)
  const peq15 = new THREE.Group();
  peq15.position.set(0.44, 0.068, 0.028);
  peq15.add(mesh(new THREE.BoxGeometry(0.075, 0.024, 0.050), M.fdePolymer, 0, 0, 0));
  peq15.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 10), M.black, 0.040, -0.002, 0.012, 0, 0, Math.PI / 2));
  peq15.add(mesh(new THREE.SphereGeometry(0.003, 10, 10), M.greenDot, 0.048, -0.002, 0.012));
  peq15.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.008, 10), M.black, -0.015, 0.014, -0.008));
  handguard.add(peq15);

  rifle.add(handguard);

  /* ---------- 4.4 CANO DE PRECISÃO, BLOCO DE GÁS & COMPENSADOR ---------- */
  const barrel = new THREE.Group();

  // Cano flutuante usinado em aço forjado com ranhuras longitudinais de arrefecimento
  barrel.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.54, 18), M.steel, 0.45, 0.012, 0, 0, 0, Math.PI / 2));
  // Bloco de gás tático de perfil baixo (Low-Profile Gas Block)
  barrel.add(mesh(new THREE.BoxGeometry(0.042, 0.046, 0.036), M.darkSteel, 0.56, 0.016, 0));
  // Tubo de gás em inox
  barrel.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.36, 8), M.steel, 0.36, 0.034, 0, 0, 0, Math.PI / 2));

  // COMPENSADOR TÁTICO AGRESSIVO (Muzzle Brake estilo SureFire WarComp)
  const muzzleComp = new THREE.Group();
  muzzleComp.position.set(0.725, 0.012, 0);
  muzzleComp.add(mesh(new THREE.CylinderGeometry(0.020, 0.022, 0.072, 16), M.darkSteel, 0, 0, 0, 0, 0, Math.PI / 2));
  // Portas de alívio e compensação de recuo verticais e laterais
  muzzleComp.add(mesh(new THREE.BoxGeometry(0.018, 0.026, 0.016), M.black, 0.010, 0, 0));
  muzzleComp.add(mesh(new THREE.BoxGeometry(0.018, 0.016, 0.026), M.black, 0.010, 0, 0));
  // Dentes quebra-chamas pontiagudos na boca
  muzzleComp.add(mesh(new THREE.CylinderGeometry(0.017, 0.020, 0.012, 16), M.steel, 0.040, 0, 0, 0, 0, Math.PI / 2));
  barrel.add(muzzleComp);

  rifle.add(barrel);

  /* ---------- 4.5 CORONHA TELESCÓPICA (CRANE / CTR STOCK) ---------- */
  const stock = new THREE.Group();

  // Tubo amortecedor de recuo Mil-Spec (Buffer Tube cilíndrico)
  stock.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 16), M.steel, -0.27, 0.008, 0, 0, 0, Math.PI / 2));
  // Porca Castelo (Castle Nut com ranhuras de fixação)
  stock.add(mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.014, 16), M.darkSteel, -0.165, 0.008, 0, 0, 0, Math.PI / 2));

  // Corpo ergonômico da coronha retrátil com apoio de bochecha arredondado
  stock.add(mesh(new THREE.BoxGeometry(0.24, 0.092, 0.068), M.polymer, -0.38, 0.002, 0));
  stock.add(mesh(new THREE.BoxGeometry(0.18, 0.026, 0.076), M.fdePolymer, -0.39, 0.052, 0));
  // Trava de ajuste da coronha (Adjustment Release Lever)
  stock.add(mesh(new THREE.BoxGeometry(0.09, 0.018, 0.028), M.darkSteel, -0.37, -0.052, 0));

  // Soleira de borracha convexa antiderrapante (Ribbed Rubber Buttpad)
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.138, 0.078), M.black, -0.505, -0.010, 0));
  for (let i = 0; i < 6; i++) {
    const py = -0.065 + i * 0.022;
    stock.add(mesh(new THREE.BoxGeometry(0.006, 0.008, 0.072), M.darkSteel, -0.520, py, 0));
  }
  // Soquete de bandoleira QD (Quick Detach Sling Swivel)
  stock.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.074, 12), M.steel, -0.44, 0.010, 0, Math.PI / 2, 0, 0));

  rifle.add(stock);

  /* ---------- 4.6 PUNHO ERGONÔMICO (BATTLE GRIP) & GATILHO ---------- */
  const triggerGroup = new THREE.Group();

  // Punho ergonômico com beavertail traseiro e ressalto para dedo indicador
  const grip = mesh(new THREE.BoxGeometry(0.052, 0.145, 0.058), M.polymer, -0.060, -0.110, 0, 0, 0, -0.22);
  triggerGroup.add(grip);
  // Relevos antiderrapantes horizontais no punho
  for (let i = 0; i < 4; i++) {
    const gy = -0.075 - i * 0.022;
    const gx = -0.050 - i * 0.005;
    triggerGroup.add(mesh(new THREE.BoxGeometry(0.054, 0.006, 0.060), M.black, gx, gy, 0, 0, 0, -0.22));
  }
  // Tampa da base do punho
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.054, 0.014, 0.060), M.darkSteel, -0.082, -0.180, 0, 0, 0, -0.22));

  // Guarda-mato tático ampliado para uso com luvas de combate
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.095, 0.008, 0.026), M.darkSteel, -0.022, -0.084, 0));
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.008, 0.048, 0.026), M.darkSteel, 0.025, -0.062, 0));

  // Gatilho Esportivo Plano Dourado (Flat-Faced Match Trigger)
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.010, 0.042, 0.016), M.accent, -0.016, -0.060, 0, 0, 0, 0.08));

  rifle.add(triggerGroup);

  /* ---------- 4.7 CARREGADOR TÁTICO ESTILO P-MAG COM JANELA ---------- */
  const magazine = new THREE.Group();
  magazine.position.set(0.075, -0.045, 0);
  magazine.rotation.z = 0.09;

  // Corpo curvo de polímero de alta densidade
  magazine.add(mesh(new THREE.BoxGeometry(0.060, 0.205, 0.074), M.polymer, 0, -0.100, 0));
  // Nervuras antiderrapantes horizontais estilo Magpul P-MAG
  for (let i = 0; i < 5; i++) {
    const my = -0.035 - i * 0.032;
    magazine.add(mesh(new THREE.BoxGeometry(0.064, 0.008, 0.078), M.black, 0, my, 0));
  }
  // Baseplate ampliado de polímero com orifício de drenagem
  magazine.add(mesh(new THREE.BoxGeometry(0.068, 0.018, 0.084), M.darkSteel, -0.002, -0.206, 0));

  // Janela transparente de inspeção de munição com cartuchos 5.56mm dourados visíveis
  magazine.add(mesh(new THREE.BoxGeometry(0.020, 0.085, 0.076), M.black, 0, -0.095, 0));
  magazine.add(mesh(new THREE.BoxGeometry(0.014, 0.075, 0.078), M.brass, 0, -0.095, 0));

  // Munição superior na boca do carregador
  magazine.add(mesh(new THREE.BoxGeometry(0.015, 0.022, 0.055), M.brass, 0, 0.010, 0));

  rifle.add(magazine);

  /* ---------- 4.8 FERROLHO USINADO E ANIMAÇÃO DE BLOWBACK ---------- */
  // O grupo bolt é animado ao longo do eixo X (0 até -0.085)
  const bolt = new THREE.Group();
  bolt.position.set(0, 0.073, 0);

  // Corpo cilíndrico do transportador do ferrolho (Bolt Carrier em cromo/nitreto)
  // Encurtado de 0.20 para 0.14 para não atravessar a câmera no recoil (Facelift)
  bolt.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 18), M.darkSteel, 0.03, 0, 0, 0, 0, Math.PI / 2));
  // Cabeça do ferrolho polida visível na janela de ejeção
  bolt.add(mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.038, 14), M.steel, 0.040, 0, 0.022, 0, 0, Math.PI / 2));
  // Extrator e estojo em latão carregado na câmara
  bolt.add(mesh(new THREE.BoxGeometry(0.014, 0.014, 0.022), M.brass, 0.038, 0, 0.036));

  // Haste e manípulo tático de manejo dourado
  bolt.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.062, 10), M.steel, 0.050, 0, 0.046, Math.PI / 2, 0, 0));
  const boltKnob = mesh(new THREE.SphereGeometry(0.016, 14, 12), M.accent);
  boltKnob.position.set(0.050, 0, 0.078);
  bolt.add(boltKnob);

  rifle.add(bolt);

  /* ---------- 4.9 BOTÃO DE LIBERAÇÃO DO CARREGADOR (MAG RELEASE) ---------- */
  const magRelease = new THREE.Group();
  magRelease.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 14), M.accent, 0.125, -0.022, 0.050, Math.PI / 2, 0, 0));
  magRelease.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 14), M.darkSteel, 0.125, -0.022, 0.040, Math.PI / 2, 0, 0));
  rifle.add(magRelease);

  /* ---------- 4.10 MUZZLE FLASH E POINT LIGHT DINÂMICOS ---------- */
  const MUZZLE_LOCAL = new THREE.Vector3(0.765, 0.012, 0);

  const flashMat = new THREE.MeshBasicMaterial({
    map: GLOW_TEX,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffd88a
  });
  const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), flashMat);
  muzzleFlash.position.copy(MUZZLE_LOCAL);
  muzzleFlash.visible = false;
  rifle.add(muzzleFlash);

  const muzzleFlash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), flashMat);
  muzzleFlash2.position.copy(MUZZLE_LOCAL);
  muzzleFlash2.rotation.x = Math.PI / 2;
  muzzleFlash2.visible = false;
  rifle.add(muzzleFlash2);

  const muzzleLight = new THREE.PointLight(0xffa030, 0, 1.6, 2.0);
  muzzleLight.position.set(0.80, 0.02, 0);
  rifle.add(muzzleLight);

  const physics = new PrototypePhysics(rifle, bolt, {
    muzzleFlash,
    muzzleFlash2,
    muzzleLight,
    flashMat
  });

  return {
    group: root,
    rifle,
    bolt,
    physics,
    optic,
    opticBody,
    redDotMesh,
    redDotHalo,
    frontLens,
    rearLens
  };
}
