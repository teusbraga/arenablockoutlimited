import * as THREE from 'three';

/* ============================================================
   TEXTURAS
   ============================================================ */

function makeGlowTexture() {
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

const GLOW_TEX = makeGlowTexture();

/* ============================================================
   MATERIAIS COMPARTILHADOS (ZERO CLONE)
   ============================================================ */

const M = {
  steel:       new THREE.MeshStandardMaterial({ color: 0x828a92, metalness: 0.90, roughness: 0.35 }),
  darkSteel:   new THREE.MeshStandardMaterial({ color: 0x242628, metalness: 0.85, roughness: 0.45 }),
  receiver:    new THREE.MeshStandardMaterial({ color: 0x222426, metalness: 0.88, roughness: 0.40 }),
  black:       new THREE.MeshStandardMaterial({ color: 0x181a1c, metalness: 0.40, roughness: 0.70 }),
  polymer:     new THREE.MeshStandardMaterial({ color: 0x282c30, metalness: 0.20, roughness: 0.80 }),
  wood:        new THREE.MeshStandardMaterial({ color: 0x472f1b, metalness: 0.05, roughness: 0.85 }),
  lightWood:   new THREE.MeshStandardMaterial({ color: 0x5a3e26, metalness: 0.05, roughness: 0.80 }),
  accent:      new THREE.MeshStandardMaterial({ color: 0xa4aeb5, metalness: 0.95, roughness: 0.25 }),
  sightBody:   new THREE.MeshStandardMaterial({ color: 0x2a3035, metalness: 0.85, roughness: 0.45 }),
  brass:       new THREE.MeshStandardMaterial({ color: 0xb5924a, metalness: 0.90, roughness: 0.35 }),
  glass:       new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.10, metalness: 0.90 }),
  glow:        new THREE.MeshBasicMaterial({ color: 0xffffff })
};

