/**
 * ============================================================================
 *   RIFLE PROTOTYPE — FN SCAR-H (Mk 17) TACTICAL FACELIFT v4.0
 * ============================================================================
 * Visual redesenhado para a silhueta icônica do FN SCAR-H (7.62x51mm NATO)
 * no esquema "50 Shades of FDE" (Flat Dark Earth / Anodized Bronze / Tan),
 * mantendo ALTA PERFORMANCE (Mobile / Low-End) e 100% dos sockets originais:
 *
 * REGRAS E SOCKETS PRESERVADOS:
 *   - Bocal do cano (Muzzle Socket): X = 0.765, Y = 0.012, Z = 0
 *   - Linha de mira óptica (ADS Sight Line): X = 0.060, Y = 0.108, Z = 0
 *   - Grupo animado `bolt`: recua em X (-0.085) levando o ferrolho e a
 *     clássica alavanca de manejo reciprocante frontal esquerda do SCAR-H.
 *   - Zero material.clone() nos meshes (exceto rearLensMat para RenderTarget).
 * ============================================================================
 */

import * as THREE from 'three';

/* ============================================================
   1. TEXTURAS PROCEDURAIS OTIMIZADAS (EFEITOS + PBR SCAR-H)
   ============================================================ */

export function makeGlowTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.20, 'rgba(255,240,180,0.95)');
  g.addColorStop(0.45, 'rgba(255,160,50,0.45)');
  g.addColorStop(0.75, 'rgba(255,80,10,0.12)');
  g.addColorStop(1.00, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeSmokeTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const s = 64;
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

/**
 * Textura procedural do Upper Monolítico SCAR-H (Alumínio Anodizado FDE Dourado
 * com furos de ventilação ovais, rebites Torx e linhas de usinagem)
 */
function makeScarUpperTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 128, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Base FDE anodizado metálico
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#c5ab7c');
  grad.addColorStop(0.5, '#b59968');
  grad.addColorStop(1.0, '#987e52');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Linhas horizontais de extrusão do receptor
  ctx.fillStyle = 'rgba(40, 30, 15, 0.16)';
  ctx.fillRect(0, 14, w, 2);
  ctx.fillRect(0, 48, w, 2);

  // Furos de ventilação superiores/frontais típicos do guarda-mão do SCAR
  ctx.fillStyle = '#1e1f22';
  for (let i = 0; i < 4; i++) {
    const vx = 74 + i * 12;
    ctx.fillRect(vx, 18, 7, 8);
  }

  // Parafusos Torx pretos laterais do chassi SCAR
  ctx.fillStyle = '#25272a';
  const bolts = [14, 42, 68, 114];
  for (let i = 0; i < bolts.length; i++) {
    ctx.beginPath();
    ctx.arc(bolts[i], 38, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Textura procedural para simular os dentes do trilho Picatinny sem criar 30 boxes
 */
function makePicatinnyTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 128, h = 16;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#9a8054';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#383024';
  for (let x = 0; x < w; x += 6) {
    ctx.fillRect(x, 0, 2.5, h);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Textura procedural das nervuras estampadas do carregador reto 7.62x51mm do SCAR-H
 */
function makeScarMagTexture() {
  if (typeof document === 'undefined') return new THREE.Texture();
  const w = 64, h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#75644a';
  ctx.fillRect(0, 0, w, h);

  // Nervuras verticais e horizontais de reforço do carregador de 20 tiros
  ctx.fillStyle = 'rgba(30, 25, 18, 0.35)';
  ctx.fillRect(10, 4, 8, h - 8);
  ctx.fillRect(46, 4, 8, h - 8);

  for (let y = 10; y < h - 8; y += 10) {
    ctx.fillRect(22, y, 20, 4);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const GLOW_TEX = makeGlowTexture();
export const SMOKE_TEX = makeSmokeTexture();
const UPPER_TEX = makeScarUpperTexture();
const RAIL_TEX = makePicatinnyTexture();
const MAG_TEX = makeScarMagTexture();

/* ============================================================
   2. MATERIAIS TÁTICOS PBR COMPARTILHADOS ("50 SHADES OF FDE")
   ============================================================ */

const M = {
  // Alumínio anodizado FDE Dourado/Bronze (Upper Monolítico SCAR-H)
  scarUpper:   new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: UPPER_TEX,
    metalness: 0.58,
    roughness: 0.34
  }),

  // Trilho Picatinny FDE escuro texturizado em peça única
  scarRail:    new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: RAIL_TEX,
    metalness: 0.52,
    roughness: 0.38
  }),

  // Polímero FDE Fosco (Lower Receiver e Punho)
  fdePolymer:  new THREE.MeshStandardMaterial({ color: 0x8f7958, metalness: 0.14, roughness: 0.68 }),

  // Polímero Tan Claro (Coronha "Ugg Boot" e Foregrip)
  tanStock:    new THREE.MeshStandardMaterial({ color: 0xa68e67, metalness: 0.18, roughness: 0.56 }),

  // Polímero FDE Escuro / Coyote (Cheek Riser, Mag Basepad)
  coyote:      new THREE.MeshStandardMaterial({ color: 0x6e5b41, metalness: 0.20, roughness: 0.62 }),

  // Carregador de aço 7.62mm estampado em Bronze/Tan escuro
  scarMag:     new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: MAG_TEX,
    metalness: 0.48,
    roughness: 0.44
  }),

  // Metais e polímero preto tático
  steel:       new THREE.MeshStandardMaterial({ color: 0x6e757c, metalness: 0.82, roughness: 0.28 }),
  darkSteel:   new THREE.MeshStandardMaterial({ color: 0x2c3035, metalness: 0.65, roughness: 0.36 }),
  black:       new THREE.MeshStandardMaterial({ color: 0x1c1e21, metalness: 0.22, roughness: 0.65 }),
  accent:      new THREE.MeshStandardMaterial({ color: 0xb88642, metalness: 0.82, roughness: 0.30 }),
  sightBody:   new THREE.MeshStandardMaterial({ color: 0x7c6749, metalness: 0.55, roughness: 0.35 }),

  // Lente óptica leve otimizada (StandardMaterial com transparência simples)
  opticGlass:  new THREE.MeshStandardMaterial({
    color: 0x55bbdd,
    metalness: 0.3,
    roughness: 0.1,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
  }),

  // Retículo Red Dot iluminado
  redDot:      new THREE.MeshBasicMaterial({ color: 0xff1e2d })
};

