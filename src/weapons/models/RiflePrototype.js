/**
 * ============================================================================
 *   RIFLE PROTOTYPE — Cópia Integral e Fiel do Protótipo Three.js
 * ============================================================================
 * Modelo procedural, materiais, iluminação, flash, fórmulas elásticas de recuo,
 * blowback do ferrolho e tremor de câmera copiados diretamente do código original.
 * ============================================================================
 */

import * as THREE from 'three';

/* ============================================================
   4. TEXTURAS PROCEDURAIS (ORIGINAIS)
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
   5. MATERIAIS (ORIGINAIS)
   ============================================================ */

const M = {
  steel:     new THREE.MeshStandardMaterial({ color: 0x3c434a, metalness: 0.92, roughness: 0.36 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.88, roughness: 0.44 }),
  black:     new THREE.MeshStandardMaterial({ color: 0x14171a, metalness: 0.35, roughness: 0.78 }),
  polymer:   new THREE.MeshStandardMaterial({ color: 0x1e2226, metalness: 0.12, roughness: 0.86 }),
  accent:    new THREE.MeshStandardMaterial({ color: 0x9a6630, metalness: 0.75, roughness: 0.42 }),
  brass:     new THREE.MeshStandardMaterial({ color: 0xc09a44, metalness: 0.95, roughness: 0.28 }),
  sight:     new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.9,  roughness: 0.4  })
};

/* ============================================================
   6. HELPERS DE CONSTRUÇÃO (ORIGINAL)
   ============================================================ */