function mesh(geo, material, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(px, py, pz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* ============================================================
   FÍSICA DA VSS
   ============================================================ */

class VSSPhysics {
  constructor(rifle, bolt, flashObj) {
    this.rifle = rifle;
    this.bolt = bolt;
    this.flashObj = flashObj;
    this.recoil = 0;
    this.shake = 0;
    this.boltCycle = 1;
    this.boltOpen = false;
    this.boltOpenAmt = 0;
    this.closeDelay = 0;
    this.flashTimer = 0;
  }

  onFire(ammo = 20) {
    this.boltCycle = 0;
    if (ammo <= 0) {
      this.boltOpen = true;
      this.closeDelay = 0.20;
    } else {
      this.boltOpen = false;
      this.closeDelay = 0;
    }
    this.recoil = Math.min(this.recoil + 0.35, 1.0);
    this.shake = Math.min(this.shake + 0.65, 1.2);
    this.flashTimer = 0.055;
    
    // Muzzle Flash
    const { muzzleFlash, muzzleFlash2, muzzleLight } = this.flashObj;
    muzzleFlash.visible = true;
    muzzleFlash2.visible = true;
    const sc = 0.6 + Math.random() * 0.5;
    muzzleFlash.scale.setScalar(sc);
    muzzleFlash2.scale.setScalar(sc * 0.85);
    muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    muzzleFlash2.rotation.z = Math.random() * Math.PI * 2;
    muzzleLight.intensity = 10;
  }

  onReload() {
    if (this.boltOpen) {
      this.closeDelay = 0.20;
    }
  }

  update(dt, camera, ammo = 20) {
    if (ammo <= 0 && !this.boltOpen) {
      this.boltOpen = true;
      this.closeDelay = 0.20;
    }
    if (this.boltOpen && ammo > 0) {
      if (this.closeDelay > 0) {
        this.closeDelay -= dt;
      } else {
        this.boltOpen = false;
      }
    }

    // Ferrolho
    if (this.boltCycle < 1) {
      this.boltCycle = Math.min(1, this.boltCycle + dt / 0.085);
    }
    const targetOpen = this.boltOpen ? 1 : 0;
    this.boltOpenAmt += (targetOpen - this.boltOpenAmt) * (1 - Math.exp(-dt * 16));
    const cycleOff = this.boltCycle < 1 ? 0.08 * Math.sin(Math.PI * this.boltCycle) : 0;
    const openOff = 0.08 * this.boltOpenAmt;
    // O ferrolho recua em +Z local no receiver do VSS
    this.bolt.position.z = Math.max(cycleOff, openOff);

    // Recoil (VSS tem recuo suave)
    const recoilDecay = 1 - Math.exp(-dt * 7.5);
    this.recoil += (0 - this.recoil) * recoilDecay;
    this.shake += (0 - this.shake) * (1 - Math.exp(-dt * 10));
    
    const r = this.recoil;
    this.rifle.position.x = -r * 0.012;
    this.rifle.position.y = r * 0.008;
    this.rifle.position.z = r * 0.02; // Kickback suave
    this.rifle.rotation.x = r * 0.04;
    this.rifle.rotation.y = r * 0.008;
    
    // Muzzle flash fade
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(this.flashTimer / 0.055, 0);
      this.flashObj.flashMat.opacity = k * 0.85;
      this.flashObj.muzzleLight.intensity = 10 * k;
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
   CONSTRUÇÃO DA VSS VINTOREZ
   ============================================================ */

export function buildVSS() {
  const root = new THREE.Group();
  
  // Pivot 
  const pivot = new THREE.Group();
  root.add(pivot);

  const rifle = new THREE.Group();
  pivot.add(rifle);

  /* ---------- 1. RECEIVER MILLED ---------- */
  const receiver = new THREE.Group();
  
  // Corpo base
  receiver.add(mesh(new THREE.BoxGeometry(0.038, 0.058, 0.18), M.receiver, 0, 0, 0.02));
  // Dust cover superior redondo
  receiver.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 12), M.receiver, 0, 0.025, 0.02, Math.PI / 2, 0, 0));
  
  // Detalhes laterais (Stamped indentations)
  receiver.add(mesh(new THREE.BoxGeometry(0.04, 0.012, 0.12), M.darkSteel, 0, -0.01, 0.02));
  
  // Seletor de disparo AK-style (Lado Direito)
  receiver.add(mesh(new THREE.BoxGeometry(0.004, 0.045, 0.008), M.darkSteel, 0.02, -0.005, 0.04, 0, 0, 0.3));

  // Magwell base
  receiver.add(mesh(new THREE.BoxGeometry(0.036, 0.02, 0.06), M.receiver, 0, -0.035, -0.04));

  rifle.add(receiver);

  /* ---------- 2. CONJUNTO DO FERROLHO (BOLT) ---------- */
  const bolt = new THREE.Group();
  // Ferrolho exposto no lado direito e cima
  bolt.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.11, 10), M.accent, 0.005, 0.015, -0.02, Math.PI / 2, 0, 0));
  // Alavanca de manejo direita
  bolt.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.028, 8), M.accent, 0.028, 0.015, -0.01, 0, 0, Math.PI / 2));
  
  rifle.add(bolt);

  /* ---------- 3. CORONHA VAZADA (THUMBHOLE WOOD STOCK) ---------- */
  const stock = new THREE.Group();
  
  // Grip curvo
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.10, 0.045), M.wood, 0, -0.05, 0.08, -0.22, 0, 0));
  
  // Base inferior da coronha
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.025, 0.16), M.wood, 0, -0.09, 0.18, 0.12, 0, 0));
  
  // Ponte superior (Cheek rest area)
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.035, 0.18), M.wood, 0, -0.005, 0.18, -0.04, 0, 0));
  stock.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 8), M.wood, 0, 0.012, 0.18, Math.PI / 2, 0, 0)); // Cheek rest redondo
  
  // Traseira unindo base e topo
  stock.add(mesh(new THREE.BoxGeometry(0.028, 0.11, 0.035), M.wood, 0, -0.04, 0.25, -0.06, 0, 0));
  
  // Soleira de Borracha grossa
  stock.add(mesh(new THREE.BoxGeometry(0.030, 0.115, 0.016), M.polymer, 0, -0.04, 0.27, -0.06, 0, 0));
  
  // Guarda-mato e Gatilho metálico
  stock.add(mesh(new THREE.BoxGeometry(0.004, 0.03, 0.008), M.accent, 0, -0.035, 0.03, -0.15, 0, 0)); // Gatilho
  stock.add(mesh(new THREE.BoxGeometry(0.006, 0.006, 0.075), M.darkSteel, 0, -0.065, 0.04)); // Guarda-mato inferior
  stock.add(mesh(new THREE.BoxGeometry(0.006, 0.03, 0.006), M.darkSteel, 0, -0.055, 0.075, 0.2, 0, 0)); // Guarda-mato traseiro

  rifle.add(stock);

  /* ---------- 4. GUARDA-MÃO DE POLÍMERO (Handguard) ---------- */
  const handguard = new THREE.Group();
  // VSS tem um handguard curto antes do silenciador
  handguard.add(mesh(new THREE.BoxGeometry(0.036, 0.045, 0.08), M.polymer, 0, 0.002, -0.11));
  // Ranhuras de grip laterais (detalhe)
  for (let i = 0; i < 3; i++) {
    handguard.add(mesh(new THREE.BoxGeometry(0.04, 0.03, 0.006), M.black, 0, 0.002, -0.09 - i * 0.015));
  }
  rifle.add(handguard);

  /* ---------- 5. SUPRESSOR INTEGRADO ENORME ---------- */
  const barrel = new THREE.Group();
  
  // Tubo Gigante
  barrel.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.54, 16), M.darkSteel, 0, 0.012, -0.42, Math.PI / 2, 0, 0));
  
  // Base knurled texturizada do supressor
  barrel.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 18), M.black, 0, 0.012, -0.16, Math.PI / 2, 0, 0));

  // Bloco da Alça de Mira Traseira no supressor
  barrel.add(mesh(new THREE.BoxGeometry(0.016, 0.02, 0.05), M.darkSteel, 0, 0.035, -0.18, 0.05, 0, 0));
  
  // Bloco da Massa de Mira Frontal (Iron sight na ponta)
  barrel.add(mesh(new THREE.BoxGeometry(0.012, 0.028, 0.02), M.darkSteel, 0, 0.036, -0.66));
  barrel.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.015, 6), M.black, 0, 0.048, -0.66, 0, 0, 0));

  rifle.add(barrel);

  /* ---------- 6. LANTERNA TÁTICA (WOG REF) ---------- */
  const flashlight = new THREE.Group();
  flashlight.position.set(0, -0.04, -0.42);

  // Bracket de montagem abraçando o supressor
  flashlight.add(mesh(new THREE.BoxGeometry(0.012, 0.035, 0.025), M.darkSteel, 0, 0.025, 0));
  
  // Corpo da lanterna
  flashlight.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 14), M.polymer, 0, 0, 0, Math.PI / 2, 0, 0));
  
  // Bezel Frontal
  flashlight.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16), M.black, 0, 0, -0.065, Math.PI / 2, 0, 0));
  
  // Lente Emissora Branca
  flashlight.add(mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.004, 12), M.glow, 0, 0, -0.075, Math.PI / 2, 0, 0));

  // Tampa Traseira com Fio
  flashlight.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.015, 12), M.black, 0, 0, 0.065, Math.PI / 2, 0, 0));

  rifle.add(flashlight);

  /* ---------- 7. CARREGADOR (Magazine 9x39mm) ---------- */
  const magazine = new THREE.Group();
  magazine.position.set(0, -0.06, -0.04);
  magazine.rotation.x = 0.15; // Curvado para a frente levemente
  
  // Corpo principal do Mag
  magazine.add(mesh(new THREE.BoxGeometry(0.03, 0.11, 0.06), M.polymer, 0, -0.05, 0));
  // Ranhuras horizontais
  for (let i = 0; i < 4; i++) {
    magazine.add(mesh(new THREE.BoxGeometry(0.032, 0.006, 0.045), M.black, 0, -0.025 - i * 0.02, 0));
  }
  
  rifle.add(magazine);

  /* ---------- 8. ÓPTICA TÁTICA PSO-1 ---------- */
  // O opticGroup permanece RIGIDAMENTE nos offsets da sightLocal do weapon.json
  const opticGroup = new THREE.Group();
  // weapon.json: sightLocal: [-0.015, 0.05, 0.131]
  opticGroup.position.set(-0.015, 0.05, -0.02);

  // SUPORTE LATERAL (Left side rail mount)
  // Conecta o corpo do opticGroup ao receiver (que está em x=0)
  opticGroup.add(mesh(new THREE.BoxGeometry(0.012, 0.08, 0.08), M.darkSteel, 0, -0.04, 0.05));
  opticGroup.add(mesh(new THREE.BoxGeometry(0.016, 0.015, 0.12), M.sightBody, 0.005, -0.075, 0.05));

  // TUBO PRINCIPAL
  const tubeGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.22, 14);
  opticGroup.add(mesh(tubeGeo, M.sightBody, 0, 0, 0, Math.PI / 2, 0, 0));

  // BELL FRONTAL (Objetiva)
  const bellGeo = new THREE.CylinderGeometry(0.024, 0.014, 0.05, 14);
  opticGroup.add(mesh(bellGeo, M.sightBody, 0, 0, -0.135, Math.PI / 2, 0, 0));

  // SUNSHADE FRONTAL (Cilíndro na ponta)
  opticGroup.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.04, 14), M.sightBody, 0, 0, -0.18, Math.PI / 2, 0, 0));

  // BELL TRASEIRA (Ocular)
  const ocularGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.05, 14);
  opticGroup.add(mesh(ocularGeo, M.sightBody, 0, 0, 0.135, Math.PI / 2, 0, 0));

  // CONJUNTO DE TORRETAS
  const turretBase = mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), M.sightBody, 0, 0, -0.02);
  opticGroup.add(turretBase);
  // Torre de elevação (Topo)
  opticGroup.add(mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.018, 12), M.black, 0, 0.024, -0.02));
  opticGroup.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.015, 10), M.accent, 0, 0.036, -0.02));
  // Torre lateral (Vento)
  opticGroup.add(mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.018, 12), M.black, -0.024, 0, -0.02, 0, 0, Math.PI / 2));
  
  // Tampa da Iluminação do Retículo (Embaixo)
  opticGroup.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 10), M.darkSteel, 0.02, -0.015, 0, 0, 0, Math.PI / 4));

  // --- LENTES PARA RENDERTARGET (Exatamente nos offsets necessários) ---
  const rearLensMat = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Placeholder Target
  
  // REAR LENS (Global localZ do sight: -0.02 + 0.151 = 0.131 => Bate Exato com weapon.json sightLocal[2]!)
  const rearLens = mesh(new THREE.CircleGeometry(0.016, 24), rearLensMat, 0, 0, 0.151);
  opticGroup.add(rearLens);

  // FRONT LENS (Frontal puramente estética, voltada pra fora)
  const frontLens = mesh(new THREE.CircleGeometry(0.022, 16), M.glass, 0, 0, -0.198, 0, Math.PI, 0);
  opticGroup.add(frontLens);

  // RUBBER EYECUP OCO (Torus) - Evita clipagem com a câmera 
  // O olho na ADS fica recuado 0.065 atrás dessa rearLens, então não clippará.
  opticGroup.add(mesh(new THREE.TorusGeometry(0.018, 0.002, 8, 16), M.black, 0, 0, 0.158));

  rifle.add(opticGroup);

  /* ---------- 9. MUZZLE FLASH E LUZES ---------- */
  const MUZZLE_LOCAL = new THREE.Vector3(0, 0.012, -0.70);

  const flashMat = new THREE.MeshBasicMaterial({
    map: GLOW_TEX,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: 0xffd88a
  });
  const muzzleFlash = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), flashMat);
  muzzleFlash.position.copy(MUZZLE_LOCAL);
  muzzleFlash.visible = false;
  rifle.add(muzzleFlash);

  const muzzleFlash2 = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), flashMat);
  muzzleFlash2.position.copy(MUZZLE_LOCAL);
  muzzleFlash2.rotation.x = Math.PI / 2;
  muzzleFlash2.visible = false;
  rifle.add(muzzleFlash2);

  const muzzleLight = new THREE.PointLight(0xff9922, 0, 1.2, 2.0);
  muzzleLight.position.set(0, 0.02, -0.68);
  rifle.add(muzzleLight);

  const physics = new VSSPhysics(rifle, bolt, {
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
    details: {
      opticBody: tubeGeo, // apenas p n falhar caso peçam 
      rearLens: rearLens,
      frontLens: frontLens
    }
  };
}
