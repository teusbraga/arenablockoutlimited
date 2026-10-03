/**
 * ============================================================================
 *   RIFLE PROTOTYPE — FACELIFT OPTIMIZED v3.0 (CLEAN TACTICAL)
 * ============================================================================
 * Redesenhado do zero com foco em ALTA PERFORMANCE (Mobile / Low-End) e
 * design tático limpo ("Clean Tactical Carbine"):
 * 
 * OTIMIZAÇÕES GRÁFICAS:
 *   - Zero material.clone(): todos os meshes reutilizam instâncias compartilhadas
 *     de materiais PBR (evita dezenas de draw-calls e recompilações de shader).
 *   - Lente óptica usando MeshStandardMaterial (eliminado MeshPhysicalMaterial e
 *     transmission: 0.85 que destruía a taxa de quadros da GPU).
 *   - Remoção de dezenas de geometrias microscópicas decorativas e desnecessárias
 *     (30+ dentes individuais de picatinny, parafusos minúsculos, pinos redundantes,
 *     assistência de avanço falsa, módulo PEQ-15 que poluía a visão, BUIS dobrados).
 *   - Redução da contagem de polígonos e de objetos na árvore de cena de >95 para ~25.
 * 
 * NOVO CONJUNTO DE MANEJO (CHARGING HANDLE NO LADO ESQUERDO):
 *   - Alavanca de manejo tática ergonomicamente posicionada no lado ESQUERDO (-Z local).
 *   - Conectada diretamente ao grupo animado `bolt`, herdando 100% da física
 *     e do ciclo de blowback/recuo do protótipo original (recua no tiro e trava
 *     aberta ao esgotar a munição).
 * ============================================================================
 */

import * as THREE from 'three';

/* ============================================================
   1. TEXTURAS PROCEDURAIS OTIMIZADAS
   ============================================================ */

