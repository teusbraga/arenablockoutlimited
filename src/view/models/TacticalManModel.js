import * as THREE from 'three';

const H = 1.75;
const k = 0.01;
const TAU = Math.PI * 2;

// ═══════════════════════════════════════════════════════════════════════════
// ÁLGEBRA VETORIAL & MATEMÁTICA PROCEDURAL (Gabriel Lamé & Lofts)
// ═══════════════════════════════════════════════════════════════════════════
const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const mul = (p, s) => [p[0] * s, p[1] * s, p[2] * s];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross = (p, q) => [
  p[1] * q[2] - p[2] * q[1],
  p[2] * q[0] - p[0] * q[2],
  p[0] * q[1] - p[1] * q[0]
];
const norm = (p) => {
  const l = Math.hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / l, p[1] / l, p[2] / l];
};

function superRing(a, b, n, segments) {
  const e = 2 / n;
  const out = [];
  for (let kIdx = 0; kIdx < segments; kIdx++) {
    const th = (TAU * kIdx) / segments;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const px = Math.sign(c) * Math.pow(Math.abs(c), e) * a;
    const pz = Math.sign(s) * Math.pow(Math.abs(s), e) * b;
    out.push([px, pz]);
  }
  return out;
}

function makeSections({ start, dir, length, profile, rings = 8, segments = 20, hint = [0, 1, 0] }) {
  const d = norm(dir);
  let up = hint;
  if (Math.abs(dot(up, d)) > 0.95) {
    up = Math.abs(d[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  }
  const r = norm(cross(up, d));
  const u = cross(d, r);

  const sections = [];
  for (let s = 0; s < rings; s++) {
    const t = s / (rings - 1);
    let p0 = profile[0];
    let p1 = profile[profile.length - 1];
    for (let i = 0; i < profile.length - 1; i++) {
      if (t >= profile[i].t && t <= profile[i + 1].t) {
        p0 = profile[i];
        p1 = profile[i + 1];
        break;
      }
    }
    const span = p1.t - p0.t || 1e-4;
    const f = (t - p0.t) / span;
    const a = (p0.a + (p1.a - p0.a) * f) * k;
    const b = (p0.b + (p1.b - p0.b) * f) * k;
    const n = p0.n + (p1.n - p0.n) * f;
    const oz = ((p0.oz || 0) + ((p1.oz || 0) - (p0.oz || 0)) * f) * k;

    const center = add(start, mul(d, length * t));
    const offsetCenter = add(center, mul(Math.abs(d[1]) > 0.9 ? [0, 0, 1] : u, oz));

    const ring2D = superRing(a, b, n, segments);
    const sectionPts = ring2D.map(([px, pz]) => {
      return add(offsetCenter, add(mul(r, px), mul(u, pz)));
    });
    sections.push(sectionPts);
  }
  return sections;
}

function loftGeometry(T, sections, { capStart = true, capEnd = true } = {}) {
  const rings = sections.length;
  const segments = sections[0].length;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let r = 0; r < rings; r++) {
    const v = r / (rings - 1);
    for (let s = 0; s <= segments; s++) {
      const pt = sections[r][s % segments];
      positions.push(pt[0], pt[1], pt[2]);
      uvs.push(s / segments, v);
    }
  }

  const stride = segments + 1;
  for (let r = 0; r < rings - 1; r++) {
    const r0 = r * stride;
    const r1 = (r + 1) * stride;
    for (let s = 0; s < segments; s++) {
      indices.push(r0 + s, r1 + s, r0 + s + 1);
      indices.push(r0 + s + 1, r1 + s, r1 + s + 1);
    }
  }

  const addCap = (section, isEnd) => {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < segments; i++) {
      cx += section[i][0];
      cy += section[i][1];
      cz += section[i][2];
    }
    cx /= segments; cy /= segments; cz /= segments;
    const centerIdx = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, isEnd ? 1.0 : 0.0);

    const baseRingIdx = isEnd ? (rings - 1) * stride : 0;
    for (let s = 0; s < segments; s++) {
      const next = (s + 1);
      if (isEnd) indices.push(centerIdx, baseRingIdx + s, baseRingIdx + next);
      else indices.push(centerIdx, baseRingIdx + next, baseRingIdx + s);
    }
  };

  if (capStart) addCap(sections[0], false);
  if (capEnd) addCap(sections[sections.length - 1], true);

  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETAS TÁTICAS (MILITARES, ESPECIAIS & OPERADORES)