function mesh(geo, material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material.clone());
  m.position.set(px, py, pz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ============================================================
   CLASSE DE FÍSICA E ANIMAÇÕES (EXATAS DO PROTÓTIPO)
   ============================================================ */

export class PrototypePhysics {
  constructor(rifle, bolt, flashObj) {
    this.rifle = rifle;
    this.bolt = bolt;
    this.flashObj = flashObj;

    // Estado original do protótipo
    this.recoil = 0;
    this.shake = 0;
    this.boltCycle = 1;
    this.boltOpen = false;
    this.boltOpenAmt = 0;
    this.flashTimer = 0;
  }

  onFire(ammo = 30) {
    // blowback
    this.boltCycle = 0;

    // recoil
    this.recoil = Math.min(this.recoil + 0.42, 1.15);
    this.shake = Math.min(this.shake + 0.85, 1.6);

    // flash
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
    /* ---- blowback do ferrolho (original) ---- */
    if (this.boltCycle < 1) {
      this.boltCycle = Math.min(1, this.boltCycle + dt / 0.085);
    }
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

    this.bolt.position.x = boltOffset; // homePos.x é 0

    /* ---- recoil (fórmulas e vetores idênticos ao protótipo) ---- */
    const recoilDecay = 1 - Math.exp(-dt * 6.5);
    this.recoil += (0 - this.recoil) * recoilDecay;
    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 9));

    const r = this.recoil;
    this.rifle.position.x = -r * 0.055;
    this.rifle.position.y = r * 0.010;
    this.rifle.rotation.z = r * 0.105;
    this.rifle.rotation.y = r * 0.012;

    /* ---- muzzle flash (original) ---- */
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
   CONSTRUÇÃO DO RIFLE (CÓPIA EXATA DA SEÇÃO 7 DO PROTÓTIPO)
   ============================================================ */

export function buildRiflePrototype() {
  const root = new THREE.Group();

  // pivot alinha o rifle com a direção de visão em primeira pessoa (+X cano -> -Z câmera)
  const pivot = new THREE.Group();
  pivot.rotation.y = Math.PI / 2;
  root.add(pivot);

  const rifle = new THREE.Group();
  pivot.add(rifle);

  /* ---------- 7.1 RECEIVER (corpo — peça base, não removível) ---------- */
  const receiver = new THREE.Group();
  receiver.add(mesh(new THREE.BoxGeometry(0.36, 0.09, 0.10), M.steel, 0, 0, 0));
  // porta de ejeção (lado direito)
  receiver.add(mesh(new THREE.BoxGeometry(0.115, 0.042, 0.012), M.darkSteel, 0.025, 0.013, 0.0535));
  // alça de mira traseira
  receiver.add(mesh(new THREE.BoxGeometry(0.042, 0.046, 0.058), M.sight, -0.145, 0.067, 0));
  const rearRing = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0055, 8, 18), M.sight.clone());
  rearRing.position.set(-0.145, 0.101, 0);
  rearRing.rotation.y = Math.PI / 2;
  rearRing.castShadow = true;
  receiver.add(rearRing);
  // detalhe inferior (housing do gatilho)
  receiver.add(mesh(new THREE.BoxGeometry(0.15, 0.022, 0.082), M.darkSteel, -0.02, -0.052, 0));
  // pino de articulação
  receiver.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.104, 10), M.darkSteel, 0.12, -0.03, 0, Math.PI / 2, 0, 0));
  rifle.add(receiver);

  /* ---------- 7.2 CANO (removível — requer handguard removido) ---------- */
  const barrel = new THREE.Group();
  // cano principal
  barrel.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.52, 18), M.steel, 0.44, 0.012, 0, 0, 0, Math.PI / 2));
  // freio de boca
  barrel.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.062, 18), M.darkSteel, 0.676, 0.012, 0, 0, 0, Math.PI / 2));
  // bloco de gás
  barrel.add(mesh(new THREE.BoxGeometry(0.062, 0.056, 0.056), M.darkSteel, 0.56, 0.014, 0));
  // tubo de gás (componente interno simplificado — visível com o handguard removido)
  barrel.add(mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.30, 10), M.brass, 0.335, 0.032, 0, 0, 0, Math.PI / 2));
  // massa de mira frontal
  barrel.add(mesh(new THREE.BoxGeometry(0.018, 0.052, 0.018), M.sight, 0.56, 0.058, 0));
  const frontRing = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0042, 8, 16), M.sight.clone());
  frontRing.position.set(0.56, 0.090, 0);
  frontRing.rotation.y = Math.PI / 2;
  frontRing.castShadow = true;
  barrel.add(frontRing);
  rifle.add(barrel);

  /* ---------- 7.3 GUARDA-MÃO (removível) ---------- */
  const handguard = new THREE.Group();
  handguard.add(mesh(new THREE.BoxGeometry(0.30, 0.080, 0.088), M.polymer, 0.33, -0.004, 0));
  // trilho inferior
  handguard.add(mesh(new THREE.BoxGeometry(0.30, 0.012, 0.020), M.darkSteel, 0.33, -0.048, 0));
  // tampa frontal
  handguard.add(mesh(new THREE.BoxGeometry(0.022, 0.090, 0.096), M.darkSteel, 0.478, -0.004, 0));
  // fendas laterais
  for (let i = 0; i < 4; i++) {
    handguard.add(mesh(new THREE.BoxGeometry(0.020, 0.040, 0.0915), M.black, 0.235 + i * 0.062, 0.006, 0));
  }
  rifle.add(handguard);

  /* ---------- 7.4 CORONHA (removível) ---------- */
  const stock = new THREE.Group();
  stock.add(mesh(new THREE.BoxGeometry(0.34, 0.100, 0.075), M.polymer, -0.35, -0.012, 0));
  // apoio de bochecha
  stock.add(mesh(new THREE.BoxGeometry(0.185, 0.036, 0.070), M.polymer, -0.400, 0.050, 0));
  // borracha de culatra
  stock.add(mesh(new THREE.BoxGeometry(0.034, 0.132, 0.086), M.black, -0.527, -0.015, 0));
  // tubo de conexão
  stock.add(mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.10, 12), M.darkSteel, -0.20, -0.010, 0, 0, 0, Math.PI / 2));
  rifle.add(stock);

  /* ---------- 7.5 CONJUNTO DO GATILHO (removível) ---------- */
  const triggerGroup = new THREE.Group();
  // empunhadura
  const grip = mesh(new THREE.BoxGeometry(0.055, 0.150, 0.070), M.polymer, -0.055, -0.115, 0, 0, 0, -0.18);
  triggerGroup.add(grip);
  // guarda do gatilho
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.100, 0.008, 0.028), M.darkSteel, -0.025, -0.086, 0));
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.008, 0.050, 0.028), M.darkSteel, 0.025, -0.062, 0));
  // gatilho
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.012, 0.050, 0.022), M.accent, -0.020, -0.062, 0, 0, 0, 0.12));
  // martelo interno simplificado
  triggerGroup.add(mesh(new THREE.BoxGeometry(0.020, 0.058, 0.030), M.steel, -0.062, -0.048, 0, 0, 0, -0.20));
  rifle.add(triggerGroup);

  /* ---------- 7.6 CARREGADOR (removível, animado) ---------- */
  const magazine = new THREE.Group();
  magazine.position.set(0.070, -0.045, 0);
  magazine.rotation.z = 0.08;
  magazine.add(mesh(new THREE.BoxGeometry(0.055, 0.200, 0.080), M.polymer, 0, -0.100, 0));
  magazine.add(mesh(new THREE.BoxGeometry(0.062, 0.014, 0.088), M.darkSteel, 0, -0.205, 0));
  magazine.add(mesh(new THREE.BoxGeometry(0.058, 0.028, 0.084), M.darkSteel, 0, -0.020, 0));
  // munição visível no topo
  magazine.add(mesh(new THREE.BoxGeometry(0.014, 0.020, 0.060), M.brass, 0, 0.012, 0));
  rifle.add(magazine);

  /* ---------- 7.7 FERROLHO (removível + animação de blowback) ---------- */
  const bolt = new THREE.Group();
  bolt.position.set(0, 0.073, 0);
  bolt.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.20, 18), M.darkSteel, 0, 0, 0, 0, 0, Math.PI / 2));
  // cabeça do ferrolho
  bolt.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.032, 14), M.steel, 0.112, 0, 0, 0, 0, Math.PI / 2));
  // alavanca de manejo
  bolt.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.062, 10), M.steel, 0.055, 0, 0.046, Math.PI / 2, 0, 0));
  const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.017, 14, 12), M.accent.clone());
  boltKnob.position.set(0.055, 0, 0.079);
  boltKnob.castShadow = true;
  bolt.add(boltKnob);
  rifle.add(bolt);

  /* ---------- 7.8 BOTÃO DE LIBERAÇÃO DO CARREGADOR ---------- */
  const magRelease = new THREE.Group();
  magRelease.add(mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.024, 14), M.accent, 0.132, -0.020, 0.056, Math.PI / 2, 0, 0));
  magRelease.add(mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 14), M.darkSteel, 0.132, -0.020, 0.045, Math.PI / 2, 0, 0));
  rifle.add(magRelease);

  /* ---------- 13. MUZZLE FLASH E POINT LIGHT (ORIGINAIS) ---------- */
  const MUZZLE_LOCAL = new THREE.Vector3(0.715, 0.012, 0);

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
  muzzleLight.position.set(0.78, 0.02, 0);
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
    physics
  };
}