/**
 * Criação limpa de Mesh sem clone de material e sem sobrecarga de sombras em viewmodel
 */
function mesh(geo, material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(px, py, pz);
  m.rotation.set(rx, ry, rz);
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
    this.closeDelay = 0;
    this.flashTimer = 0;
  }

  onFire(ammo = 30) {
    // 1. Ciclo de blowback (aciona o ferrolho e o charging handle reciprocante esquerdo)
    this.boltCycle = 0;

    if (ammo <= 0) {
      // Chegou em zero: trava em openbolt imediatamente e agenda fechamento para 0.2s após o fim do reload
      this.boltOpen = true;
      this.closeDelay = 0.20;
    } else {
      this.boltOpen = false;
      this.closeDelay = 0;
    }

    // 2. Impulso de recuo (valores balanceados)
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
    muzzleLight.intensity = 14;
  }

  onReload() {
    // Mantém o ferrolho aberto durante toda a animação de recarga para fechar 0.2s após a arma subir de volta
    if (this.boltOpen) {
      this.closeDelay = 0.20;
    }
  }

  update(dt, camera, ammo = 30) {
    // Se a munição estiver zerada, garante trava em openbolt
    if (ammo <= 0 && !this.boltOpen) {
      this.boltOpen = true;
      this.closeDelay = 0.20;
    }

    // 0.2s após a animação de reload terminar (ammo > 0 e arma de volta na tela), fecha o ferrolho na cara do jogador
    if (this.boltOpen && ammo > 0) {
      if (this.closeDelay > 0) {
        this.closeDelay -= dt;
      } else {
        this.boltOpen = false;
      }
    }

    /* ---- blowback do ferrolho e do charging handle ---- */
    if (this.boltCycle < 1) {
      this.boltCycle = Math.min(1, this.boltCycle + dt / 0.085);
    }
    const targetOpen = this.boltOpen ? 1 : 0;
    this.boltOpenAmt += (targetOpen - this.boltOpenAmt) * (1 - Math.exp(-dt * 16));

    const cycleOff = this.boltCycle < 1
      ? -0.085 * Math.sin(Math.PI * this.boltCycle)
      : 0;
    const openOff = -0.085 * this.boltOpenAmt;
    const boltOffset = Math.min(cycleOff, openOff);

    this.bolt.position.x = boltOffset;

    /* ---- recoil elástico com as fórmulas originais ---- */
    const recoilDecay = 1 - Math.exp(-dt * 6.5);
    this.recoil += (0 - this.recoil) * recoilDecay;
    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 9));

    const r = this.recoil;
    this.rifle.position.x = -r * 0.0275;
    this.rifle.position.y = r * 0.010;
    this.rifle.rotation.z = r * 0.105;
    this.rifle.rotation.y = r * 0.012;

    /* ---- muzzle flash ---- */
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(this.flashTimer / 0.055, 0);
      this.flashObj.flashMat.opacity = k * 0.95;
      this.flashObj.muzzleLight.intensity = 14 * k;
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
   4. CONSTRUÇÃO DO FN SCAR-H (Mk 17) LOW-POLY / BLOCKY
   ============================================================ */