// ═══════════════════════════════════════════════════════════════════════════
export const TACTICAL_PALETTES = [
  {
    name: 'Woodland Green',
    uniform: 0x3d4a36,
    vest: 0x273322,
    vestBorder: 0x1e271a,
    pants: 0x344230,
    pads: 0x1e2224,
    boots: 0x191c1d,
    helmet: 0x2f3c2b,
    goggles: 0xf59e0b, // Âmbar tático
    balaclava: 0x22262a,
    skin: 0xd6997b
  },
  {
    name: 'Urban Slate',
    uniform: 0x424953,
    vest: 0x272c33,
    vestBorder: 0x1d2127,
    pants: 0x363d46,
    pads: 0x181a1d,
    boots: 0x141618,
    helmet: 0x343a42,
    goggles: 0x2563eb, // Azul cobalto tático
    balaclava: 0x1f2328,
    skin: 0xc98d70
  },
  {
    name: 'Desert Coyote',
    uniform: 0x827053,
    vest: 0x5a4c35,
    vestBorder: 0x463b27,
    pants: 0x736348,
    pads: 0x383226,
    boots: 0x383024,
    helmet: 0x6e5e43,
    goggles: 0xfbbf24, // Dourado solar
    balaclava: 0x383228,
    skin: 0xdea88d
  },
  {
    name: 'Spec-Ops Dark',
    uniform: 0x22262a,
    vest: 0x16181b,
    vestBorder: 0x111315,
    pants: 0x1e2226,
    pads: 0x0f1112,
    boots: 0x101112,
    helmet: 0x1a1d20,
    goggles: 0xef4444, // Infravermelho rubi
    balaclava: 0x131517,
    skin: 0xb57c63
  },
  {
    name: 'Mercenary Camo',
    uniform: 0x4f5344,
    vest: 0x393c31,
    vestBorder: 0x292b22,
    pants: 0x44483a,
    pads: 0x222625,
    boots: 0x1b1c1a,
    helmet: 0x3d4133,
    goggles: 0x10b981, // Visão noturna esmeralda
    balaclava: 0x222628,
    skin: 0xcfa082
  }
];

// Cache central de materiais compartilhados por paleta
const _materialsCache = [];

export function getTacticalMaterials(T = THREE, paletteIndex = 0) {
  const pIdx = Math.max(0, Math.min(paletteIndex, TACTICAL_PALETTES.length - 1));
  if (_materialsCache[pIdx]) return _materialsCache[pIdx];

  const pal = TACTICAL_PALETTES[pIdx];

  const mats = {
    uniformMat: new T.MeshStandardMaterial({ color: pal.uniform, roughness: 0.70, metalness: 0.08 }),
    vestMainMat: new T.MeshStandardMaterial({ color: pal.vest, roughness: 0.65, metalness: 0.12 }),
    vestBorderMat: new T.MeshStandardMaterial({ color: pal.vestBorder, roughness: 0.75, metalness: 0.10 }),
    vestStrapMat: new T.MeshStandardMaterial({ color: 0x1f2224, roughness: 0.85, metalness: 0.05 }),
    magPouchMat: new T.MeshStandardMaterial({ color: pal.vest, roughness: 0.60, metalness: 0.15 }),
    polymerHardPadMat: new T.MeshStandardMaterial({ color: pal.pads, roughness: 0.45, metalness: 0.35 }),
    buckleMetalMat: new T.MeshStandardMaterial({ color: 0x161819, roughness: 0.30, metalness: 0.85 }),
    patchVelcroMat: new T.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.90, metalness: 0.02 }),
    darkTacticalGreyMat: new T.MeshStandardMaterial({ color: 0x262a2e, roughness: 0.60, metalness: 0.15 }),
    tacticalBootLeatherMat: new T.MeshStandardMaterial({ color: pal.boots, roughness: 0.70, metalness: 0.18 }),
    tacticalBootSoleMat: new T.MeshStandardMaterial({ color: 0x111314, roughness: 0.85, metalness: 0.25 }),
    skinMat: new T.MeshStandardMaterial({ color: pal.skin, roughness: 0.65, metalness: 0.04 }),
    faceMat: new T.MeshStandardMaterial({ color: pal.skin, roughness: 0.60, metalness: 0.05 }),
    helmetMat: new T.MeshStandardMaterial({ color: pal.helmet, roughness: 0.50, metalness: 0.22 }),
    balaclavaMat: new T.MeshStandardMaterial({ color: pal.balaclava, roughness: 0.85, metalness: 0.04 }),
    goggleLensMat: new T.MeshStandardMaterial({
      color: pal.goggles,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88
    }),
    goggleFrameMat: new T.MeshStandardMaterial({ color: 0x121416, roughness: 0.40, metalness: 0.50 }),
    hairMat: new T.MeshStandardMaterial({ color: 0x1c1714, roughness: 0.85, metalness: 0.05 }),
    gunMat: new T.MeshStandardMaterial({ color: 0x22252a, roughness: 0.40, metalness: 0.75 }),
    gunDarkMat: new T.MeshStandardMaterial({ color: 0x141618, roughness: 0.50, metalness: 0.60 })
  };

  // Tenta criar textura procedural de rosto e hair cards se estiver em ambiente DOM
  if (typeof document !== 'undefined' && document.createElement) {
    try {
      const faceCanvas = document.createElement('canvas');
      faceCanvas.width = faceCanvas.height = 256;
      const ctx = faceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#' + pal.skin.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 256, 256);
        // Barba rala tática sombreada
        ctx.fillStyle = 'rgba(25, 20, 18, 0.18)';
        ctx.fillRect(40, 160, 176, 85);
        // Sobrancelhas e olhos
        ctx.fillStyle = '#1c1714';
        ctx.fillRect(60, 85, 45, 12);
        ctx.fillRect(151, 85, 45, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(68, 105, 32, 14);
        ctx.fillRect(156, 105, 32, 14);
        ctx.fillStyle = '#223344';
        ctx.fillRect(80, 106, 15, 12);
        ctx.fillRect(168, 106, 15, 12);

        const faceTex = new T.CanvasTexture(faceCanvas);
        faceTex.colorSpace = T.SRGBColorSpace;
        mats.faceMat.map = faceTex;
        mats.faceMat.needsUpdate = true;
      }
    } catch {
      // Fallback seguro em caso de restrição de canvas
    }
  }

  for (const k in mats) {
    mats[k].userData = { isShared: true };
  }

  _materialsCache[pIdx] = mats;
  return mats;
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE CENTRAL DE GEOMETRIAS (COMPUTADAS UMA VEZ PARA TODAS AS INSTÂNCIAS)
// ═══════════════════════════════════════════════════════════════════════════
let _geoCache = null;