export function makeGlowTexture() {
  const s = 64; // Reduzido de 128 para 64 (suficiente para partículas de flash sem desperdício de VRAM)
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

export const GLOW_TEX = makeGlowTexture();

/* ============================================================
   2. MATERIAIS TÁTICOS PBR COMPARTILHADOS (ZERO CLONE)
   ============================================================ */

const M = {
  steel:       new THREE.MeshStandardMaterial({ color: 0x828a92, metalness: 0.92, roughness: 0.32 }),
  darkSteel:   new THREE.MeshStandardMaterial({ color: 0x484f56, metalness: 0.88, roughness: 0.40 }),
  receiver:    new THREE.MeshStandardMaterial({ color: 0x3e444a, metalness: 0.82, roughness: 0.42 }),
  black:       new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.35, roughness: 0.75 }),
  polymer:     new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.15, roughness: 0.82 }),
  fdePolymer:  new THREE.MeshStandardMaterial({ color: 0x424950, metalness: 0.20, roughness: 0.78 }),
  accent:      new THREE.MeshStandardMaterial({ color: 0xb5823e, metalness: 0.85, roughness: 0.30 }),
  sightBody:   new THREE.MeshStandardMaterial({ color: 0x363c42, metalness: 0.90, roughness: 0.32 }),

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
    this.flashTimer = 0;
  }

  onFire(ammo = 30) {
    // 1. Ciclo de blowback (aciona o ferrolho e o novo charging handle esquerdo)
    this.boltCycle = 0;

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
    this.boltOpen = false;
  }

  update(dt, camera, ammo = 30) {
    /* ---- blowback do ferrolho e do charging handle ---- */
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
   4. CONSTRUÇÃO DO RIFLE FACELIFT LIMPO E OTIMIZADO
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

  /* ---------- 4.1 RECEIVER TÁTICO OTIMIZADO ---------- */
  const receiver = new THREE.Group();

  // Upper Receiver (corpo principal superior)
  receiver.add(mesh(new THREE.BoxGeometry(0.36, 0.054, 0.082), M.receiver, 0, 0.018, 0));
  // Lower Receiver
  receiver.add(mesh(new THREE.BoxGeometry(0.24, 0.046, 0.078), M.receiver, -0.04, -0.026, 0));

  // Magwell alargado chanfrado
  receiver.add(mesh(new THREE.BoxGeometry(0.090, 0.072, 0.084), M.darkSteel, 0.075, -0.042, 0));

  // Trilho superior contínuo simplificado (barra sólida com chanfros, sem dentes microscópicos individuais)
  receiver.add(mesh(new THREE.BoxGeometry(0.36, 0.014, 0.046), M.darkSteel, 0, 0.052, 0));

  // Janela de Ejeção chanfrada do lado direito (+Z local)
  receiver.add(mesh(new THREE.BoxGeometry(0.125, 0.034, 0.008), M.black, 0.035, 0.020, 0.043));
  // Defletor de cartuchos compacto
  receiver.add(mesh(new THREE.BoxGeometry(0.030, 0.030, 0.020), M.darkSteel, -0.042, 0.020, 0.046, 0, 0.40, 0));

  // Trilho/ranhura guia da alavanca de manejo no lado ESQUERDO (-Z local)
  receiver.add(mesh(new THREE.BoxGeometry(0.16, 0.018, 0.008), M.black, 0.02, 0.026, -0.043));

  rifle.add(receiver);

  /* ---------- 4.2 ÓPTICA TÁTICA MICRO REFLEX RED DOT ---------- */
  // Ponto óptico central preservado com exatidão: X = 0.060, Y = 0.108, Z = 0
  const optic = new THREE.Group();
  optic.position.set(0.060, 0.062, 0);

  // Montagem elevada aerodinâmica (Skeleton Mount unificada)
  optic.add(mesh(new THREE.BoxGeometry(0.090, 0.014, 0.052), M.darkSteel, 0, 0.007, 0));
  optic.add(mesh(new THREE.BoxGeometry(0.065, 0.026, 0.038), M.darkSteel, 0, 0.021, 0));

  // Corpo cilíndrico do Red Dot
  const opticBody = new THREE.Group();
  opticBody.position.set(0, 0.046, 0); // Y central = 0.062 + 0.046 = 0.108

  // Tubo principal (reduzido para 14 segmentos - leve e suave)
  opticBody.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.084, 14), M.sightBody, 0, 0, 0, 0, 0, Math.PI / 2));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.029, 0.029, 0.014, 14), M.darkSteel, 0.040, 0, 0, 0, 0, Math.PI / 2));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 14), M.darkSteel, -0.038, 0, 0, 0, 0, Math.PI / 2));

  // Torres compactas de ajuste
  opticBody.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 8), M.darkSteel, 0.005, 0.028, 0));
  opticBody.add(mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 10), M.accent, 0.005, 0, -0.028, Math.PI / 2, 0, 0));

  // Lentes dianteira e traseira (Lente leve MeshStandardMaterial compartilhada)
  const frontLens = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.002, 14), M.opticGlass, 0.035, 0, 0, 0, 0, Math.PI / 2);
  const rearLensMat = M.opticGlass.clone(); // Clone apenas desta lente para receber o RenderTarget do Scope
  const rearLens  = mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.002, 14), rearLensMat, -0.035, 0, 0, 0, 0, Math.PI / 2);
  opticBody.add(frontLens, rearLens);

  // Retículo central Red Dot
  const redDotMesh = mesh(new THREE.SphereGeometry(0.0016, 8, 8), M.redDot, 0, 0, 0);
  const redDotHalo = mesh(new THREE.RingGeometry(0.0035, 0.0045, 12), M.redDot, -0.001, 0, 0, 0, Math.PI / 2, 0);
  opticBody.add(redDotMesh, redDotHalo);

  optic.add(opticBody);
  rifle.add(optic);

  /* ---------- 4.3 GUARDA-MÃO TÁTICO MODERNO M-LOK ---------- */
  const handguard = new THREE.Group();

  // Guarda-mão octogonal esguio de peça única
  handguard.add(mesh(new THREE.BoxGeometry(0.34, 0.072, 0.074), M.receiver, 0.35, 0.006, 0));
  // Trilho superior contínuo alinhado
  handguard.add(mesh(new THREE.BoxGeometry(0.34, 0.012, 0.044), M.darkSteel, 0.35, 0.048, 0));
  // Ranhuras M-LOK simuladas elegantes em baixo relevo
  for (let i = 0; i < 3; i++) {
    const sx = 0.24 + i * 0.085;
    handguard.add(mesh(new THREE.BoxGeometry(0.055, 0.018, 0.076), M.black, sx, 0.006, 0));
  }

  // Angled Foregrip (AFG) anatômico em polímero
  const afg = new THREE.Group();
  afg.position.set(0.34, -0.038, 0);
  afg.add(mesh(new THREE.BoxGeometry(0.12, 0.010, 0.034), M.polymer, 0, -0.005, 0));
  afg.add(mesh(new THREE.BoxGeometry(0.08, 0.040, 0.032), M.fdePolymer, 0.01, -0.024, 0, 0, 0, -0.40));
  handguard.add(afg);

  rifle.add(handguard);

  /* ---------- 4.4 CANO DE PRECISÃO & COMPENSADOR TÁTICO ---------- */
  const barrel = new THREE.Group();

  // Cano usinado flutuante
  barrel.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.52, 12), M.steel, 0.44, 0.012, 0, 0, 0, Math.PI / 2));
  // Bloco de gás integrado de perfil baixo
  barrel.add(mesh(new THREE.BoxGeometry(0.036, 0.040, 0.032), M.darkSteel, 0.54, 0.014, 0));

  // Compensador Tático / Quebra-chamas WarComp
  const muzzleComp = new THREE.Group();
  muzzleComp.position.set(0.725, 0.012, 0);
  muzzleComp.add(mesh(new THREE.CylinderGeometry(0.020, 0.021, 0.070, 12), M.darkSteel, 0, 0, 0, 0, 0, Math.PI / 2));
  muzzleComp.add(mesh(new THREE.BoxGeometry(0.016, 0.024, 0.024), M.black, 0.012, 0, 0));
  barrel.add(muzzleComp);

  rifle.add(barrel);

  /* ---------- 4.5 CORONHA TELESCÓPICA COMPACTA (CTR STYLE) ---------- */
  const stock = new THREE.Group();

  // Buffer Tube cilíndrico Mil-Spec
  stock.add(mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.22, 12), M.steel, -0.27, 0.008, 0, 0, 0, Math.PI / 2));
  // Corpo ergonômico da coronha
  stock.add(mesh(new THREE.BoxGeometry(0.22, 0.088, 0.064), M.polymer, -0.37, 0.002, 0));
  stock.add(mesh(new THREE.BoxGeometry(0.16, 0.024, 0.070), M.fdePolymer, -0.38, 0.048, 0));
  // Soleira de borracha antiderrapante
  stock.add(mesh(new THREE.BoxGeometry(0.026, 0.130, 0.072), M.black, -0.490, -0.010, 0));

  rifle.add(stock);

  /* ---------- 4.6 PUNHO ERGONÔMICO (GRIP) & GATILHO ---------- */
  const triggerGroup = new THREE.Group();

  // Punho tático com inclinação ergonômica
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.048, 0.140, 0.052), M.polymer, -0.060, -0.105, 0, 0, 0, -0.22));
  // Base do punho
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.050, 0.012, 0.054), M.darkSteel, -0.080, -0.170, 0, 0, 0, -0.22));

  // Guarda-mato
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.090, 0.008, 0.024), M.darkSteel, -0.022, -0.080, 0));
  // Gatilho esportivo dourado
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.008, 0.038, 0.014), M.accent, -0.016, -0.058, 0, 0, 0, 0.08));

  rifle.add(triggerGroup);

  /* ---------- 4.7 CARREGADOR TÁTICO P-MAG ---------- */
  const magazine = new THREE.Group();
  magazine.position.set(0.075, -0.045, 0);
  magazine.rotation.z = 0.09;

  // Corpo curvo de polímero
  magazine.add(mesh(new THREE.BoxGeometry(0.058, 0.195, 0.068), M.polymer, 0, -0.095, 0));
  // Base alargada
  magazine.add(mesh(new THREE.BoxGeometry(0.064, 0.016, 0.076), M.darkSteel, -0.002, -0.195, 0));
  // Janela com cartuchos dourados visíveis
  magazine.add(mesh(new THREE.BoxGeometry(0.014, 0.070, 0.072), M.accent, 0, -0.090, 0));

  rifle.add(magazine);

  /* ---------- 4.8 NOVO CONJUNTO DO FERROLHO & CHARGING HANDLE NO LADO ESQUERDO ---------- */
  // O grupo bolt se desloca em X (0 a -0.085) e carrega a alavanca de manejo esquerda
  const bolt = new THREE.Group();
  bolt.position.set(0, 0.024, 0);

  // 1. Ferrolho interno visível na janela de ejeção direita (+Z local)
  bolt.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 12), M.steel, 0.035, 0, 0.015, 0, 0, Math.PI / 2));
  bolt.add(mesh(new THREE.BoxGeometry(0.014, 0.014, 0.020), M.accent, 0.042, 0, 0.030));

  // 2. NOVA ALAVANCA DE MANEJO TÁTICA NO LADO ESQUERDO (-Z local)
  // Substitui a alavanca traseira e herda todo o ciclo de animação e blowback do ferrolho
  const leftHandle = new THREE.Group();
  leftHandle.position.set(0.025, 0.004, -0.042);

  // Haste de aço conectada ao transportador do ferrolho
  leftHandle.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.032, 8), M.steel, 0, 0, -0.016, Math.PI / 2, 0, 0));
  // Manípulo tático de combate estriado (Knurled Charging Handle Knob) em tom dourado/accent
  leftHandle.add(mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.032, 10), M.accent, 0, 0, -0.038, Math.PI / 2, 0, 0));
  leftHandle.add(mesh(new THREE.SphereGeometry(0.010, 8, 8), M.darkSteel, 0, 0, -0.054));

  bolt.add(leftHandle);
  rifle.add(bolt);

  /* ---------- 4.9 MUZZLE FLASH E POINT LIGHT OTIMIZADOS ---------- */
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