export function buildSCARH() {
  const root = new THREE.Group();

  // pivot alinha o rifle com a direção de visão em primeira pessoa (+X cano -> -Z câmera)
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2;
  root.add(pivot);

  // rifle: grupo onde atua o recuo e movimentação do protótipo
  const rifle = new THREE.Group();
  pivot.add(rifle);

  /* ---------- 4.1 RECEIVER MONOLÍTICO SCAR-H (UPPER ANODIZADO + LOWER FDE) ---------- */
  const receiver = new THREE.Group();

  // Upper Receiver Monolítico em alumínio FDE anodizado dourado (vai de X = -0.18 até X = +0.39)
  receiver.add(mesh(new THREE.BoxGeometry(0.57, 0.062, 0.080), M.scarUpper, 0.105, 0.016, 0));
  // Topo chanfrado do chassi monolítico
  receiver.add(mesh(new THREE.BoxGeometry(0.57, 0.010, 0.062), M.coyote, 0.105, 0.050, 0));

  // Trilho Picatinny superior monolítico contínuo (topo exatamente em Y = 0.062)
  receiver.add(mesh(new THREE.BoxGeometry(0.56, 0.010, 0.046), M.scarRail, 0.105, 0.057, 0));

  // Lower Receiver em polímero FDE fosco
  receiver.add(mesh(new THREE.BoxGeometry(0.25, 0.048, 0.074), M.fdePolymer, -0.030, -0.028, 0));

  // Magwell reto superdimensionado para calibre 7.62x51mm NATO
  receiver.add(mesh(new THREE.BoxGeometry(0.112, 0.062, 0.080), M.fdePolymer, 0.072, -0.036, 0));
  receiver.add(mesh(new THREE.BoxGeometry(0.116, 0.012, 0.084), M.coyote, 0.072, -0.062, 0));

  // Seletor de tiro ambidestro característico do SCAR
  receiver.add(mesh(new THREE.BoxGeometry(0.028, 0.010, 0.084), M.black, -0.055, -0.018, 0, 0, 0, -0.35));

  // Janela de Ejeção direita (+Z local) + Defletor de estojos
  receiver.add(mesh(new THREE.BoxGeometry(0.125, 0.032, 0.008), M.black, 0.035, 0.022, 0.038));
  receiver.add(mesh(new THREE.BoxGeometry(0.026, 0.030, 0.018), M.darkSteel, -0.038, 0.022, 0.044, 0, 0.35, 0));

  // Rasgo frontal longo de curso da alavanca reciprocante no lado ESQUERDO (-Z local)
  receiver.add(mesh(new THREE.BoxGeometry(0.185, 0.014, 0.008), M.black, 0.075, 0.030, -0.038));

  // Alça de mira traseira rebatida (Folded Rear BUIS) — fica em Y = 0.070 (livre da linha óptica 0.108)
  receiver.add(mesh(new THREE.BoxGeometry(0.042, 0.014, 0.038), M.darkSteel, -0.145, 0.068, 0));

  rifle.add(receiver);

  /* ---------- 4.2 ÓPTICA TÁTICA FDE (SOCKET EXATO Y = 0.108 PRESERVADO) ---------- */
  // Ponto óptico central preservado com exatidão: X = 0.060, Y = 0.108, Z = 0
  const optic = new THREE.Group();
  optic.position.set(0.060, 0.062, 0);

  // Base QD Mount em aço escuro + Riser em FDE anodizado
  optic.add(mesh(new THREE.BoxGeometry(0.088, 0.014, 0.052), M.darkSteel, 0, 0.007, 0));
  optic.add(mesh(new THREE.BoxGeometry(0.068, 0.026, 0.040), M.coyote, 0, 0.021, 0));

  // Corpo cilíndrico do Red Dot com carenagem tática FDE
  const opticBody = new THREE.Group();
  opticBody.position.set(0, 0.046, 0); // Y central absoluto = 0.062 + 0.046 = 0.108

  // Tubo principal em FDE Anodizado (SightBody)
  opticBody.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.084, 14), M.sightBody, 0, 0, 0, 0, 0, Math.PI / 2));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.014, 14), M.darkSteel, 0.040, 0, 0, 0, 0, Math.PI / 2));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14), M.darkSteel, -0.038, 0, 0, 0, 0, Math.PI / 2));

  // Torres compactas de ajuste
  opticBody.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 8), M.darkSteel, 0.005, 0.028, 0));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10), M.accent, 0.005, 0, -0.028, Math.PI / 2, 0, 0));

  // Lentes dianteira e traseira (Preservadas para compatibilidade com Scope/ADS)
  const frontLens = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.002, 14), M.opticGlass, 0.035, 0, 0, 0, 0, Math.PI / 2);
  const rearLensMat = M.opticGlass.clone(); // Clone exclusivo para eventual RenderTarget do Scope
  const rearLens  = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.002, 14), rearLensMat, -0.035, 0, 0, 0, 0, Math.PI / 2);
  opticBody.add(frontLens, rearLens);

  // Retículo central Red Dot
  const redDotMesh = mesh(new THREE.SphereGeometry(0.0016, 8, 8), M.redDot, 0, 0, 0);
  const redDotHalo = mesh(new THREE.RingGeometry(0.0035, 0.0045, 12), M.redDot, -0.001, 0, 0, 0, Math.PI / 2, 0);
  opticBody.add(redDotMesh, redDotHalo);

  optic.add(opticBody);
  rifle.add(optic);

  /* ---------- 4.3 GUARDA-MÃO FRONTAL SCAR-H (TRILHOS + FOREGRIP FDE) ---------- */
  const handguard = new THREE.Group();

  // Extensão inferior do guarda-mão do SCAR-H e trilho Picatinny inferior
  handguard.add(mesh(new THREE.BoxGeometry(0.24, 0.024, 0.068), M.coyote, 0.265, -0.022, 0));
  handguard.add(mesh(new THREE.BoxGeometry(0.22, 0.010, 0.042), M.scarRail, 0.265, -0.038, 0));

  // Trilhos Picatinny laterais frontais (direito e esquerdo)
  handguard.add(mesh(new THREE.BoxGeometry(0.18, 0.018, 0.090), M.darkSteel, 0.285, 0.008, 0));

  // Empunhadura frontal tática (Tactical Stubby / Angled Foregrip em Tan/FDE)
  const afg = new THREE.Group();
  afg.position.set(0.285, -0.042, 0);
  afg.add(mesh(new THREE.BoxGeometry(0.095, 0.012, 0.038), M.black, 0, -0.004, 0));
  afg.add(mesh(new THREE.BoxGeometry(0.052, 0.068, 0.034), M.tanStock, 0.005, -0.038, 0, 0, 0, -0.22));
  handguard.add(afg);

  rifle.add(handguard);

  /* ---------- 4.4 CANO PESADO 7.62mm, BLOCO DE GÁS SCAR & QUEBRA-CHAMAS ---------- */
  const barrel = new THREE.Group();

  // Cano pesado flutuante 7.62mm em aço fosfatado escuro (Eixo Y = 0.012)
  barrel.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.36, 12), M.darkSteel, 0.54, 0.012, 0, 0, 0, Math.PI / 2));

  // Icônico Bloco de Gás do SCAR-H logo à frente do chassi monolítico
  const gasBlock = new THREE.Group();
  gasBlock.position.set(0.425, 0.018, 0);
  gasBlock.add(mesh(new THREE.BoxGeometry(0.056, 0.054, 0.044), M.steel, 0, 0, 0));
  // Válvula reguladora de gás frontal saliente
  gasBlock.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.036, 10), M.accent, 0.022, 0.014, 0, 0, 0, Math.PI / 2));
  // Massa de mira frontal rebatida para trás (abaixo de Y = 0.080, não obstrui o Red Dot em 0.108)
  gasBlock.add(mesh(new THREE.BoxGeometry(0.050, 0.012, 0.026), M.darkSteel, -0.010, 0.032, 0));
  barrel.add(gasBlock);

  // Quebra-chamas / Compensador SCAR-H 3-Prong (Termina EXATAMENTE em X = 0.765)
  // Posição central X = 0.730 + metade do comprimento (0.070 / 2 = 0.035) => Bocal em X = 0.765
  const muzzleComp = new THREE.Group();
  muzzleComp.position.set(0.730, 0.012, 0);
  muzzleComp.add(mesh(new THREE.CylinderGeometry(0.021, 0.022, 0.070, 12), M.darkSteel, 0, 0, 0, 0, 0, Math.PI / 2));
  muzzleComp.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.016, 12), M.black, -0.022, 0, 0, 0, 0, Math.PI / 2));
  muzzleComp.add(mesh(new THREE.BoxGeometry(0.026, 0.026, 0.026), M.black, 0.016, 0, 0));
  barrel.add(muzzleComp);

  rifle.add(barrel);

  /* ---------- 4.5 CORONHA ICÔNICA SCAR "UGG BOOT" (DOBRÁVEL / TELESCÓPICA) ---------- */
  const stock = new THREE.Group();

  // Bloco da dobradiça traseira preta (Folding Stock Hinge Block)
  stock.add(mesh(new THREE.BoxGeometry(0.036, 0.086, 0.078), M.black, -0.196, 0.004, 0));

  // Braço superior da coronha
  stock.add(mesh(new THREE.BoxGeometry(0.27, 0.072, 0.062), M.tanStock, -0.345, 0.004, 0));

  // Apoio de bochecha elevado ajustável (Adjustable Cheek Riser) em tom Coyote
  stock.add(mesh(new THREE.BoxGeometry(0.185, 0.026, 0.068), M.coyote, -0.315, 0.042, 0));

  // Parte traseira alargada característica ("Ugg Boot" Lower Toe)
  stock.add(mesh(new THREE.BoxGeometry(0.135, 0.126, 0.066), M.tanStock, -0.415, -0.022, 0));
  // Pino/botão de ajuste de comprimento da coronha
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.024, 0.072), M.black, -0.385, -0.025, 0));

  // Soleira de borracha preta espessa e curvada
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.136, 0.072), M.black, -0.492, -0.022, 0));

  rifle.add(stock);

  /* ---------- 4.6 PUNHO ERGONÔMICO FDE & GATILHO ---------- */
  const triggerGroup = new THREE.Group();

  // Punho tático em polímero FDE
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.050, 0.140, 0.052), M.fdePolymer, -0.062, -0.105, 0, 0, 0, -0.24));
  // Base do punho
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.052, 0.014, 0.054), M.black, -0.082, -0.170, 0, 0, 0, -0.24));

  // Guarda-mato alargado do SCAR
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.092, 0.009, 0.026), M.fdePolymer, -0.020, -0.080, 0));
  // Gatilho metálico
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.008, 0.038, 0.014), M.steel, -0.016, -0.058, 0, 0, 0, 0.10));

  rifle.add(triggerGroup);

  /* ---------- 4.7 CARREGADOR RETO SCAR-H 7.62x51mm NATO (20 TIROS) ---------- */
  const magazine = new THREE.Group();
  magazine.position.set(0.072, -0.045, 0);
  magazine.rotation.z = 0.015; // Carregador reto autêntico de calibre 7.62mm

  // Caixa metálica reta larga com nervuras estampadas (textura procedural MAG_TEX)
  magazine.add(mesh(new THREE.BoxGeometry(0.086, 0.185, 0.064), M.scarMag, 0, -0.095, 0));
  // Basepad protetor de polímero FDE espesso (Ranger Floorplate)
  magazine.add(mesh(new THREE.BoxGeometry(0.094, 0.022, 0.072), M.coyote, 0.002, -0.192, 0));

  rifle.add(magazine);

  /* ---------- 4.8 FERROLHO & ALAVANCA RECIPROCANTE FRONTAL ESQUERDA ---------- */
  // O grupo bolt se desloca em X (0 a -0.085) e carrega a alavanca de manejo esquerda
  const bolt = new THREE.Group();
  bolt.position.set(0, 0.024, 0);

  // 1. Transportador do ferrolho pesado do SCAR visível na janela de ejeção direita (+Z local)
  bolt.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 12), M.darkSteel, 0.035, 0, 0.015, 0, 0, Math.PI / 2));
  bolt.add(mesh(new THREE.BoxGeometry(0.018, 0.016, 0.020), M.steel, 0.045, 0, 0.030));

  // 2. ALAVANCA DE MANEJO RECIPROCANTE DO SCAR-H NO LADO ESQUERDO (-Z local)
  // Posicionada mais à frente (X = 0.115) como no SCAR real, correndo livremente no rasgo esquerdo
  const leftHandle = new THREE.Group();
  leftHandle.position.set(0.115, 0.006, -0.040);

  // Haste retangular de aço conectada ao porta-ferrolho
  leftHandle.add(mesh(new THREE.BoxGeometry(0.016, 0.010, 0.030), M.darkSteel, 0, 0, -0.014));
  // Tambor cilíndrico estriado clássico da alavanca do SCAR
  leftHandle.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.034, 10), M.black, 0, 0, -0.036, Math.PI / 2, 0, 0));
  leftHandle.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), M.accent, 0, 0, -0.054, Math.PI / 2, 0, 0));

  bolt.add(leftHandle);
  rifle.add(bolt);

  /* ---------- 4.9 MUZZLE FLASH E POINT LIGHT OTIMIZADOS (X = 0.765 EXATO) ---------- */
  const MUZZLE_LOCAL = new THREE.Vector3(0.765, 0.012, 0);

  const flashMat = new THREE.MeshBasicMaterial({
    map: GLOW_TEX,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffd88a
  });
  const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), flashMat);
  muzzleFlash.position.copy(MUZZLE_LOCAL);
  muzzleFlash.visible = false;
  rifle.add(muzzleFlash);

  const muzzleFlash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), flashMat);
  muzzleFlash2.position.copy(MUZZLE_LOCAL);
  muzzleFlash2.rotation.x = Math.PI / 2;
  muzzleFlash2.visible = false;
  rifle.add(muzzleFlash2);

  const muzzleLight = new THREE.PointLight(0xff9922, 0, 1.4, 2.0);
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

export { buildSCARH as buildRiflePrototype };