export function getSharedGeometries(T = THREE) {
  if (_geoCache) return _geoCache;

  // 1. Tronco & Colete
  const waistY = 0.0;
  const torsoLen = (0.842 - 0.528) * H;
  const torsoProfile = [
    { t: 0.00, a: 17.0, b: 11.6, n: 2.2, oz: -0.3 },
    { t: 0.12, a: 16.4, b: 11.0, n: 2.2, oz: -0.2 },
    { t: 0.30, a: 16.2, b: 10.8, n: 2.2, oz: -0.1 },
    { t: 0.50, a: 18.2, b: 12.4, n: 2.4, oz: 0.3 },
    { t: 0.68, a: 20.4, b: 14.0, n: 2.5, oz: 0.7 },
    { t: 0.80, a: 20.2, b: 13.0, n: 2.4, oz: 0.3 },
    { t: 0.88, a: 17.6, b: 11.6, n: 2.3, oz: 0.1 },
    { t: 0.95, a: 13.0, b: 10.0, n: 2.2, oz: 0.2 },
    { t: 1.00, a: 8.4,  b: 8.2,  n: 2.2, oz: 0.3 }
  ];
  const torsoSecs = makeSections({
    start: [0, waistY, 0],
    dir: [0, 1, 0],
    length: torsoLen,
    profile: torsoProfile,
    rings: 12,
    segments: 20
  });
  const torsoGeo = loftGeometry(T, torsoSecs, { capStart: true, capEnd: false });

  // Placa frontal do colete SAPI
  const vestFrontProfile = [
    { t: 0.00, a: 17.2, b: 7.6, n: 2.4, oz: 8.8 },
    { t: 0.25, a: 17.6, b: 8.0, n: 2.4, oz: 9.2 },
    { t: 0.55, a: 18.2, b: 8.6, n: 2.5, oz: 10.0 },
    { t: 0.82, a: 17.0, b: 8.4, n: 2.5, oz: 9.6 },
    { t: 1.00, a: 13.6, b: 7.4, n: 2.3, oz: 8.5 }
  ];
  const vestFrontSecs = makeSections({
    start: [0, waistY + 0.055, 0],
    dir: [0, 1, 0],
    length: torsoLen * 0.68,
    profile: vestFrontProfile,
    rings: 8,
    segments: 18
  });
  const vestFrontGeo = loftGeometry(T, vestFrontSecs, { capStart: true, capEnd: true });

  // Placa traseira do colete
  const vestBackProfile = [
    { t: 0.00, a: 16.8, b: 7.2, n: 2.3, oz: -8.4 },
    { t: 0.30, a: 17.4, b: 7.6, n: 2.4, oz: -8.8 },
    { t: 0.65, a: 18.0, b: 8.0, n: 2.4, oz: -9.0 },
    { t: 1.00, a: 13.8, b: 7.0, n: 2.2, oz: -8.0 }
  ];
  const vestBackSecs = makeSections({
    start: [0, waistY + 0.065, 0],
    dir: [0, 1, 0],
    length: torsoLen * 0.66,
    profile: vestBackProfile,
    rings: 6,
    segments: 16
  });
  const vestBackGeo = loftGeometry(T, vestBackSecs, { capStart: true, capEnd: true });

  // 2. Pescoço & Cabeça
  const neckProfile = [
    { t: 0.00, a: 7.8, b: 7.6, n: 2.2, oz: 0.0 },
    { t: 0.50, a: 6.8, b: 6.8, n: 2.2, oz: 0.2 },
    { t: 1.00, a: 6.2, b: 6.4, n: 2.2, oz: 0.3 }
  ];
  const neckSecs = makeSections({
    start: [0, 0, 0],
    dir: [0, 1, 0],
    length: 0.088,
    profile: neckProfile,
    rings: 4,
    segments: 16
  });
  const neckGeo = loftGeometry(T, neckSecs, { capStart: false, capEnd: false });

  // Cabeça Gabriel Lamé
  const headH = 0.130 * H;
  const headRings = [
    { t: -0.06, a: 4.0, b: 4.8, n: 2.2, oz: 1.6 },
    { t: 0.00,  a: 3.8, b: 5.2, n: 2.4, oz: 2.5 },
    { t: 0.08,  a: 5.4, b: 6.2, n: 2.4, oz: 2.3 },
    { t: 0.16,  a: 6.4, b: 7.0, n: 2.3, oz: 1.7 },
    { t: 0.24,  a: 6.9, b: 7.6, n: 2.3, oz: 1.3 },
    { t: 0.36,  a: 7.4, b: 8.2, n: 2.3, oz: 0.9 },
    { t: 0.46,  a: 7.5, b: 8.4, n: 2.2, oz: 0.4 },
    { t: 0.54,  a: 7.4, b: 8.4, n: 2.2, oz: 0.1 },
    { t: 0.64,  a: 7.2, b: 8.2, n: 2.2, oz: -0.1 },
    { t: 0.72,  a: 7.0, b: 8.0, n: 2.1, oz: -0.3 },
    { t: 0.84,  a: 6.6, b: 7.6, n: 2.1, oz: -0.5 },
    { t: 0.94,  a: 5.2, b: 6.2, n: 2.0, oz: -0.6 },
    { t: 1.00,  a: 2.2, b: 2.8, n: 2.0, oz: -0.6 }
  ];
  const headSecs = [];
  for (const hr of headRings) {
    const y = hr.t * headH;
    const ring2D = superRing(hr.a * k, hr.b * k, hr.n, 20);
    headSecs.push(ring2D.map(([px, pz]) => [px, y, pz + hr.oz * k]));
  }
  const headGeo = loftGeometry(T, headSecs, { capStart: true, capEnd: true });

  // 3. Braço Superior & Antebraço
  const upperArmProfile = [
    { t: 0.00, a: 6.0, b: 6.2, n: 2.3 },
    { t: 0.45, a: 5.4, b: 5.6, n: 2.3 },
    { t: 1.00, a: 4.3, b: 4.4, n: 2.2 }
  ];
  const upperArmSecs = makeSections({
    start: [0, 0.02, 0],
    dir: [0, -1, 0],
    length: 0.30,
    profile: upperArmProfile,
    rings: 6,
    segments: 16
  });
  const upperArmGeo = loftGeometry(T, upperArmSecs, { capStart: false, capEnd: false });

  const forearmProfile = [
    { t: 0.00, a: 4.4, b: 4.4, n: 2.2 },
    { t: 0.30, a: 4.7, b: 4.5, n: 2.3 },
    { t: 0.65, a: 3.9, b: 3.6, n: 2.2 },
    { t: 1.00, a: 3.0, b: 2.4, n: 2.0 }
  ];
  const forearmSecs = makeSections({
    start: [0, 0.015, 0],
    dir: [0, -1, 0],
    length: 0.26,
    profile: forearmProfile,
    rings: 6,
    segments: 16
  });
  const forearmGeo = loftGeometry(T, forearmSecs, { capStart: false, capEnd: false });

  // 4. Mão Orgânica
  const palmProfile = [
    { t: 0.00, a: 3.0, b: 2.4, n: 2.1, oz: 0.0 },
    { t: 0.50, a: 3.9, b: 1.9, n: 2.4, oz: 0.1 },
    { t: 1.00, a: 3.6, b: 1.4, n: 2.3, oz: 0.0 }
  ];
  const palmSecs = makeSections({
    start: [0, 0, 0],
    dir: [0, -1, 0],
    length: 0.09,
    profile: palmProfile,
    rings: 4,
    segments: 14
  });
  const palmGeo = loftGeometry(T, palmSecs, { capStart: false, capEnd: true });

  // Dedo e polegar
  const fingerSecs = makeSections({
    start: [0, 0, 0],
    dir: [0, -1, 0],
    length: 0.075,
    profile: [
      { t: 0.00, a: 0.9, b: 0.8, n: 2.1 },
      { t: 0.50, a: 0.95, b: 0.85, n: 2.1 },
      { t: 1.00, a: 0.5, b: 0.5, n: 2.0 }
    ],
    rings: 4,
    segments: 10
  });
  const fingerGeo = loftGeometry(T, fingerSecs, { capStart: false, capEnd: true });

  // 5. Pelve & Pernas
  const pelvisProfile = [
    { t: 0.00, a: 17.5, b: 11.5, n: 2.3, oz: -0.2 },
    { t: 0.50, a: 17.0, b: 11.3, n: 2.3, oz: -0.3 },
    { t: 1.00, a: 16.4, b: 10.9, n: 2.2, oz: -0.3 }
  ];
  const pelvisSecs = makeSections({
    start: [0, -0.090, 0],
    dir: [0, 1, 0],
    length: 0.090,
    profile: pelvisProfile,
    rings: 5,
    segments: 20
  });
  const pelvisGeo = loftGeometry(T, pelvisSecs, { capStart: false, capEnd: true });

  const thighProfile = [
    { t: 0.00, a: 9.1, b: 9.9, n: 2.3 },
    { t: 0.50, a: 8.4, b: 8.9, n: 2.3 },
    { t: 1.00, a: 6.8, b: 7.2, n: 2.2 }
  ];
  const thighSecs = makeSections({
    start: [0, 0.02, 0],
    dir: [0, -1, 0],
    length: 0.38,
    profile: thighProfile,
    rings: 6,
    segments: 16
  });
  const thighGeo = loftGeometry(T, thighSecs, { capStart: false, capEnd: false });

  const shinProfile = [
    { t: 0.00, a: 6.8, b: 7.2, n: 2.2 },
    { t: 0.50, a: 7.5, b: 7.4, n: 2.2 },
    { t: 1.00, a: 5.8, b: 5.8, n: 2.1 }
  ];
  const shinSecs = makeSections({
    start: [0, 0.02, 0],
    dir: [0, -1, 0],
    length: 0.36,
    profile: shinProfile,
    rings: 6,
    segments: 16
  });
  const shinGeo = loftGeometry(T, shinSecs, { capStart: false, capEnd: false });

  // 6. Bota Militar (Cabedal e Sola)
  const bootUpperProfile = [
    { t: 0.00, a: 3.8, b: 4.0, n: 2.2, oz: 1.0 },
    { t: 0.30, a: 4.6, b: 6.0, n: 2.2, oz: 1.5 },
    { t: 0.65, a: 5.0, b: 4.6, n: 2.3, oz: 0.8 },
    { t: 1.00, a: 3.2, b: 2.0, n: 2.2, oz: 0.0 }
  ];
  const bootUpperSecs = makeSections({
    start: [0, 0.04, -0.08],
    dir: [0, 0, 1],
    length: 0.25,
    profile: bootUpperProfile,
    rings: 6,
    segments: 16
  });
  const bootUpperGeo = loftGeometry(T, bootUpperSecs, { capStart: true, capEnd: true });

  const bootSoleGeo = new T.BoxGeometry(0.11, 0.04, 0.26);

  // 7. Acessórios de Cabeça (Capacete FAST, Óculos, Balaclava)
  // Capacete Balístico FAST Ops-Core
  const helmetProfiles = [
    { t: 0.00, a: 7.2, b: 8.6, n: 2.1, oz: -0.2 },
    { t: 0.40, a: 8.4, b: 9.6, n: 2.2, oz: -0.4 },
    { t: 0.80, a: 7.6, b: 8.8, n: 2.2, oz: -0.5 },
    { t: 1.00, a: 2.4, b: 3.0, n: 2.0, oz: -0.6 }
  ];
  const helmetSecs = makeSections({
    start: [0, 0.08, 0],
    dir: [0, 1, 0],
    length: 0.15,
    profile: helmetProfiles,
    rings: 5,
    segments: 18
  });
  const helmetGeo = loftGeometry(T, helmetSecs, { capStart: false, capEnd: true });

  // Balaclava tática (cobre da base até a altura dos olhos)
  const balaclavaProfile = [
    { t: 0.00, a: 5.6, b: 6.4, n: 2.2, oz: 1.2 },
    { t: 0.50, a: 7.0, b: 7.8, n: 2.3, oz: 0.8 },
    { t: 1.00, a: 7.4, b: 8.2, n: 2.3, oz: 0.4 }
  ];
  const balaclavaSecs = makeSections({
    start: [0, 0.01, 0],
    dir: [0, 1, 0],
    length: 0.12,
    profile: balaclavaProfile,
    rings: 4,
    segments: 18
  });
  const balaclavaGeo = loftGeometry(T, balaclavaSecs, { capStart: false, capEnd: false });

  // Armação e lente dos óculos táticos
  const goggleFrameGeo = new T.BoxGeometry(0.16, 0.048, 0.035);
  const goggleLensGeo = new T.BoxGeometry(0.146, 0.038, 0.016);
  const goggleStrapGeo = new T.CylinderGeometry(0.088, 0.088, 0.020, 16, 1, true);

  // Fone de comunicação tática (Earcups)
  const earCupGeo = new T.BoxGeometry(0.034, 0.055, 0.045);

  _geoCache = {
    torsoGeo,
    vestFrontGeo,
    vestBackGeo,
    neckGeo,
    headGeo,
    upperArmGeo,
    forearmGeo,
    palmGeo,
    fingerGeo,
    pelvisGeo,
    thighGeo,
    shinGeo,
    bootUpperGeo,
    bootSoleGeo,
    helmetGeo,
    balaclavaGeo,
    goggleFrameGeo,
    goggleLensGeo,
    goggleStrapGeo,
    earCupGeo
  };

  // Marca todas as geometrias do cache como compartilhadas
  for (const k in _geoCache) {
    _geoCache[k].userData = { isShared: true };
  }

  return _geoCache;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTAGEM DO PERSONAGEM COMPLETO COM MODULARIDADE DE ACESSÓRIOS DE CABEÇA
// ═══════════════════════════════════════════════════════════════════════════
export function createTacticalCharacter(T = THREE, options = {}) {
  const paletteIndex = options.paletteIndex !== undefined ? options.paletteIndex : (options.id ? (options.id - 1) : 0);
  const headVariant = options.headVariant !== undefined ? options.headVariant : (options.id ? (options.id - 1) % 5 : 0);
  const characterEntity = options.character || null;

  const mats = getTacticalMaterials(T, paletteIndex);
  const geos = getSharedGeometries(T);

  const rootGroup = new T.Group();
  rootGroup.name = 'TacticalSoldierRoot';

  // 1. Pelve
  const pelvis = new T.Group();
  pelvis.name = 'pelvis';
  pelvis.position.set(0, 0.545 * H, 0); // y ≈ 0.954m
  rootGroup.add(pelvis);

  const pelvisMesh = new T.Mesh(geos.pelvisGeo, mats.uniformMat);
  pelvisMesh.castShadow = true;
  pelvisMesh.userData = { type: 'character', character: characterEntity, bot: characterEntity, part: 'body' };
  pelvis.add(pelvisMesh);

  // Cinto Tático com Fivela Cobra
  const beltMesh = new T.Mesh(new T.CylinderGeometry(0.165, 0.165, 0.022, 20), mats.vestStrapMat);
  beltMesh.scale.set(1.0, 1.0, 0.70);
  const buckleMesh = new T.Mesh(new T.BoxGeometry(0.042, 0.026, 0.012), mats.buckleMetalMat);
  buckleMesh.position.set(0, 0, 0.082);
  pelvis.add(beltMesh, buckleMesh);

  // 2. Coluna e Tórax
  const spineLower = new T.Group();
  spineLower.name = 'spineLower';
  spineLower.position.set(0, 0.085, 0);
  pelvis.add(spineLower);

  const chest = new T.Group();
  chest.name = 'chest';
  chest.position.set(0, 0.110, 0);
  spineLower.add(chest);

  // Tronco e Colete Balístico
  const torsoMesh = new T.Mesh(geos.torsoGeo, mats.uniformMat);
  torsoMesh.position.set(0, -0.186, 0);
  torsoMesh.castShadow = true;
  torsoMesh.userData = { type: 'character', character: characterEntity, bot: characterEntity, part: 'body' };
  chest.add(torsoMesh);

  const vestFrontMesh = new T.Mesh(geos.vestFrontGeo, mats.vestMainMat);
  vestFrontMesh.position.set(0, -0.186, 0);
  vestFrontMesh.castShadow = true;
  chest.add(vestFrontMesh);

  const vestBackMesh = new T.Mesh(geos.vestBackGeo, mats.vestMainMat);
  vestBackMesh.position.set(0, -0.186, 0);
  vestBackMesh.castShadow = true;
  chest.add(vestBackMesh);

  // Porta-Carregadores Triplo Frontal
  for (let m = -1; m <= 1; m++) {
    const mag = new T.Mesh(new T.BoxGeometry(0.065, 0.120, 0.038), mats.magPouchMat);
    mag.position.set(m * 0.074, -0.040, 0.180);
    mag.castShadow = true;
    chest.add(mag);
  }

  // 3. Pescoço & Cabeça
  const neck = new T.Group();
  neck.name = 'neck';
  neck.position.set(0, 0.328, 0.005);
  chest.add(neck);

  const neckMesh = new T.Mesh(geos.neckGeo, mats.uniformMat);
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  const head = new T.Group();
  head.name = 'head';
  head.position.set(0, 0.084, 0.010);
  neck.add(head);

  const headMesh = new T.Mesh(geos.headGeo, mats.faceMat);
  headMesh.castShadow = true;
  headMesh.userData = { type: 'character', character: characterEntity, bot: characterEntity, part: 'head' };
  head.add(headMesh);

  // ═══════════════════════════════════════════════════════════════════════════
  // MODULARIDADE DE CABEÇA: 5 VARIANTES VISUAIS EXCLUSIVAS
  // ═══════════════════════════════════════════════════════════════════════════
  const headAccessories = new T.Group();
  headAccessories.name = 'headAccessories';
  head.add(headAccessories);

  const addGoggles = (yPos = 0.095, zPos = 0.082, angle = 0) => {
    const goggleGroup = new T.Group();
    goggleGroup.position.set(0, yPos, zPos);
    goggleGroup.rotation.x = angle;

    const frame = new T.Mesh(geos.goggleFrameGeo, mats.goggleFrameMat);
    const lens = new T.Mesh(geos.goggleLensGeo, mats.goggleLensMat);
    lens.position.z = 0.012;
    const strap = new T.Mesh(geos.goggleStrapGeo, mats.vestStrapMat);
    strap.rotation.x = Math.PI * 0.5;
    strap.position.z = -0.02;

    goggleGroup.add(frame, lens, strap);
    headAccessories.add(goggleGroup);
  };

  const addHelmet = () => {
    const helmetMesh = new T.Mesh(geos.helmetGeo, mats.helmetMat);
    helmetMesh.position.set(0, 0.005, -0.008);
    helmetMesh.castShadow = true;

    // NVG Shroud frontal e trilhos laterais ARC
    const nvgMount = new T.Mesh(new T.BoxGeometry(0.040, 0.042, 0.016), mats.buckleMetalMat);
    nvgMount.position.set(0, 0.165, 0.095);
    nvgMount.rotation.x = -0.15;
    helmetMesh.add(nvgMount);

    for (const s of [-1, 1]) {
      const rail = new T.Mesh(new T.BoxGeometry(0.016, 0.024, 0.085), mats.darkTacticalGreyMat);
      rail.position.set(s * 0.105, 0.130, -0.015);
      rail.rotation.y = s * 0.12;
      helmetMesh.add(rail);
    }
    headAccessories.add(helmetMesh);
  };

  const addBalaclava = () => {
    const bala = new T.Mesh(geos.balaclavaGeo, mats.balaclavaMat);
    bala.position.set(0, -0.005, 0.005);
    headAccessories.add(bala);
  };

  const addHeadset = () => {
    for (const s of [-1, 1]) {
      const ear = new T.Mesh(geos.earCupGeo, mats.darkTacticalGreyMat);
      ear.position.set(s * 0.095, 0.100, -0.015);
      headAccessories.add(ear);
    }
    // Microfone boom
    const mic = new T.Mesh(new T.CylinderGeometry(0.003, 0.003, 0.08, 6), mats.buckleMetalMat);
    mic.position.set(-0.085, 0.085, 0.035);
    mic.rotation.set(-0.4, 0.6, -0.2);
    headAccessories.add(mic);
  };

  const addTacticalCap = () => {
    const capDome = new T.Mesh(new T.SphereGeometry(0.088, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.uniformMat);
    capDome.position.set(0, 0.135, -0.005);
    // Aba do boné
    const visor = new T.Mesh(new T.BoxGeometry(0.125, 0.008, 0.075), mats.uniformMat);
    visor.position.set(0, 0.125, 0.105);
    visor.rotation.x = 0.12;
    capDome.add(visor);
    headAccessories.add(capDome);
  };

  const addCrewCutHair = () => {
    const hair = new T.Mesh(new T.SphereGeometry(0.084, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mats.hairMat);
    hair.position.set(0, 0.138, -0.008);
    hair.scale.set(1.0, 0.95, 1.05);
    headAccessories.add(hair);
  };

  switch (headVariant) {
    case 0:
      // Operador Tático: Corte militar + Óculos balísticos âmbar
      addCrewCutHair();
      addGoggles(0.098, 0.082, 0.0);
      break;
    case 1:
      // Assalto Pesado: Capacete FAST completo + Headset ComTac
      addHelmet();
      addHeadset();
      break;
    case 2:
      // Spec-Ops Infiltrador: Balaclava preta completa + Capacete FAST + Óculos escuros
      addBalaclava();
      addHelmet();
      addGoggles(0.098, 0.084, 0.0);
      break;
    case 3:
      // Scout / Recon: Boné tático com aba + Headset + Óculos de proteção
      addTacticalCap();
      addHeadset();
      addGoggles(0.096, 0.080, 0.0);
      break;
    case 4:
    default:
      // Fantasma / Mercenário: Máscara parcial + Cabelo militar + Óculos na testa
      addBalaclava();
      addCrewCutHair();
      addGoggles(0.155, 0.086, -0.35); // Óculos rebatidos para a testa
      break;
  }

  // Tagging de hitbox nos acessórios da cabeça
  headAccessories.traverse(o => {
    if (o.isMesh) {
      o.userData = { type: 'character', character: characterEntity, bot: characterEntity, part: 'head' };
    }
  });

  // 4. Membros Superiores (Braços Táticos)
  function buildArm(side) {
    const isLeft = side === 'left';
    const sgn = isLeft ? 1 : -1;
    const sideStr = isLeft ? 'Left' : 'Right';

    const shoulder = new T.Group();
    shoulder.name = `shoulder${sideStr}`;
    shoulder.position.set(sgn * 0.195, 0.210, 0.005);
    chest.add(shoulder);

    // Bulbo do deltoide
    const shoulderBulb = new T.Mesh(new T.SphereGeometry(0.065, 12, 10), mats.uniformMat);
    shoulderBulb.castShadow = true;
    shoulder.add(shoulderBulb);

    const upperArm = new T.Group();
    upperArm.name = `upperArm${sideStr}`;
    shoulder.add(upperArm);

    const upperArmMesh = new T.Mesh(geos.upperArmGeo, mats.uniformMat);
    upperArmMesh.castShadow = true;
    upperArm.add(upperArmMesh);

    // Patch de velcro no ombro
    const patch = new T.Mesh(new T.BoxGeometry(0.010, 0.050, 0.040), mats.patchVelcroMat);
    patch.position.set(sgn * 0.055, -0.070, 0.005);
    upperArm.add(patch);

    const elbow = new T.Group();
    elbow.name = `elbow${sideStr}`;
    elbow.position.set(0, -0.280, 0);
    upperArm.add(elbow);

    const elbowBulb = new T.Mesh(new T.SphereGeometry(0.042, 10, 8), mats.uniformMat);
    elbow.add(elbowBulb);

    // Cotoveleira Tática de Polímero
    const elbowPad = new T.Mesh(new T.BoxGeometry(0.048, 0.065, 0.024), mats.polymerHardPadMat);
    elbowPad.position.set(0, 0, -0.044);
    elbowPad.rotation.x = -0.15;
    elbowPad.castShadow = true;
    elbow.add(elbowPad);

    const forearm = new T.Group();
    forearm.name = `forearm${sideStr}`;
    elbow.add(forearm);

    const forearmMesh = new T.Mesh(geos.forearmGeo, mats.uniformMat);
    forearmMesh.castShadow = true;
    forearm.add(forearmMesh);

    // Punho com velcro cinza
    const cuff = new T.Mesh(new T.CylinderGeometry(0.038, 0.036, 0.022, 12), mats.darkTacticalGreyMat);
    cuff.position.set(0, -0.235, 0);
    cuff.rotation.x = Math.PI * 0.5;
    forearm.add(cuff);

    // Relógio Tático Militar no pulso esquerdo
    if (isLeft) {
      const watch = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 0.012, 12), mats.buckleMetalMat);
      watch.position.set(0, -0.235, 0.034);
      watch.rotation.x = Math.PI * 0.5;
      forearm.add(watch);
    }

    const wrist = new T.Group();
    wrist.name = `wrist${sideStr}`;
    wrist.position.set(0, -0.250, 0);
    forearm.add(wrist);

    const hand = new T.Group();
    hand.name = `hand${sideStr}`;
    wrist.add(hand);

    const palmMesh = new T.Mesh(geos.palmGeo, mats.skinMat);
    palmMesh.castShadow = true;
    hand.add(palmMesh);

    // Dedos da mão
    const fingerDefs = [
      { trans: 0.024, len: 0.070, curl: 0.20 },
      { trans: 0.008, len: 0.078, curl: 0.28 },
      { trans: -0.008, len: 0.072, curl: 0.35 },
      { trans: -0.024, len: 0.058, curl: 0.45 }
    ];
    fingerDefs.forEach(fd => {
      const f = new T.Mesh(geos.fingerGeo, mats.skinMat);
      f.position.set(sgn * fd.trans, -0.085, 0.005);
      f.rotation.x = fd.curl;
      f.scale.set(1.0, fd.len / 0.075, 1.0);
      f.castShadow = true;
      hand.add(f);
    });

    // Polegar
    const thumb = new T.Mesh(geos.fingerGeo, mats.skinMat);
    thumb.position.set(sgn * 0.026, -0.040, 0.012);
    thumb.rotation.set(0.35, sgn * 0.45, sgn * -0.25);
    thumb.scale.set(1.15, 0.85, 1.15);
    thumb.castShadow = true;
    hand.add(thumb);

    return { shoulder, upperArm, elbow, forearm, wrist, hand };
  }

  const leftArm = buildArm('left');
  const rightArm = buildArm('right');

  // 5. Membros Inferiores (Pernas e Botas)
  function buildLeg(side) {
    const isLeft = side === 'left';
    const sgn = isLeft ? 1 : -1;
    const sideStr = isLeft ? 'Left' : 'Right';

    const hip = new T.Group();
    hip.name = `hip${sideStr}`;
    hip.position.set(sgn * 0.086, -0.095, 0);
    pelvis.add(hip);

    const hipBulb = new T.Mesh(new T.SphereGeometry(0.090, 12, 10), mats.uniformMat);
    hipBulb.castShadow = true;
    hip.add(hipBulb);

    const thigh = new T.Group();
    thigh.name = `thigh${sideStr}`;
    hip.add(thigh);

    const thighMesh = new T.Mesh(geos.thighGeo, mats.uniformMat);
    thighMesh.castShadow = true;
    thigh.add(thighMesh);

    // Bolso Cargo na coxa
    const cargo = new T.Mesh(new T.BoxGeometry(0.042, 0.110, 0.090), mats.uniformMat);
    cargo.position.set(sgn * 0.085, -0.170, 0.015);
    cargo.castShadow = true;
    thigh.add(cargo);

    const knee = new T.Group();
    knee.name = `knee${sideStr}`;
    knee.position.set(0, -0.355, 0);
    thigh.add(knee);

    const kneeBulb = new T.Mesh(new T.SphereGeometry(0.065, 10, 8), mats.uniformMat);
    knee.add(kneeBulb);

    // Joelheira Tática
    const kneePad = new T.Mesh(new T.BoxGeometry(0.074, 0.090, 0.032), mats.polymerHardPadMat);
    kneePad.position.set(0, 0, 0.068);
    kneePad.rotation.x = -0.15;
    kneePad.castShadow = true;
    knee.add(kneePad);

    const shin = new T.Group();
    shin.name = `shin${sideStr}`;
    knee.add(shin);

    const shinMesh = new T.Mesh(geos.shinGeo, mats.uniformMat);
    shinMesh.castShadow = true;
    shin.add(shinMesh);

    const ankle = new T.Group();
    ankle.name = `ankle${sideStr}`;
    ankle.position.set(0, -0.350, 0);
    shin.add(ankle);

    const foot = new T.Group();
    foot.name = `foot${sideStr}`;
    ankle.add(foot);

    const bootUpper = new T.Mesh(geos.bootUpperGeo, mats.tacticalBootLeatherMat);
    bootUpper.position.set(0, -0.110, 0);
    bootUpper.castShadow = true;
    foot.add(bootUpper);

    const bootSole = new T.Mesh(geos.bootSoleGeo, mats.tacticalBootSoleMat);
    bootSole.position.set(0, -0.130, 0.045);
    bootSole.castShadow = true;
    foot.add(bootSole);

    const toes = new T.Group();
    toes.name = `toes${sideStr}`;
    toes.position.set(0, -0.110, 0.120);
    foot.add(toes);

    return { hip, thigh, knee, shin, ankle, foot, toes };
  }

  const leftLeg = buildLeg('left');
  const rightLeg = buildLeg('right');

  // 6. Registro de Juntas no userData para compatibilidade com Rig e Animação
  rootGroup.userData = {
    characterName: 'TacticalSoldierContinuous',
    hasRig: true,
    height: H,
    joints: {
      pelvis,
      spineLower,
      chest,
      neck,
      head,
      shoulderLeft: leftArm.shoulder,
      upperArmLeft: leftArm.upperArm,
      elbowLeft: leftArm.elbow,
      forearmLeft: leftArm.forearm,
      wristLeft: leftArm.wrist,
      handLeft: leftArm.hand,
      shoulderRight: rightArm.shoulder,
      upperArmRight: rightArm.upperArm,
      elbowRight: rightArm.elbow,
      forearmRight: rightArm.forearm,
      wristRight: rightArm.wrist,
      handRight: rightArm.hand,
      hipLeft: leftLeg.hip,
      thighLeft: leftLeg.thigh,
      kneeLeft: leftLeg.knee,
      shinLeft: leftLeg.shin,
      ankleLeft: leftLeg.ankle,
      footLeft: leftLeg.foot,
      toesLeft: leftLeg.toes,
      hipRight: rightLeg.hip,
      thighRight: rightLeg.thigh,
      kneeRight: rightLeg.knee,
      shinRight: rightLeg.shin,
      ankleRight: rightLeg.ankle,
      footRight: rightLeg.foot,
      toesRight: rightLeg.toes
    }
  };

  return {
    root: rootGroup,
    pelvis,
    chest,
    neck,
    head,
    headMesh,
    torsoMesh,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    joints: rootGroup.userData.joints
  };
}
