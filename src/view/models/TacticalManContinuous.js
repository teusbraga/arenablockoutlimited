/**
 * models/tactical-man-mid-poly.js
 * Homem Adulto em Roupa Tática Verde Oliva e Cinza com Colete Balístico 3D,
 * Cabelo Não-Sólido (GPU Alpha Cutout Hair Cards), Rosto com Textura Procedural 512x512
 * (Regra Áurea de 1/3 da Testa), Mãos Orgânicas com Seções Super-Elípticas e Bota Militar.
 *
 * Em estrita conformidade com a skill procedural-mid-poly-sculptor:
 * - Cânone Drillis & Contini (1966), H = 1.75m.
 * - Pipeline em 3 fases: Blockout de 8 segmentos -> Intertravamento de juntas (capStart: false) -> Detalhes PBR.
 * - Seções transversais de super-elipse de Gabriel Lamé (|x/a|^n + |y/b|^n = 1).
 * - Orçamento: 14.000 a 20.000 triângulos, draw calls reduzidos, sem artefatos de depth-sorting.
 */
import * as THREE from 'three';

const H = 1.75;
const k = 0.01; // Converte centímetros para metros
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

function makePathSections({ rings, segments = 22, defaultHint = [0, 1, 0] }) {
  const sections = [];
  for (const rDef of rings) {
    const pos = rDef.pos;
    const d = norm(rDef.dir);
    let up = rDef.hint || defaultHint;
    if (Math.abs(dot(up, d)) > 0.95) {
      up = Math.abs(d[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
    }
    const r = norm(cross(up, d));
    const u = cross(d, r);

    const a = rDef.a * k;
    const b = rDef.b * k;
    const n = rDef.n;
    const ring2D = superRing(a, b, n, segments);

    const sectionPts = ring2D.map(([px, pz]) => {
      return add(pos, add(mul(r, px), mul(u, pz)));
    });
    sections.push(sectionPts);
  }
  return sections;
}

function loftGeometry(THREE, sections, { capStart = true, capEnd = true } = {}) {
  const ringSize = sections[0].length;
  const stride = ringSize + 1;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let s = 0; s < sections.length; s++) {
    const v = s / (sections.length - 1);
    for (let i = 0; i <= ringSize; i++) {
      const p = sections[s][i % ringSize];
      positions.push(p[0], p[1], p[2]);
      uvs.push(i / ringSize, v);
    }
  }

  for (let s = 0; s < sections.length - 1; s++) {
    const lo = s * stride;
    const up = (s + 1) * stride;
    for (let i = 0; i < ringSize; i++) {
      const j = i + 1;
      indices.push(lo + i, up + i, lo + j);
      indices.push(lo + j, up + i, up + j);
    }
  }

  const addCap = (section, isEnd) => {
    let cx = 0, cy = 0, cz = 0;
    for (const p of section) { cx += p[0]; cy += p[1]; cz += p[2]; }
    cx /= section.length; cy /= section.length; cz /= section.length;

    const cIdx = positions.length / 3;
    positions.push(cx, cy, cz);
    uvs.push(0.5, 0.5);

    const rimStart = positions.length / 3;
    for (let i = 0; i < ringSize; i++) {
      const p = section[i];
      const ang = (i / ringSize) * TAU;
      positions.push(p[0], p[1], p[2]);
      uvs.push(0.5 + Math.cos(ang) * 0.5, 0.5 + Math.sin(ang) * 0.5);
    }

    for (let i = 0; i < ringSize; i++) {
      const j = (i + 1) % ringSize;
      if (isEnd) indices.push(cIdx, rimStart + i, rimStart + j);
      else indices.push(cIdx, rimStart + j, rimStart + i);
    }
  };

  if (capStart) addCap(sections[0], false);
  if (capEnd) addCap(sections[sections.length - 1], true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const normals = geometry.attributes.normal;
  for (let s = 0; s < sections.length; s++) {
    const first = s * stride;
    const last = first + ringSize;
    const nx = normals.getX(first) + normals.getX(last);
    const ny = normals.getY(first) + normals.getY(last);
    const nz = normals.getZ(first) + normals.getZ(last);
    const len = Math.hypot(nx, ny, nz) || 1;
    normals.setXYZ(first, nx / len, ny / len, nz / len);
    normals.setXYZ(last, nx / len, ny / len, nz / len);
  }
  normals.needsUpdate = true;
  return geometry;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXTURA FACIAL PROCEDURAL 512x512: REGRA ÁUREA DE 1/3 DA TESTA
// ═══════════════════════════════════════════════════════════════════════════
export function createProceduralFaceTexture(THREE) {
  if (typeof document === 'undefined') return new THREE.Texture();

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 1. Fundo geral: Tom de pele atlético masculino
  const skinGrad = ctx.createRadialGradient(256, 250, 40, 256, 250, 260);
  skinGrad.addColorStop(0.0, '#d2a78f');
  skinGrad.addColorStop(0.50, '#c3957a');
  skinGrad.addColorStop(0.85, '#aa795f');
  skinGrad.addColorStop(1.0, '#8c593f');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, size, size);

  // 2. Cabelo / Scalp com fade militar nas laterais e traseira (x < 115 e x > 397)
  // Topo do crânio (y <= 70)
  ctx.fillStyle = '#141210';
  ctx.fillRect(0, 0, size, 70);

  // Fade lateral das têmporas descendo até o nível da mandíbula (y = 380)
  const fadeLeft = ctx.createLinearGradient(125, 0, 70, 0);
  fadeLeft.addColorStop(0.0, 'rgba(20, 18, 16, 0.0)');
  fadeLeft.addColorStop(0.5, 'rgba(20, 18, 16, 0.70)');
  fadeLeft.addColorStop(1.0, '#141210');
  ctx.fillStyle = '#141210';
  ctx.fillRect(0, 70, 70, 320);
  ctx.fillStyle = fadeLeft;
  ctx.fillRect(70, 70, 55, 320);

  const fadeRight = ctx.createLinearGradient(387, 0, 442, 0);
  fadeRight.addColorStop(0.0, 'rgba(20, 18, 16, 0.0)');
  fadeRight.addColorStop(0.5, 'rgba(20, 18, 16, 0.70)');
  fadeRight.addColorStop(1.0, '#141210');
  ctx.fillStyle = '#141210';
  ctx.fillRect(442, 70, 70, 320);
  ctx.fillStyle = fadeRight;
  ctx.fillRect(387, 70, 55, 320);

  // Rubor e calor subcutâneo suave nas maçãs do rosto (zigomáticos)
  for (const cx of [186, 326]) {
    const blush = ctx.createRadialGradient(cx, 265, 10, cx, 265, 60);
    blush.addColorStop(0, 'rgba(195, 105, 90, 0.22)');
    blush.addColorStop(1, 'rgba(195, 105, 90, 0.0)');
    ctx.fillStyle = blush;
    ctx.beginPath();
    ctx.arc(cx, 265, 60, 0, Math.PI * 2);
    ctx.fill();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA 1: TESTA ANATÔMICA (y = 70 a 190, STRICTLY 120px = 1/3 DA FACE)
  // ═══════════════════════════════════════════════════════════════════════════
  // Raiz capilar suave com transição gradual (Hairline em y = 70)
  const hairRootGrad = ctx.createLinearGradient(0, 45, 0, 80);
  hairRootGrad.addColorStop(0.0, '#141210');
  hairRootGrad.addColorStop(0.65, '#221c17');
  hairRootGrad.addColorStop(1.0, 'rgba(34, 28, 23, 0.0)');
  ctx.fillStyle = hairRootGrad;
  ctx.beginPath();
  ctx.moveTo(110, 70);
  ctx.bezierCurveTo(180, 62, 332, 62, 402, 70);
  ctx.lineTo(402, 90);
  ctx.lineTo(110, 90);
  ctx.closePath();
  ctx.fill();

  // Iluminação suave e natural da testa frontal
  const foreheadGlow = ctx.createRadialGradient(256, 130, 10, 256, 130, 85);
  foreheadGlow.addColorStop(0.0, 'rgba(252, 232, 218, 0.35)');
  foreheadGlow.addColorStop(0.65, 'rgba(240, 210, 190, 0.14)');
  foreheadGlow.addColorStop(1.0, 'rgba(210, 170, 145, 0.0)');
  ctx.fillStyle = foreheadGlow;
  ctx.beginPath();
  ctx.ellipse(256, 130, 85, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Linhas sutis de expressão da testa masculina
  ctx.strokeStyle = 'rgba(110, 75, 55, 0.16)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(185, 135); ctx.quadraticCurveTo(256, 131, 327, 135);
  ctx.moveTo(200, 152); ctx.quadraticCurveTo(256, 149, 312, 152);
  ctx.stroke();

  // Sobrancelhas Táticas Masculinas (Glabella em y = 190)
  function drawEyebrow(startX, peakX, endX, isLeft) {
    ctx.save();
    ctx.strokeStyle = '#201914';
    ctx.fillStyle = '#201914';
    ctx.lineWidth = 2.0;

    const baseY = 188;
    const peakY = 178;

    ctx.beginPath();
    ctx.moveTo(startX, baseY + 1);
    ctx.quadraticCurveTo(peakX, peakY - 3, endX, baseY + 3);
    ctx.quadraticCurveTo(peakX, peakY + 3, startX, baseY + 1);
    ctx.fill();

    // Pêlos individuais da sobrancelha
    const step = 2.4;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    for (let x = minX; x < maxX; x += step) {
      const t = (x - minX) / (maxX - minX);
      const y = (1 - t) * baseY + t * (baseY + 2) - Math.sin(t * Math.PI) * 7;
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x + (isLeft ? 4 : -4), y - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawEyebrow(242, 186, 142, true);  // Sobrancelha esquerda
  drawEyebrow(270, 326, 370, false); // Sobrancelha direita

  // Sulco glabelar sutil entre as sobrancelhas
  ctx.strokeStyle = 'rgba(85, 50, 35, 0.35)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(252, 184); ctx.lineTo(252, 194);
  ctx.moveTo(260, 184); ctx.lineTo(260, 194);
  ctx.stroke();

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA 2: OLHOS & NARIZ ANATÔMICOS (y = 190 a 310, STRICTLY 120px = 1/3)
  // ═══════════════════════════════════════════════════════════════════════════
  // Cavidades orbitais sombreadas dando profundidade às órbitas
  for (const cx of [186, 326]) {
    const eyeSocket = ctx.createRadialGradient(cx, 226, 8, cx, 226, 40);
    eyeSocket.addColorStop(0, 'rgba(100, 65, 45, 0.30)');
    eyeSocket.addColorStop(0.7, 'rgba(100, 65, 45, 0.12)');
    eyeSocket.addColorStop(1, 'rgba(100, 65, 45, 0.0)');
    ctx.fillStyle = eyeSocket;
    ctx.beginPath();
    ctx.ellipse(cx, 226, 40, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Olhos anatômicos completos (esclera, íris hazel, pupila e duplo glint)
  function drawEye(cx, cy, isLeft) {
    ctx.save();

    // 1. Contorno amendoado da esclera
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy);
    ctx.bezierCurveTo(cx - 14, cy - 12, cx + 14, cy - 12, cx + 24, cy);
    ctx.bezierCurveTo(cx + 14, cy + 12, cx - 14, cy + 12, cx - 24, cy);
    ctx.closePath();

    // Preenchimento esclera natural esbranquiçada
    const scleraGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 24);
    scleraGrad.addColorStop(0, '#fcfaf6');
    scleraGrad.addColorStop(0.75, '#ede5d9');
    scleraGrad.addColorStop(1, '#cbb8a6');
    ctx.fillStyle = scleraGrad;
    ctx.fill();

    // Recorte palpebral
    ctx.clip();

    // 2. Íris Hazel-Green Tática com Anel Límbico
    const irisR = 14.5;
    const irisGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, irisR);
    irisGrad.addColorStop(0.0, '#563e26'); // Colar pupilar âmbar
    irisGrad.addColorStop(0.35, '#758648'); // Verde oliva tático vibrante
    irisGrad.addColorStop(0.75, '#545d34'); // Zona ciliar
    irisGrad.addColorStop(1.0, '#151810'); // Anel límbico contrastante
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
    ctx.fill();

    // Fibras radiais da íris
    ctx.strokeStyle = 'rgba(160, 180, 95, 0.52)';
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += 0.28) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      ctx.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
      ctx.stroke();
    }

    // 3. Pupila Negra Profunda
    ctx.fillStyle = '#060608';
    ctx.beginPath();
    ctx.arc(cx, cy, 5.6, 0, Math.PI * 2);
    ctx.fill();

    // Sombra da pálpebra superior cobrindo o topo da íris
    ctx.fillStyle = 'rgba(25, 15, 10, 0.42)';
    ctx.fillRect(cx - 26, cy - 15, 52, 7.5);

    // 4. Brilho Especular Vivo (Glint primário e secundário)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx + 3.5, cy - 3.5, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.beginPath();
    ctx.arc(cx - 2.8, cy + 2.8, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Carúncula lacrimal medial
    const lacrimalX = isLeft ? cx + 23 : cx - 23;
    ctx.fillStyle = '#b8665c';
    ctx.beginPath();
    ctx.ellipse(lacrimalX, cy, 3.5, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Linha de cílios / pálpebra superior
    ctx.strokeStyle = '#1b120c';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy);
    ctx.bezierCurveTo(cx - 14, cy - 13, cx + 14, cy - 13, cx + 25, cy);
    ctx.stroke();

    // Sulco palpebral superior
    ctx.strokeStyle = 'rgba(75, 42, 28, 0.40)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy - 6);
    ctx.bezierCurveTo(cx - 12, cy - 16, cx + 12, cy - 16, cx + 22, cy - 6);
    ctx.stroke();

    // Pálpebra inferior
    ctx.strokeStyle = 'rgba(60, 36, 24, 0.45)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 1);
    ctx.bezierCurveTo(cx - 12, cy + 12, cx + 12, cy + 12, cx + 22, cy + 1);
    ctx.stroke();
  }

  drawEye(186, 226, true);
  drawEye(326, 226, false);

  // NARIZ ANATÔMICO (Glabella y = 190 até Subnasale y = 310)
  // Paredes laterais sombreadas dando volume 3D à ponte do nariz
  const noseBridgeL = ctx.createLinearGradient(236, 205, 248, 205);
  noseBridgeL.addColorStop(0, 'rgba(80, 46, 30, 0.40)');
  noseBridgeL.addColorStop(1, 'rgba(80, 46, 30, 0.0)');
  ctx.fillStyle = noseBridgeL;
  ctx.beginPath();
  ctx.moveTo(246, 192); ctx.lineTo(250, 280); ctx.lineTo(236, 280); ctx.lineTo(236, 192);
  ctx.fill();

  const noseBridgeR = ctx.createLinearGradient(276, 205, 264, 205);
  noseBridgeR.addColorStop(0, 'rgba(80, 46, 30, 0.40)');
  noseBridgeR.addColorStop(1, 'rgba(80, 46, 30, 0.0)');
  ctx.fillStyle = noseBridgeR;
  ctx.beginPath();
  ctx.moveTo(266, 192); ctx.lineTo(262, 280); ctx.lineTo(276, 280); ctx.lineTo(276, 192);
  ctx.fill();

  // Destaque luminoso do dorso nasal
  const dorsumHighlight = ctx.createLinearGradient(256, 192, 256, 288);
  dorsumHighlight.addColorStop(0, 'rgba(250, 225, 208, 0.28)');
  dorsumHighlight.addColorStop(0.7, 'rgba(255, 238, 224, 0.52)');
  dorsumHighlight.addColorStop(1, 'rgba(255, 238, 224, 0.72)');
  ctx.fillStyle = dorsumHighlight;
  ctx.beginPath();
  ctx.ellipse(256, 240, 5.0, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ponta do nariz arredondada (Pronasale y = 286)
  const tipHighlight = ctx.createRadialGradient(256, 286, 2, 256, 286, 15);
  tipHighlight.addColorStop(0, 'rgba(255, 238, 224, 0.70)');
  tipHighlight.addColorStop(0.6, 'rgba(238, 200, 180, 0.28)');
  tipHighlight.addColorStop(1, 'rgba(200, 150, 130, 0.0)');
  ctx.fillStyle = tipHighlight;
  ctx.beginPath();
  ctx.arc(256, 286, 14, 0, Math.PI * 2);
  ctx.fill();

  // Asas nasais (Alae)
  ctx.fillStyle = 'rgba(215, 165, 145, 0.45)';
  ctx.beginPath();
  ctx.ellipse(236, 294, 9, 8, -0.2, 0, Math.PI * 2);
  ctx.ellipse(276, 294, 9, 8, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Narinas em gota escura com sombra suave
  ctx.fillStyle = '#1c100a';
  ctx.beginPath();
  ctx.ellipse(246, 301, 5.0, 3.2, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(266, 301, 5.0, 3.2, 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Sombra subnasal (Subnasale em y = 310 estrito)
  const subnasalShade = ctx.createLinearGradient(256, 301, 256, 314);
  subnasalShade.addColorStop(0, 'rgba(60, 32, 20, 0.60)');
  subnasalShade.addColorStop(1, 'rgba(60, 32, 20, 0.0)');
  ctx.fillStyle = subnasalShade;
  ctx.beginPath();
  ctx.ellipse(256, 308, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ═══════════════════════════════════════════════════════════════════════════
  // ZONA 3: BOCA, QUEIXO & STUBBLE TÁTICO (y = 310 a 430, STRICTLY 120px = 1/3)
  // ═══════════════════════════════════════════════════════════════════════════
  // Filtro labial (Philtrum y = 311 a 336)
  ctx.strokeStyle = 'rgba(255, 235, 220, 0.40)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(250, 311); ctx.lineTo(249, 336);
  ctx.moveTo(262, 311); ctx.lineTo(263, 336);
  ctx.stroke();

  // Lábio Superior com Arco do Cupido (Cupid's bow y = 336 a 348)
  ctx.fillStyle = '#8f5249';
  ctx.beginPath();
  ctx.moveTo(204, 348);
  ctx.quadraticCurveTo(234, 338, 248, 336);
  ctx.quadraticCurveTo(256, 340, 264, 336);
  ctx.quadraticCurveTo(278, 338, 308, 348);
  ctx.quadraticCurveTo(256, 351, 204, 348);
  ctx.closePath();
  ctx.fill();

  // Linha de oclusão labial (Stomion em y = 350)
  ctx.strokeStyle = '#2f1410';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(202, 348);
  ctx.quadraticCurveTo(232, 350, 256, 349);
  ctx.quadraticCurveTo(280, 350, 310, 348);
  ctx.stroke();

  // Lábio Inferior com volume (y = 350 a 368)
  ctx.fillStyle = '#9e5d54';
  ctx.beginPath();
  ctx.moveTo(206, 349);
  ctx.quadraticCurveTo(256, 351, 306, 349);
  ctx.quadraticCurveTo(294, 370, 256, 370);
  ctx.quadraticCurveTo(218, 370, 206, 349);
  ctx.closePath();
  ctx.fill();

  // Brilho labial inferior
  const lipGlow = ctx.createRadialGradient(256, 360, 2, 256, 360, 18);
  lipGlow.addColorStop(0, 'rgba(255, 220, 210, 0.45)');
  lipGlow.addColorStop(1, 'rgba(255, 220, 210, 0.0)');
  ctx.fillStyle = lipGlow;
  ctx.beginPath();
  ctx.ellipse(256, 360, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sulco labiomentoniano (Sombra abaixo do lábio inferior y = 378)
  const chinGroove = ctx.createLinearGradient(256, 370, 256, 388);
  chinGroove.addColorStop(0, 'rgba(70, 38, 24, 0.48)');
  chinGroove.addColorStop(1, 'rgba(70, 38, 24, 0.0)');
  ctx.fillStyle = chinGroove;
  ctx.beginPath();
  ctx.ellipse(256, 378, 30, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eminência do Queixo Quadrado Masculino (Menton em y = 400 a 424)
  const chinHighlight = ctx.createRadialGradient(256, 410, 4, 256, 410, 32);
  chinHighlight.addColorStop(0, 'rgba(250, 225, 205, 0.42)');
  chinHighlight.addColorStop(1, 'rgba(250, 225, 205, 0.0)');
  ctx.fillStyle = chinHighlight;
  ctx.beginPath();
  ctx.ellipse(256, 410, 30, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sombra inferior do queixo (Menton base em y = 430 estrito)
  const chinBaseShade = ctx.createLinearGradient(256, 420, 256, 438);
  chinBaseShade.addColorStop(0, 'rgba(50, 28, 18, 0.0)');
  chinBaseShade.addColorStop(1, 'rgba(50, 28, 18, 0.65)');
  ctx.fillStyle = chinBaseShade;
  ctx.beginPath();
  ctx.ellipse(256, 430, 38, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // SOMBRA DE BARBA & STUBBLE TÁTICO (5 O'CLOCK SHADOW MILITAR)
  const stubbleGrad = ctx.createRadialGradient(256, 390, 20, 256, 390, 130);
  stubbleGrad.addColorStop(0.0, 'rgba(38, 35, 33, 0.38)');
  stubbleGrad.addColorStop(0.7, 'rgba(35, 32, 30, 0.24)');
  stubbleGrad.addColorStop(1.0, 'rgba(35, 32, 30, 0.0)');
  ctx.fillStyle = stubbleGrad;
  ctx.beginPath();
  ctx.ellipse(256, 395, 125, 58, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bigode militar sutil
  const mustacheGrad = ctx.createRadialGradient(256, 328, 5, 256, 328, 50);
  mustacheGrad.addColorStop(0.0, 'rgba(38, 35, 33, 0.32)');
  mustacheGrad.addColorStop(1.0, 'rgba(38, 35, 33, 0.0)');
  ctx.fillStyle = mustacheGrad;
  ctx.beginPath();
  ctx.ellipse(256, 328, 48, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Micro-pontilhismo procedimental de pelos curtos
  const rng = (seed) => { let s = seed; return () => { s = Math.sin(s) * 10000; return s - Math.floor(s); }; };
  const r = rng(777);
  ctx.fillStyle = 'rgba(24, 20, 18, 0.52)';
  for (let i = 0; i < 1100; i++) {
    const px = 135 + r() * 242;
    const py = 315 + r() * 140;
    if (py < 368 && px > 204 && px < 308 && (py > 336 || (py > 315 && px > 246 && px < 266))) continue;
    ctx.fillRect(px, py, 1.3, 1.3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ═══════════════════════════════════════════════════════════════════════════
// HAIR CARDS PROCEDURAIS (GPU ALPHA CUTOUT - ZERO DEPTH ARTIFACTS)
// ═══════════════════════════════════════════════════════════════════════════
function createHairCardGeometry(THREE, width, length, droop = 0.008, fold = 0.20) {
  const geo = new THREE.PlaneGeometry(width, length, 2, 8);
  geo.translate(0, length / 2, 0); // Pivô na base/raiz da fita
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, y / length));
    const zSag = -Math.pow(t, 2.0) * droop;
    const zFold = (Math.abs(x) / (width * 0.5 || 1)) * (fold * width);
    pos.setZ(i, zSag + zFold);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createHairCardTextures(THREE) {
  if (typeof document === 'undefined') return { map: null, alphaMap: null };

  const size = 256;
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = size;
  diffCanvas.height = size;
  const dCtx = diffCanvas.getContext('2d');

  // Cor base do cabelo militar escuro
  dCtx.fillStyle = '#181513';
  dCtx.fillRect(0, 0, size, size);

  // Fios individuais com variação de tons castanho escuro / preto militar
  const rng = (seed) => { let s = seed; return () => { s = Math.sin(s) * 10000; return s - Math.floor(s); }; };
  const r = rng(101);

  for (let i = 0; i < 160; i++) {
    const x = r() * size;
    dCtx.strokeStyle = r() > 0.45 ? '#241c16' : (r() > 0.75 ? '#30241b' : '#120f0d');
    dCtx.lineWidth = 1.2 + r() * 1.8;
    dCtx.beginPath();
    dCtx.moveTo(x, 0);
    dCtx.bezierCurveTo(
      x + (r() - 0.5) * 14, size * 0.35,
      x + (r() - 0.5) * 20, size * 0.70,
      x + (r() - 0.5) * 10, size
    );
    dCtx.stroke();
  }

  // Máscara Alpha (0x000000 fundo preto transparente, 0xffffff fios opacos)
  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = size;
  alphaCanvas.height = size;
  const aCtx = alphaCanvas.getContext('2d');

  aCtx.fillStyle = '#000000';
  aCtx.fillRect(0, 0, size, size);

  const gradA = aCtx.createLinearGradient(0, 0, 0, size);
  gradA.addColorStop(0.0, '#ffffff');
  gradA.addColorStop(0.85, '#ffffff');
  gradA.addColorStop(1.0, '#000000');
  aCtx.fillStyle = gradA;

  // Silhueta afilada dos fios
  aCtx.beginPath();
  aCtx.moveTo(size * 0.15, 0);
  aCtx.lineTo(size * 0.85, 0);
  aCtx.quadraticCurveTo(size * 0.90, size * 0.55, size * 0.50, size);
  aCtx.quadraticCurveTo(size * 0.10, size * 0.55, size * 0.15, 0);
  aCtx.fill();

  // Fios individuais que vazam da borda para corte orgânico
  aCtx.strokeStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    const y = r() * size;
    aCtx.lineWidth = 1.3 + r() * 1.6;
    aCtx.beginPath();
    aCtx.moveTo(size * 0.28, y);
    aCtx.lineTo(size * (0.50 + (r() - 0.5) * 0.42), y + 12);
    aCtx.stroke();
  }

  const map = new THREE.CanvasTexture(diffCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const alphaMap = new THREE.CanvasTexture(alphaCanvas);
  alphaMap.colorSpace = THREE.NoColorSpace;

  return { map, alphaMap };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXTURA DA FARDA COMBAT SHIRT TÁTICA (CINZA TÁTICO RESPIRÁVEL & OLIVA)
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalCombatShirtTexture(THREE) {
  if (typeof document === 'undefined') return new THREE.Texture();

  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Tronco cinza tático respirável (Wolf Grey / Heather Grey)
  ctx.fillStyle = '#484f56';
  ctx.fillRect(0, 0, width, height);

  // Micro-grade têxtil técnica ripstop
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 10) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 10) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Costuras reforçadas laterais e anatômicas
  ctx.strokeStyle = 'rgba(30, 34, 38, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(85, 0); ctx.lineTo(105, height);
  ctx.moveTo(width - 85, 0); ctx.lineTo(width - 105, height);
  ctx.stroke();

  // Painel de peito superior e gola em verde oliva militar
  const oliveTop = ctx.createLinearGradient(0, 0, 0, 150);
  oliveTop.addColorStop(0.0, '#3a4833');
  oliveTop.addColorStop(0.85, '#41523a');
  oliveTop.addColorStop(1.0, '#484f56');
  ctx.fillStyle = oliveTop;
  ctx.fillRect(0, 0, width, 150);

  // Zíper tático 1/4 zip metálico
  ctx.strokeStyle = '#222528';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(256, 20); ctx.lineTo(256, 140);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETAS TÁTICAS MILITARES & MATERIAIS PBR
// ═══════════════════════════════════════════════════════════════════════════
export const TACTICAL_PALETTES = [
  {
    name: 'Woodland Green',
    uniform: 0x3a4833,
    sheenColor: 0x6b7d58,
    vest: 0x303c2a,
    vestBorder: 0x20241e,
    vestStrap: 0x161815,
    magPouch: 0x3a4832,
    pads: 0x161816,
    boots: 0x1a1918,
    greyPanel: 0x484f56
  },
  {
    name: 'Urban Slate',
    uniform: 0x3c444d,
    sheenColor: 0x64748b,
    vest: 0x24282f,
    vestBorder: 0x181b20,
    vestStrap: 0x121417,
    magPouch: 0x2c323a,
    pads: 0x121416,
    boots: 0x141618,
    greyPanel: 0x343a42
  },
  {
    name: 'Desert Coyote',
    uniform: 0x78674d,
    sheenColor: 0xa8906c,
    vest: 0x544633,
    vestBorder: 0x3e3324,
    vestStrap: 0x282117,
    magPouch: 0x5c4d38,
    pads: 0x2e271c,
    boots: 0x30271c,
    greyPanel: 0x61533e
  },
  {
    name: 'Spec-Ops Dark',
    uniform: 0x1f2327,
    sheenColor: 0x3f464e,
    vest: 0x151719,
    vestBorder: 0x0e1011,
    vestStrap: 0x090a0b,
    magPouch: 0x181a1d,
    pads: 0x0a0c0d,
    boots: 0x0f1011,
    greyPanel: 0x22262a
  },
  {
    name: 'Mercenary Camo',
    uniform: 0x484d3d,
    sheenColor: 0x788065,
    vest: 0x363b2e,
    vestBorder: 0x262920,
    vestStrap: 0x181a14,
    magPouch: 0x3c4234,
    pads: 0x1a1c17,
    boots: 0x181916,
    greyPanel: 0x3d4234
  }
];

export function createCharacterMaterials(THREE, options = {}) {
  let pal = null;
  if (options.palette && typeof options.palette === 'object') {
    const pIdx = typeof options.paletteIndex === 'number'
      ? Math.max(0, Math.min(options.paletteIndex, TACTICAL_PALETTES.length - 1))
      : 0;
    pal = { ...TACTICAL_PALETTES[pIdx], ...options.palette };
  } else {
    const pIdx = typeof options.paletteIndex === 'number'
      ? Math.max(0, Math.min(options.paletteIndex, TACTICAL_PALETTES.length - 1))
      : 0;
    pal = TACTICAL_PALETTES[pIdx];
  }

  const faceTexture = createProceduralFaceTexture(THREE);
  const hairTextures = createHairCardTextures(THREE);
  const shirtTexture = createTacticalCombatShirtTexture(THREE);

  // 1. Cabeça & Pele Anatômica
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTexture,
    color: 0xffffff,
    roughness: 0.62,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const skinColor = options.skinTone != null ? options.skinTone : (pal.skinTone || pal.skinColor || 0xc4987e);
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: 0.60,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  // 2. Cabelo & Hair Cards Cutout
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x141210,
    roughness: 0.75,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  const hairCardMat = new THREE.MeshStandardMaterial({
    map: hairTextures.map,
    alphaMap: hairTextures.alphaMap,
    roughness: 0.65,
    metalness: 0.04,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    alphaTest: 0.20,
    side: THREE.DoubleSide,
    shadowSide: THREE.DoubleSide
  });

  // 3. Uniforme Tático de Combate (Verde Oliva Militar & Cinza Tático / Paleta Personalizada)
  const uniformColor = pal.uniform;
  const sheenCol = pal.sheenColor || new THREE.Color(uniformColor).offsetHSL(0, 0, 0.12).getHex();
  const oliveCombatMat = new THREE.MeshPhysicalMaterial({
    color: uniformColor,
    roughness: 0.80,
    metalness: 0.04,
    sheen: 0.48,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color(sheenCol),
    side: THREE.DoubleSide
  });

  const greyCombatShirtMat = new THREE.MeshStandardMaterial({
    map: shirtTexture,
    roughness: 0.78,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const darkTacticalGreyMat = new THREE.MeshStandardMaterial({
    color: pal.greyPanel != null ? pal.greyPanel : 0x484f56,
    roughness: 0.75,
    metalness: 0.08,
    side: THREE.DoubleSide
  });

  // 4. Colete Balístico 3D (Ranger Green Escuro / Preto Tático / Paleta)
  const vestCol = new THREE.Color(pal.vest);
  const vestBorderCol = pal.vestBorder != null ? pal.vestBorder : vestCol.clone().multiplyScalar(0.72).getHex();
  const vestStrapCol = pal.vestStrap != null ? pal.vestStrap : vestCol.clone().multiplyScalar(0.52).getHex();
  const magPouchCol = pal.magPouch != null ? pal.magPouch : vestCol.clone().offsetHSL(0, 0, 0.05).getHex();

  const vestMainMat = new THREE.MeshStandardMaterial({
    color: pal.vest,
    roughness: 0.72,
    metalness: 0.08,
    side: THREE.DoubleSide
  });

  const vestBorderMat = new THREE.MeshStandardMaterial({
    color: vestBorderCol,
    roughness: 0.65,
    metalness: 0.10,
    side: THREE.DoubleSide
  });

  const vestStrapMat = new THREE.MeshStandardMaterial({
    color: vestStrapCol,
    roughness: 0.68,
    metalness: 0.12,
    side: THREE.DoubleSide
  });

  const magPouchMat = new THREE.MeshStandardMaterial({
    color: magPouchCol,
    roughness: 0.74,
    metalness: 0.06,
    side: THREE.DoubleSide
  });

  const patchVelcroMat = new THREE.MeshStandardMaterial({
    color: pal.greyPanel != null ? pal.greyPanel : 0x484f56,
    roughness: 0.90,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  // 5. Proteções Rígidas (Joelheiras & Cotoveleiras de Polímero)
  const padsCol = pal.pads != null ? pal.pads : 0x161816;
  const polymerHardPadMat = new THREE.MeshStandardMaterial({
    color: padsCol,
    roughness: 0.45,
    metalness: 0.18,
    side: THREE.DoubleSide
  });

  const buckleMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2e3032, // Fivelas e ilhoses metálicos
    roughness: 0.32,
    metalness: 0.80,
    side: THREE.DoubleSide
  });

  // 6. Bota Militar de Combate (Couro Tático & Solado Vulcanizado Tratorado)
  const bootsCol = pal.boots != null ? pal.boots : padsCol;
  const tacticalBootLeatherMat = new THREE.MeshPhysicalMaterial({
    color: bootsCol,
    roughness: 0.50,
    metalness: 0.10,
    clearcoat: 0.22,
    clearcoatRoughness: 0.40,
    side: THREE.DoubleSide
  });

  const tacticalBootSoleMat = new THREE.MeshStandardMaterial({
    color: 0x121412, // Borracha tratorada vulcanizada pesada
    roughness: 0.58,
    metalness: 0.02,
    side: THREE.DoubleSide
  });

  return {
    faceMat,
    skinMat,
    hairMat,
    hairCardMat,
    oliveCombatMat,
    greyCombatShirtMat,
    darkTacticalGreyMat,
    vestMainMat,
    vestBorderMat,
    vestStrapMat,
    magPouchMat,
    patchVelcroMat,
    polymerHardPadMat,
    buckleMetalMat,
    tacticalBootLeatherMat,
    tacticalBootSoleMat
  };
}

export function applyPaletteToMaterials(mats, palette = {}) {
  if (!mats || !palette) return;

  if (palette.uniform != null && mats.oliveCombatMat) {
    mats.oliveCombatMat.color.set(palette.uniform);
    if (mats.oliveCombatMat.sheenColor) {
      if (palette.sheenColor != null) {
        mats.oliveCombatMat.sheenColor.set(palette.sheenColor);
      } else {
        const c = new THREE.Color(palette.uniform).offsetHSL(0, 0, 0.12);
        mats.oliveCombatMat.sheenColor.copy(c);
      }
    }
  }

  if (palette.vest != null && mats.vestMainMat) {
    mats.vestMainMat.color.set(palette.vest);
    const vestCol = new THREE.Color(palette.vest);
    if (mats.vestBorderMat) {
      if (palette.vestBorder != null) {
        mats.vestBorderMat.color.set(palette.vestBorder);
      } else {
        mats.vestBorderMat.color.copy(vestCol.clone().multiplyScalar(0.72));
      }
    }
    if (mats.vestStrapMat) {
      if (palette.vestStrap != null) {
        mats.vestStrapMat.color.set(palette.vestStrap);
      } else {
        mats.vestStrapMat.color.copy(vestCol.clone().multiplyScalar(0.52));
      }
    }
    if (mats.magPouchMat) {
      if (palette.magPouch != null) {
        mats.magPouchMat.color.set(palette.magPouch);
      } else {
        mats.magPouchMat.color.copy(vestCol.clone().offsetHSL(0, 0, 0.05));
      }
    }
  }

  if (palette.pads != null && mats.polymerHardPadMat) {
    mats.polymerHardPadMat.color.set(palette.pads);
    if (mats.tacticalBootLeatherMat) {
      if (palette.boots != null) {
        mats.tacticalBootLeatherMat.color.set(palette.boots);
      } else {
        mats.tacticalBootLeatherMat.color.set(palette.pads);
      }
    }
  } else if (palette.boots != null && mats.tacticalBootLeatherMat) {
    mats.tacticalBootLeatherMat.color.set(palette.boots);
  }

  if ((palette.skinTone != null || palette.skinColor != null) && mats.skinMat) {
    mats.skinMat.color.set(palette.skinTone || palette.skinColor);
  }

  if (palette.greyPanel != null && mats.darkTacticalGreyMat) {
    mats.darkTacticalGreyMat.color.set(palette.greyPanel);
  }
}

export function applyPaletteToCharacter(characterRoot, palette = {}) {
  if (!characterRoot) return;
  const mats = characterRoot.userData?.mats;
  if (mats) {
    applyPaletteToMaterials(mats, palette);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPA 1: CABEÇA ANATÔMICA, ROSTO PROCEDURAL & ALPHA CUTOUT HAIR CARDS
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalHead(THREE, mats) {
  const headGroup = new THREE.Group();
  headGroup.name = 'head';

  const headH = 0.130 * H; // ~0.2275m

  // Seções transversais craniofaciais Gabriel Lamé (do queixo à calota craniana)
  const headRings = [
    { t: -0.06, a: 4.0, b: 4.8, n: 2.2, oz: 1.6, v: 0.05 }, // Submandibular / encaixe pescoço
    { t: 0.00,  a: 3.8, b: 5.2, n: 2.4, oz: 2.5, v: 0.16 }, // Queixo atlético (Menton y=430)
    { t: 0.08,  a: 5.4, b: 6.2, n: 2.4, oz: 2.3, v: 0.23 }, // Linha da mandíbula / gonion
    { t: 0.16,  a: 6.4, b: 7.0, n: 2.3, oz: 1.7, v: 0.30 }, // Lábios (Stomion y=350)
    { t: 0.24,  a: 6.9, b: 7.6, n: 2.3, oz: 1.3, v: 0.39 }, // Base do nariz (Subnasale y=310)
    { t: 0.36,  a: 7.4, b: 8.2, n: 2.3, oz: 0.9, v: 0.50 }, // Ponta do nariz / zigomáticos
    { t: 0.46,  a: 7.5, b: 8.4, n: 2.2, oz: 0.4, v: 0.59 }, // Olhos (y=226)
    { t: 0.54,  a: 7.4, b: 8.4, n: 2.2, oz: 0.1, v: 0.66 }, // Glabella / Sobrancelhas (y=190)
    { t: 0.64,  a: 7.2, b: 8.2, n: 2.2, oz: -0.1, v: 0.74 }, // Testa central (Regra do 1/3)
    { t: 0.72,  a: 7.0, b: 8.0, n: 2.1, oz: -0.3, v: 0.86 }, // Testa superior / Linha de cabelo (y=70)
    { t: 0.84,  a: 6.6, b: 7.6, n: 2.1, oz: -0.5, v: 0.91 }, // Calota anterior / Scalp
    { t: 0.94,  a: 5.2, b: 6.2, n: 2.0, oz: -0.6, v: 0.96 }, // Vértice
    { t: 1.00,  a: 2.2, b: 2.8, n: 2.0, oz: -0.6, v: 0.99 }  // Topo do crânio
  ];

  const segments = 32;
  const positions = [];
  const uvs = [];
  const indices = [];

  const ringsCount = headRings.length;
  const stride = segments + 1;

  headRings.forEach((ring) => {
    const y = ring.t * headH;
    const ringPts = superRing(ring.a * k, ring.b * k, ring.n, segments);
    const v = ring.v;

    for (let i = 0; i <= segments; i++) {
      const pt = ringPts[i % segments];
      const px = pt[0];
      const pz = pt[1] + (ring.oz * k);
      positions.push(px, y, pz);

      // Projeção UV frontal anatômica GTA SA / Vice City Standard:
      let u;
      const faceRefW = 0.114;
      if (pz >= -0.010) {
        // Rosto frontal
        u = 0.50 + (px / (2 * faceRefW));
        u = Math.max(0.04, Math.min(0.96, u));
      } else {
        // Traseira e laterais posteriores: mapeadas para a zona de fade e cabelo escuro
        const phi = Math.atan2(px, -pz);
        u = (phi >= 0) ? (0.86 + (phi / Math.PI) * 0.12) : (0.14 + (phi / Math.PI) * 0.12);
      }
      uvs.push(u, v);
    }
  });

  for (let s = 0; s < ringsCount - 1; s++) {
    const lo = s * stride;
    const up = (s + 1) * stride;
    for (let i = 0; i < segments; i++) {
      indices.push(lo + i, up + i, lo + i + 1);
      indices.push(lo + i + 1, up + i, up + i + 1);
    }
  }

  const addCap = (ringIndex, isTop) => {
    const s = ringIndex;
    const baseIdx = positions.length / 3;
    const centerY = headRings[s].t * headH;
    positions.push(0, centerY, headRings[s].oz * k);
    uvs.push(0.5, isTop ? 0.95 : 0.05);

    const rimStart = s * stride;
    for (let i = 0; i < segments; i++) {
      const next = (i + 1);
      if (isTop) indices.push(baseIdx, rimStart + i, rimStart + next);
      else indices.push(baseIdx, rimStart + next, rimStart + i);
    }
  };

  addCap(0, false);
  addCap(ringsCount - 1, true);

  const headGeo = new THREE.BufferGeometry();
  headGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  headGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  headGeo.setIndex(indices);
  headGeo.computeVertexNormals();

  // Média de normais na costura UV
  const normals = headGeo.attributes.normal;
  for (let s = 0; s < ringsCount; s++) {
    const first = s * stride;
    const last = first + segments;
    const nx = normals.getX(first) + normals.getX(last);
    const ny = normals.getY(first) + normals.getY(last);
    const nz = normals.getZ(first) + normals.getZ(last);
    const len = Math.hypot(nx, ny, nz) || 1;
    normals.setXYZ(first, nx / len, ny / len, nz / len);
    normals.setXYZ(last, nx / len, ny / len, nz / len);
  }
  normals.needsUpdate = true;

  const headMesh = new THREE.Mesh(headGeo, mats.faceMat);
  headMesh.name = 'tactical_head_face';
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  // ═══════════════════════════════════════════════════════════════════════════
  // HAIR CARDS CUTOUT NÃO-SÓLIDO (CORTE MILITAR CREW-CUT COM MECHAS CAMADAS)
  // Fitas com curvatura tangencial ao crânio, gerando volume 3D realista
  // ═══════════════════════════════════════════════════════════════════════════
  const hairCardsGroup = new THREE.Group();
  hairCardsGroup.name = 'tactical_hair_cards';

  // 1. Crista Superior / Top Crown (Fitas dispostas tangenciais ao crânio com volume aprimorado)
  const topCardGeo = createHairCardGeometry(THREE, 0.038, 0.060, 0.010, 0.22);
  const crownCards = [
    // Fileira frontal superior
    { x: -0.034, y: 0.214, z: 0.032, rx: -1.35, ry: -0.25, rz: 0.18 },
    { x: -0.018, y: 0.220, z: 0.038, rx: -1.40, ry: -0.10, rz: 0.08 },
    { x:  0.000, y: 0.222, z: 0.040, rx: -1.42, ry:  0.00, rz: 0.00 },
    { x:  0.018, y: 0.220, z: 0.040, rx: -1.40, ry:  0.10, rz: -0.08 },
    { x:  0.034, y: 0.214, z: 0.032, rx: -1.35, ry:  0.25, rz: -0.18 },
    // Fileira média da coroa
    { x: -0.030, y: 0.224, z: 0.006, rx: -1.48, ry: -0.22, rz: 0.14 },
    { x:  0.000, y: 0.228, z: 0.008, rx: -1.52, ry:  0.00, rz: 0.00 },
    { x:  0.030, y: 0.224, z: 0.006, rx: -1.48, ry:  0.22, rz: -0.14 },
    // Fileira posterior do topo
    { x: -0.026, y: 0.220, z: -0.024, rx: -1.62, ry: -0.18, rz: 0.10 },
    { x:  0.000, y: 0.224, z: -0.022, rx: -1.65, ry:  0.00, rz: 0.00 },
    { x:  0.026, y: 0.220, z: -0.024, rx: -1.62, ry:  0.18, rz: -0.10 }
  ];

  crownCards.forEach((c) => {
    const card = new THREE.Mesh(topCardGeo, mats.hairCardMat);
    card.position.set(c.x, c.y, c.z);
    card.rotation.set(c.rx, c.ry, c.rz);
    card.castShadow = true;
    hairCardsGroup.add(card);
  });

  // 2. Franja Frontal Tática (Fechando o topo da testa sem cobrir o 1/3 facial)
  const fringeCardGeo = createHairCardGeometry(THREE, 0.032, 0.044, 0.008, 0.20);
  const fringeCards = [
    { x: -0.044, y: 0.190, z: 0.050, rx: -1.22, ry: -0.32, rz:  0.22 },
    { x: -0.022, y: 0.196, z: 0.054, rx: -1.26, ry: -0.12, rz:  0.10 },
    { x:  0.000, y: 0.198, z: 0.056, rx: -1.28, ry:  0.00, rz:  0.00 },
    { x:  0.022, y: 0.196, z: 0.054, rx: -1.26, ry:  0.12, rz: -0.10 },
    { x:  0.044, y: 0.190, z: 0.050, rx: -1.22, ry:  0.32, rz: -0.22 }
  ];

  fringeCards.forEach((f) => {
    const card = new THREE.Mesh(fringeCardGeo, mats.hairCardMat);
    card.position.set(f.x, f.y, f.z);
    card.rotation.set(f.rx, f.ry, f.rz);
    card.castShadow = true;
    hairCardsGroup.add(card);
  });

  // 3. Mechas Laterais das Têmporas & Fade Parietal (Abraçando o crânio tangencialmente)
  const templeCardGeo = createHairCardGeometry(THREE, 0.024, 0.038, 0.005, 0.14);
  for (const side of [-1, 1]) {
    const lateralCards = [
      { x: side * 0.062, y: 0.190, z: 0.020, rx: -0.80, ry: side * 1.15, rz: side * -0.18 },
      { x: side * 0.065, y: 0.180, z: 0.000, rx: -0.70, ry: side * 1.25, rz: side * -0.15 },
      { x: side * 0.063, y: 0.170, z: -0.022, rx: -0.60, ry: side * 1.35, rz: side * -0.12 }
    ];
    lateralCards.forEach((l) => {
      const card = new THREE.Mesh(templeCardGeo, mats.hairCardMat);
      card.position.set(l.x, l.y, l.z);
      card.rotation.set(l.rx, l.ry, l.rz);
      card.castShadow = true;
      hairCardsGroup.add(card);
    });
  }

  // 4. Mechas da Coroa Traseira e Nuca (Back occipital slope)
  const backCardGeo = createHairCardGeometry(THREE, 0.036, 0.050, 0.008, 0.20);
  for (let b = -2; b <= 2; b++) {
    const card = new THREE.Mesh(backCardGeo, mats.hairCardMat);
    card.position.set(b * 0.020, 0.198 - Math.abs(b) * 0.006, -0.058);
    card.rotation.set(0.72 + Math.abs(b) * 0.05, b * 0.22, b * -0.10);
    card.castShadow = true;
    hairCardsGroup.add(card);
  }

  headGroup.add(hairCardsGroup);
  return headGroup;
}

// ═══════════════════════════════════════════════════════════════════════════
// PESCOÇO COM GOLA TÁTICA MILITAR (MANDARIN COLLAR)
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalNeck(THREE, mats) {
  const neckGroup = new THREE.Group();
  neckGroup.name = 'neck';

  const neckLen = 0.055 * H; // ~0.096m

  const neckProfile = [
    { t: 0.0, a: 8.0, b: 7.8, n: 2.2, oz: 0.2 }, // Base clavicular
    { t: 0.5, a: 6.4, b: 6.6, n: 2.1, oz: 0.8 }, // Meio
    { t: 1.0, a: 5.2, b: 5.6, n: 2.0, oz: 1.6 }  // Submandibular
  ];

  const neckSecs = makeSections({
    start: [0, 0, 0],
    dir: [0, 1, 0],
    length: neckLen,
    profile: neckProfile,
    rings: 8,
    segments: 24
  });

  const neckGeo = loftGeometry(THREE, neckSecs, { capStart: false, capEnd: false });
  const neckMesh = new THREE.Mesh(neckGeo, mats.skinMat);
  neckMesh.name = 'tactical_neck_mesh';
  neckMesh.castShadow = true;
  neckMesh.receiveShadow = true;
  neckGroup.add(neckMesh);

  // Gola tática de combate (Mandarin collar anatômica)
  const collarGeo = new THREE.CylinderGeometry(0.076, 0.082, 0.038, 24);
  const collarMesh = new THREE.Mesh(collarGeo, mats.oliveCombatMat);
  collarMesh.position.set(0, 0.020, 0.006);
  collarMesh.scale.set(1.0, 1.0, 0.94);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  neckGroup.add(collarMesh);

  // Aba frontal suave de fechamento integrada em cinza tático
  const collarTabGeo = new THREE.BoxGeometry(0.022, 0.026, 0.006);
  const collarTabMesh = new THREE.Mesh(collarTabGeo, mats.darkTacticalGreyMat);
  collarTabMesh.position.set(0, 0.020, 0.082);
  neckGroup.add(collarTabMesh);

  return neckGroup;
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPA 2: TRONCO COM FARDA COMBAT SHIRT & COLETE BALÍSTICO 3D PROEMINENTE
// ═══════════════════════════════════════════════════════════════════════════
function createTorsoAndTacticalVest(THREE, mats) {
  const torsoGroup = new THREE.Group();
  torsoGroup.name = 'tactical_torso_and_vest';

  const waistY = 0.0;
  const neckJunctionY = (0.842 - 0.528) * H; // ~0.5495m
  const torsoLen = neckJunctionY - waistY;

  // 1. Tronco Base: Farda de Combate Atlética com Painéis Cinza Tático
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
    rings: 16,
    segments: 28
  });

  const torsoGeo = loftGeometry(THREE, torsoSecs, { capStart: true, capEnd: false });
  const torsoMesh = new THREE.Mesh(torsoGeo, mats.greyCombatShirtMat);
  torsoMesh.name = 'combat_shirt_torso_mesh';
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. COLETE BALÍSTICO 3D PROEMINENTE (PLATE CARRIER COM RELEVO REAL)
  // ═══════════════════════════════════════════════════════════════════════════
  const vestGroup = new THREE.Group();
  vestGroup.name = 'ballistic_vest_3d';

  // A. Placa Balística Frontal (Torácica e Abdominal com Corte SAPI)
  const vestFrontProfile = [
    { t: 0.00, a: 17.2, b: 7.6, n: 2.4, oz: 8.8 },  // Abdômen inferior
    { t: 0.25, a: 17.6, b: 8.0, n: 2.4, oz: 9.2 },  // Linha umbilical
    { t: 0.55, a: 18.2, b: 8.6, n: 2.5, oz: 10.0 }, // Peitoral
    { t: 0.82, a: 17.0, b: 8.4, n: 2.5, oz: 9.6 },  // Corte angular SAPI
    { t: 1.00, a: 13.6, b: 7.4, n: 2.3, oz: 8.5 }   // Clavícula
  ];

  const vestFrontSecs = makeSections({
    start: [0, waistY + 0.055, 0],
    dir: [0, 1, 0],
    length: torsoLen * 0.68,
    profile: vestFrontProfile,
    rings: 10,
    segments: 22
  });

  const vestFrontGeo = loftGeometry(THREE, vestFrontSecs, { capStart: true, capEnd: true });
  const vestFrontMesh = new THREE.Mesh(vestFrontGeo, mats.vestMainMat);
  vestFrontMesh.name = 'vest_front_plate';
  vestFrontMesh.castShadow = true;
  vestFrontMesh.receiveShadow = true;
  vestGroup.add(vestFrontMesh);

  // Borda de reforço superior da placa frontal
  const frontBorderGeo = new THREE.BoxGeometry(0.265, 0.018, 0.022);
  const frontBorderMesh = new THREE.Mesh(frontBorderGeo, mats.vestBorderMat);
  frontBorderMesh.position.set(0, waistY + torsoLen * 0.72, 0.174);
  frontBorderMesh.castShadow = true;
  vestGroup.add(frontBorderMesh);

  // B. Placa Balística Traseira (Costas e Coluna com Drag Handle)
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
    rings: 8,
    segments: 20
  });

  const vestBackGeo = loftGeometry(THREE, vestBackSecs, { capStart: true, capEnd: true });
  const vestBackMesh = new THREE.Mesh(vestBackGeo, mats.vestMainMat);
  vestBackMesh.name = 'vest_back_plate';
  vestBackMesh.castShadow = true;
  vestBackMesh.receiveShadow = true;
  vestGroup.add(vestBackMesh);

  // C. Alça de Resgate Tática Traseira (Drag Handle)
  const dragHandleGeo = new THREE.BoxGeometry(0.092, 0.016, 0.026);
  const dragHandleMesh = new THREE.Mesh(dragHandleGeo, mats.vestStrapMat);
  dragHandleMesh.position.set(0, waistY + torsoLen * 0.70, -0.165);
  dragHandleMesh.castShadow = true;
  vestGroup.add(dragHandleMesh);

  // D. Alças de Ombro Acolchoadas (Shoulder Straps com fivelas)
  for (const sgn of [-1, 1]) {
    const strapGeo = new THREE.BoxGeometry(0.052, 0.190, 0.028);
    const strapMesh = new THREE.Mesh(strapGeo, mats.vestStrapMat);
    strapMesh.position.set(sgn * 0.112, waistY + torsoLen * 0.76, 0.015);
    strapMesh.rotation.x = 0.22;
    strapMesh.castShadow = true;
    vestGroup.add(strapMesh);

    // Fivela de liberação rápida no ombro
    const buckleGeo = new THREE.BoxGeometry(0.056, 0.020, 0.032);
    const buckleMesh = new THREE.Mesh(buckleGeo, mats.buckleMetalMat);
    buckleMesh.position.set(sgn * 0.112, waistY + torsoLen * 0.73, 0.124);
    vestGroup.add(buckleMesh);
  }

  // E. Cummerbund Lateral (Faixas laterais elásticas MOLLE fechando o colete)
  for (const sgn of [-1, 1]) {
    const cummerbundGeo = new THREE.BoxGeometry(0.024, 0.155, 0.215);
    const cummerbundMesh = new THREE.Mesh(cummerbundGeo, mats.vestBorderMat);
    cummerbundMesh.position.set(sgn * 0.184, waistY + 0.170, 0.010);
    cummerbundMesh.castShadow = true;
    vestGroup.add(cummerbundMesh);
  }

  // F. Fitas MOLLE Webbing em Relevo Frontal (4 linhas horizontais bem contrastadas)
  for (let rIdx = 0; rIdx < 4; rIdx++) {
    const yPos = waistY + 0.145 + rIdx * 0.042;
    const molleGeo = new THREE.BoxGeometry(0.255, 0.018, 0.016);
    const molleMesh = new THREE.Mesh(molleGeo, mats.vestStrapMat);
    molleMesh.position.set(0, yPos, 0.172 + (rIdx >= 2 ? 0.008 : 0.0));
    molleMesh.castShadow = true;
    vestGroup.add(molleMesh);
  }

  // G. Painel de Velcro Superior para Patch de Identificação em Cinza Tático
  const patchGeo = new THREE.BoxGeometry(0.128, 0.044, 0.014);
  const patchMesh = new THREE.Mesh(patchGeo, mats.patchVelcroMat);
  patchMesh.position.set(0, waistY + torsoLen * 0.62, 0.175);
  patchMesh.rotation.x = -0.10;
  patchMesh.castShadow = true;
  vestGroup.add(patchMesh);

  // Insígnia/bandeira tática no patch
  const flagGeo = new THREE.BoxGeometry(0.075, 0.030, 0.016);
  const flagMesh = new THREE.Mesh(flagGeo, mats.darkTacticalGreyMat);
  flagMesh.position.set(0, waistY + torsoLen * 0.62, 0.178);
  flagMesh.rotation.x = -0.10;
  vestGroup.add(flagMesh);

  // H. Porta-Carregadores Triplo 3D Proeminente (Triple 5.56 Mag Pouch frontal)
  for (let m = -1; m <= 1; m++) {
    const magGeo = new THREE.BoxGeometry(0.068, 0.125, 0.042);
    const magMesh = new THREE.Mesh(magGeo, mats.magPouchMat);
    magMesh.position.set(m * 0.076, waistY + 0.142, 0.185);
    magMesh.castShadow = true;
    magMesh.receiveShadow = true;
    vestGroup.add(magMesh);

    // Bungee pull tab no topo do carregador
    const tabGeo = new THREE.BoxGeometry(0.032, 0.020, 0.020);
    const tabMesh = new THREE.Mesh(tabGeo, mats.vestStrapMat);
    tabMesh.position.set(m * 0.076, waistY + 0.210, 0.185);
    vestGroup.add(tabMesh);
  }

  // I. Rádio Comunicador / PTT Tático no Peito Esquerdo
  const radioGeo = new THREE.BoxGeometry(0.046, 0.092, 0.032);
  const radioMesh = new THREE.Mesh(radioGeo, mats.polymerHardPadMat);
  radioMesh.position.set(0.142, waistY + torsoLen * 0.54, 0.165);
  radioMesh.rotation.z = -0.06;
  radioMesh.castShadow = true;
  vestGroup.add(radioMesh);

  // Antena do rádio
  const antennaGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.105, 8);
  const antennaMesh = new THREE.Mesh(antennaGeo, mats.polymerHardPadMat);
  antennaMesh.position.set(0.155, waistY + torsoLen * 0.54 + 0.095, 0.165);
  vestGroup.add(antennaMesh);

  // Botão PTT com fio
  const pttGeo = new THREE.CylinderGeometry(0.010, 0.010, 0.012, 12);
  const pttMesh = new THREE.Mesh(pttGeo, mats.buckleMetalMat);
  pttMesh.position.set(0.088, waistY + torsoLen * 0.68, 0.170);
  pttMesh.rotation.x = Math.PI * 0.5;
  vestGroup.add(pttMesh);

  torsoGroup.add(vestGroup);
  return torsoGroup;
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPA 3: MÃOS ANATÔMICAS ORGÂNICAS EM CASCATA RELAXADA OU PREENSÃO TÁTICA
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalHand(THREE, side, wristPos, armDir, mats, options = {}) {
  const handGroup = new THREE.Group();
  const sgn = side === 'left' ? 1 : -1;
  handGroup.name = `tactical_hand_${side}`;
  const grip = options.grip === true;

  // Base Ortonormal Biomecânica
  const d = norm(armDir);
  const vAnt = [0, 0, 1];
  const rTrans = norm(sub(vAnt, mul(d, dot(d, vAnt))));
  const uPalmRaw = cross(d, rTrans);
  const uPalm = mul(uPalmRaw, (dot(uPalmRaw, [-sgn, 0, 0]) >= 0 ? 1 : -1));

  const handLen = 0.108 * H;     // ~0.189m
  const palmLen = 0.50 * handLen; // ~0.095m

  // 1. Palma Orgânica com Seções Super-Elípticas (n in [2.1, 2.4])
  const palmRingsCount = 7;
  const palmRings = [];
  const palmProfile = [
    { t: 0.00, a: 3.0, b: 2.4, n: 2.1, oz: 0.00 }, // Encaixe exato no punho
    { t: 0.22, a: 3.5, b: 2.2, n: 2.3, oz: 0.05 }, // Base carpal
    { t: 0.50, a: 4.0, b: 1.9, n: 2.4, oz: 0.10 }, // Arco palmar concha
    { t: 0.78, a: 4.1, b: 1.7, n: 2.4, oz: 0.06 }, // Metacarpos
    { t: 0.94, a: 3.8, b: 1.4, n: 2.3, oz: 0.02 }, // Linha de nós MCP
    { t: 1.04, a: 2.0, b: 0.7, n: 2.1, oz: 0.00 }  // Domo de fechamento
  ];

  for (let s = 0; s < palmRingsCount; s++) {
    const t = s / (palmRingsCount - 1);
    let p0 = palmProfile[0], p1 = palmProfile[palmProfile.length - 1];
    for (let i = 0; i < palmProfile.length - 1; i++) {
      if (t >= palmProfile[i].t && t <= palmProfile[i + 1].t) {
        p0 = palmProfile[i];
        p1 = palmProfile[i + 1];
        break;
      }
    }
    const span = p1.t - p0.t || 1e-4;
    const f = (t - p0.t) / span;
    const a = (p0.a + (p1.a - p0.a) * f) * k;
    const b = (p0.b + (p1.b - p0.b) * f) * k;
    const n = p0.n + (p1.n - p0.n) * f;
    const oz = ((p0.oz || 0) + ((p1.oz || 0) - (p0.oz || 0)) * f) * k;

    const center = add(add(wristPos, mul(d, palmLen * t)), mul(uPalm, oz));
    const ring2D = superRing(a, b, n, 16);
    const secPts = ring2D.map(([px, pz]) => {
      return add(center, add(mul(rTrans, px), mul(uPalm, pz)));
    });
    palmRings.push(secPts);
  }

  const palmGeo = loftGeometry(THREE, palmRings, { capStart: false, capEnd: true });
  const palmMesh = new THREE.Mesh(palmGeo, mats.skinMat);
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  handGroup.add(palmMesh);

  // Eminência Tenar (+1.2 cm relevo anterior-palmar)
  const thenarGeo = new THREE.SphereGeometry(0.016, 14, 12);
  const thenarMesh = new THREE.Mesh(thenarGeo, mats.skinMat);
  const thenarPos = add(
    add(wristPos, mul(d, palmLen * 0.38)),
    add(mul(rTrans, 0.020), mul(uPalm, 0.010))
  );
  thenarMesh.position.set(thenarPos[0], thenarPos[1], thenarPos[2]);
  thenarMesh.scale.set(1.15, 1.45, 0.85);
  thenarMesh.castShadow = true;
  handGroup.add(thenarMesh);

  // Eminência Hipotenar (+0.8 cm relevo posterior-palmar)
  const hypoGeo = new THREE.SphereGeometry(0.014, 14, 12);
  const hypoMesh = new THREE.Mesh(hypoGeo, mats.skinMat);
  const hypoPos = add(
    add(wristPos, mul(d, palmLen * 0.44)),
    add(mul(rTrans, -0.020), mul(uPalm, 0.007))
  );
  hypoMesh.position.set(hypoPos[0], hypoPos[1], hypoPos[2]);
  hypoMesh.scale.set(0.95, 1.5, 0.75);
  hypoMesh.castShadow = true;
  handGroup.add(hypoMesh);

  // 2. Dedos: Cascata Relaxada (12°-32°) ou Preensão Tangencial Firme (72°-84°) com Nós PIP/DIP
  const palmEndCenter = add(wristPos, mul(d, palmLen));
  const midLen = 0.45 * handLen; // ~0.085m

  const fingerDefs = [
    { name: 'index',  transOffset:  0.025, archOffset:  0.001, len: midLen * 0.90, curlDeg: grip ? 78 : 12, w: 0.0088 },
    { name: 'middle', transOffset:  0.008, archOffset:  0.004, len: midLen * 1.00, curlDeg: grip ? 84 : 16, w: 0.0092 },
    { name: 'ring',   transOffset: -0.009, archOffset:  0.000, len: midLen * 0.93, curlDeg: grip ? 80 : 24, w: 0.0086 },
    { name: 'pinky',  transOffset: -0.025, archOffset: -0.004, len: midLen * 0.72, curlDeg: grip ? 72 : 32, w: 0.0076 }
  ];

  fingerDefs.forEach((fDef) => {
    const mcpBase = add(
      add(palmEndCenter, mul(rTrans, fDef.transOffset)),
      mul(d, fDef.archOffset - 0.010)
    );
    const curlRad = (fDef.curlDeg * Math.PI) / 180;

    const fRingsCount = 7;
    const fRings = [];
    for (let s = 0; s < fRingsCount; s++) {
      const t = s / (fRingsCount - 1);
      const ang = curlRad * Math.pow(t, 1.15);
      const tangent = norm(add(mul(d, Math.cos(ang)), mul(uPalm, Math.sin(ang))));
      const localNormal = cross(tangent, rTrans);

      const fCenter = add(
        mcpBase,
        add(
          mul(d, fDef.len * t * Math.cos(ang * 0.5)),
          mul(uPalm, fDef.len * t * Math.sin(ang * 0.5))
        )
      );

      let wMod = 1.0;
      if (t === 0.0) wMod = 1.0;
      else if (t < 0.25) wMod = 0.96;
      else if (t >= 0.25 && t <= 0.45) wMod = 1.06; // Nó PIP
      else if (t > 0.45 && t < 0.65) wMod = 0.90;
      else if (t >= 0.65 && t <= 0.80) wMod = 0.94; // Nó DIP
      else if (t > 0.80 && t < 0.95) wMod = 0.82;   // Polpa distal
      else wMod = 0.25;                             // Domo apical

      const radA = fDef.w * wMod;
      const radB = fDef.w * wMod * 0.88;
      const ring2D = superRing(radA, radB, 2.1, 10);

      const secPts = ring2D.map(([px, pz]) => {
        return add(fCenter, add(mul(rTrans, px), mul(localNormal, pz)));
      });
      fRings.push(secPts);
    }

    const fGeo = loftGeometry(THREE, fRings, { capStart: false, capEnd: true });
    const fMesh = new THREE.Mesh(fGeo, mats.skinMat);
    fMesh.castShadow = true;
    fMesh.receiveShadow = true;
    handGroup.add(fMesh);
  });

  // 3. Polegar: Oposição Medial e Flexão (Relaxada 18° ou Grip Firme Tangencial 70°)
  const thumbLen = midLen * 0.80; // ~0.068m
  const thumbBase = add(
    add(wristPos, mul(d, palmLen * 0.34)),
    add(mul(rTrans, grip ? 0.014 : 0.026), mul(uPalm, grip ? 0.014 : 0.008))
  );

  const thumbOppDeg = ((grip ? 55 : 32) * Math.PI) / 180;
  const thumbCurlDeg = ((grip ? 70 : 18) * Math.PI) / 180;
  const rTransF = grip ? 0.12 : 0.52;
  const dF = grip ? 0.82 : 0.58;
  const uPalmF = grip ? 0.55 : 0.62;
  const thumbMainDir = norm(
    add(
      add(mul(d, dF), mul(rTrans, rTransF)),
      mul(uPalm, Math.sin(thumbOppDeg) * uPalmF)
    )
  );

  const tRingsCount = 7;
  const tRings = [];
  const thumbW = 0.0108;
  for (let s = 0; s < tRingsCount; s++) {
    const t = s / (tRingsCount - 1);
    const curl = thumbCurlDeg * Math.pow(t, 1.2);

    const tCenter = add(
      thumbBase,
      add(
        mul(thumbMainDir, thumbLen * t),
        mul(uPalm, thumbLen * (grip ? 0.35 : 0.25) * Math.sin(curl))
      )
    );

    const tTangent = norm(add(thumbMainDir, mul(uPalm, Math.sin(curl) * (grip ? 0.65 : 0.40))));
    const tTrans = norm(cross(uPalm, tTangent));
    const tNorm = cross(tTangent, tTrans);

    let wMod = 1.0;
    if (t === 0.0) wMod = 1.0;
    else if (t < 0.35) wMod = 0.95;
    else if (t >= 0.35 && t <= 0.55) wMod = 1.08; // Nó MCP
    else if (t > 0.55 && t < 0.75) wMod = 0.94;
    else if (t >= 0.75 && t <= 0.88) wMod = 0.98; // Junta IP
    else if (t > 0.88 && t < 0.96) wMod = 0.84;   // Polpa do polegar
    else wMod = 0.28;                             // Domo apical

    const radA = thumbW * wMod;
    const radB = thumbW * wMod * 0.88;
    const ring2D = superRing(radA, radB, 2.1, 10);

    const secPts = ring2D.map(([px, pz]) => {
      return add(tCenter, add(mul(tTrans, px), mul(tNorm, pz)));
    });
    tRings.push(secPts);
  }

  const thumbGeo = loftGeometry(THREE, tRings, { capStart: false, capEnd: true });
  const thumbMesh = new THREE.Mesh(thumbGeo, mats.skinMat);
  thumbMesh.castShadow = true;
  thumbMesh.receiveShadow = true;
  handGroup.add(thumbMesh);

  return handGroup;
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBROS SUPERIORES: BRAÇOS TÁTICOS COM MANGAS VERDE OLIVA & COTOVELEIRAS
// ═══════════════════════════════════════════════════════════════════════════
export function createTacticalArm(THREE, side, mats, options = {}) {
  const isLeft = side === 'left';
  const sgn = isLeft ? 1 : -1;
  const sideStr = isLeft ? 'Left' : 'Right';

  // 1. Ombro / Clavícula
  const shoulderGroup = new THREE.Group();
  shoulderGroup.name = `shoulder${sideStr}`;
  shoulderGroup.position.set(sgn * 0.195, 0.210, 0.005);

  // Bulbo Anatômico do Deltoide / Ombro (Cúpula muscular arredondada que sela 100% a junção com o tórax)
  const shoulderBulbGeo = new THREE.SphereGeometry(0.066, 22, 18);
  shoulderBulbGeo.scale(1.05, 1.02, 1.06);
  const shoulderBulbMesh = new THREE.Mesh(shoulderBulbGeo, mats.oliveCombatMat);
  shoulderBulbMesh.name = `shoulder_bulb_${sideStr}`;
  shoulderBulbMesh.position.set(sgn * -0.008, 0.016, 0.002);
  shoulderBulbMesh.castShadow = true;
  shoulderBulbMesh.receiveShadow = true;
  shoulderGroup.add(shoulderBulbMesh);

  // 2. Braço Superior (Bíceps / Tríceps) - Manga contínua submersa no bulbo do ombro
  const upperArmGroup = new THREE.Group();
  upperArmGroup.name = `upperArm${sideStr}`;
  shoulderGroup.add(upperArmGroup);

  const upperArmLen = 0.280;
  const upperArmProfile = [
    { t: 0.00, a: 6.2, b: 6.4, n: 2.3 }, // Submerso no bulbo do deltoide
    { t: 0.20, a: 5.8, b: 6.0, n: 2.3 }, // Ventre do deltoide
    { t: 0.45, a: 5.4, b: 5.6, n: 2.3 }, // Bíceps / Tríceps
    { t: 0.75, a: 4.8, b: 5.0, n: 2.2 }, // Braquial
    { t: 1.00, a: 4.3, b: 4.4, n: 2.2 }  // Encaixe submerso no cotovelo
  ];
  const upperArmSecs = makeSections({
    start: [0, 0.022, 0],
    dir: [0, -1, 0],
    length: upperArmLen + 0.038,
    profile: upperArmProfile,
    rings: 9,
    segments: 22
  });
  const upperArmGeo = loftGeometry(THREE, upperArmSecs, { capStart: false, capEnd: false });
  const upperArmMesh = new THREE.Mesh(upperArmGeo, mats.oliveCombatMat);
  upperArmMesh.castShadow = true;
  upperArmMesh.receiveShadow = true;
  upperArmGroup.add(upperArmMesh);

  // Velcro tático com patch no braço superior em cinza tático
  const shoulderPatchGeo = new THREE.BoxGeometry(0.010, 0.052, 0.042);
  const shoulderPatchMesh = new THREE.Mesh(shoulderPatchGeo, mats.patchVelcroMat);
  shoulderPatchMesh.position.set(sgn * 0.058, -0.065, 0.005);
  shoulderPatchMesh.rotation.z = sgn * -0.05;
  upperArmGroup.add(shoulderPatchMesh);

  // 3. Cotovelo Articulado com Bulbo de Tecido Anatômico
  const elbowGroup = new THREE.Group();
  elbowGroup.name = `elbow${sideStr}`;
  elbowGroup.position.set(0, -upperArmLen, 0);
  upperArmGroup.add(elbowGroup);

  // Bulbo anatômico de tecido militar que preenche 100% da junta em qualquer ângulo
  const elbowBulbGeo = new THREE.SphereGeometry(0.043, 16, 12);
  elbowBulbGeo.scale(1.0, 1.05, 0.98);
  const elbowBulbMesh = new THREE.Mesh(elbowBulbGeo, mats.oliveCombatMat);
  elbowBulbMesh.name = `elbow_bulb_${sideStr}`;
  elbowBulbMesh.castShadow = true;
  elbowBulbMesh.receiveShadow = true;
  elbowGroup.add(elbowBulbMesh);

  // Cotoveleira Tática 3D (Hard Polymer Elbow Pad com rebites e tiras)
  const elbowPadGeo = new THREE.BoxGeometry(0.048, 0.065, 0.024);
  const elbowPadMesh = new THREE.Mesh(elbowPadGeo, mats.polymerHardPadMat);
  elbowPadMesh.position.set(0, 0, -0.046);
  elbowPadMesh.rotation.x = -0.15;
  elbowPadMesh.rotation.y = sgn * 0.15;
  elbowPadMesh.castShadow = true;
  elbowGroup.add(elbowPadMesh);

  // 4. Antebraço Submerso no Bulbo
  const forearmGroup = new THREE.Group();
  forearmGroup.name = `forearm${sideStr}`;
  elbowGroup.add(forearmGroup);

  const forearmLen = 0.250;
  const forearmProfile = [
    { t: 0.00, a: 4.4, b: 4.4, n: 2.2 },
    { t: 0.25, a: 4.7, b: 4.5, n: 2.3 },
    { t: 0.55, a: 3.9, b: 3.6, n: 2.2 },
    { t: 0.85, a: 3.3, b: 2.7, n: 2.1 },
    { t: 1.00, a: 3.0, b: 2.4, n: 2.0 }
  ];
  const forearmSecs = makeSections({
    start: [0, 0.018, 0],
    dir: [0, -1, 0],
    length: forearmLen + 0.018,
    profile: forearmProfile,
    rings: 8,
    segments: 22
  });
  const forearmGeo = loftGeometry(THREE, forearmSecs, { capStart: false, capEnd: false });
  const forearmMesh = new THREE.Mesh(forearmGeo, mats.oliveCombatMat);
  forearmMesh.castShadow = true;
  forearmMesh.receiveShadow = true;
  forearmGroup.add(forearmMesh);

  // Punho da manga com tira de ajuste de velcro em cinza tático
  const cuffGeo = new THREE.CylinderGeometry(0.038, 0.036, 0.024, 16);
  const cuffMesh = new THREE.Mesh(cuffGeo, mats.darkTacticalGreyMat);
  cuffMesh.position.set(0, -0.235, 0);
  cuffMesh.rotation.x = Math.PI * 0.5;
  cuffMesh.scale.set(1.0, 1.0, 0.85);
  forearmGroup.add(cuffMesh);

  // Relógio Tático Militar no pulso esquerdo
  if (isLeft) {
    const watchBezelGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16);
    const watchMesh = new THREE.Mesh(watchBezelGeo, mats.buckleMetalMat);
    watchMesh.position.set(0, -0.235, 0.034);
    watchMesh.rotation.x = Math.PI * 0.5;
    forearmGroup.add(watchMesh);
  }

  // 5. Pulso Articulado
  const wristGroup = new THREE.Group();
  wristGroup.name = `wrist${sideStr}`;
  wristGroup.position.set(0, -forearmLen, 0);
  forearmGroup.add(wristGroup);

  // 6. Mão Orgânica
  const handGroup = new THREE.Group();
  handGroup.name = `hand${sideStr}`;
  wristGroup.add(handGroup);

  const organicHand = createTacticalHand(THREE, side, [0, 0, 0], [0, -1, 0], mats, options);
  handGroup.add(organicHand);

  return {
    shoulder: shoulderGroup,
    upperArm: upperArmGroup,
    elbow: elbowGroup,
    forearm: forearmGroup,
    wrist: wristGroup,
    hand: handGroup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPA 4: PELVE TÁTICA COM CINTO RIGGERS & FIVELA COBRA
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalPelvis(THREE, mats) {
  const pelvisGroup = new THREE.Group();
  pelvisGroup.name = 'pelvis';
  pelvisGroup.position.set(0, 0.545 * H, 0); // y ≈ 0.9537m

  const pelvisProfile = [
    { t: 0.00, a: 17.6, b: 11.5, n: 2.3, oz: -0.2 }, // Linha de encaixe dos bulbos dos quadris
    { t: 0.35, a: 17.5, b: 11.6, n: 2.3, oz: -0.3 },
    { t: 0.70, a: 17.0, b: 11.3, n: 2.3, oz: -0.3 },
    { t: 1.00, a: 16.4, b: 10.9, n: 2.2, oz: -0.3 }  // Cintura
  ];

  const pelvisSecs = makeSections({
    start: [0, -0.090, 0],
    dir: [0, 1, 0],
    length: 0.090,
    profile: pelvisProfile,
    rings: 8,
    segments: 28
  });

  const pelvisGeo = loftGeometry(THREE, pelvisSecs, { capStart: false, capEnd: true });
  const pelvisMesh = new THREE.Mesh(pelvisGeo, mats.oliveCombatMat);
  pelvisMesh.name = 'tactical_pants_pelvis';
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  pelvisGroup.add(pelvisMesh);

  // Bulbos Anatômicos dos Quadris (Trocanter Maior / Articulação Coxofemoral contínua)
  for (const s of ['Left', 'Right']) {
    const sgn = s === 'Left' ? 1 : -1;
    const hipBulbGeo = new THREE.SphereGeometry(0.095, 22, 18);
    hipBulbGeo.scale(1.02, 1.06, 0.98);
    const hipBulbMesh = new THREE.Mesh(hipBulbGeo, mats.oliveCombatMat);
    hipBulbMesh.name = `hip_bulb_${s}`;
    hipBulbMesh.position.set(sgn * 0.086, -0.090, 0.000);
    hipBulbMesh.castShadow = true;
    hipBulbMesh.receiveShadow = true;
    pelvisGroup.add(hipBulbMesh);
  }

  // Sela Anatômica Perineal / Crotch Gusset (Fecha 100% a abertura entre as pernas)
  const crotchGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.172, 20);
  crotchGeo.rotateZ(Math.PI * 0.5);
  crotchGeo.scale(1.0, 0.65, 1.25);
  const crotchMesh = new THREE.Mesh(crotchGeo, mats.oliveCombatMat);
  crotchMesh.name = 'crotch_gusset';
  crotchMesh.position.set(0, -0.096, 0.002);
  crotchMesh.castShadow = true;
  crotchMesh.receiveShadow = true;
  pelvisGroup.add(crotchMesh);

  // Painel de flexão lombar traseiro em cinza tático (Stretch lumbar yoke)
  const lumbarGeo = new THREE.BoxGeometry(0.180, 0.040, 0.016);
  const lumbarMesh = new THREE.Mesh(lumbarGeo, mats.darkTacticalGreyMat);
  lumbarMesh.position.set(0, -0.024, -0.118);
  lumbarMesh.castShadow = true;
  pelvisGroup.add(lumbarMesh);

  // Cinto Tático de Alta Resistência (Riggers/Duty Belt com fivela metálica estilo Cobra)
  const beltGeo = new THREE.CylinderGeometry(0.166, 0.164, 0.022, 28);
  const beltMesh = new THREE.Mesh(beltGeo, mats.vestStrapMat);
  beltMesh.position.set(0, -0.008, -0.005);
  beltMesh.scale.set(1.0, 1.0, 0.68);
  beltMesh.castShadow = true;
  pelvisGroup.add(beltMesh);

  // Fivela de engate rápido Cobra em metal escuro
  const buckleGeo = new THREE.BoxGeometry(0.042, 0.026, 0.012);
  const buckleMesh = new THREE.Mesh(buckleGeo, mats.buckleMetalMat);
  buckleMesh.position.set(0, -0.008, 0.082);
  pelvisGroup.add(buckleMesh);

  return pelvisGroup;
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPA 5: BOTA MILITAR TÁTICA (CANO ALTO, COURO, SOLA TRATORADA VULCANIZADA)
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalBoot(THREE, side, mats) {
  const bootGroup = new THREE.Group();
  bootGroup.name = `tactical_boot_${side}`;

  const footLen = 0.152 * H; // ~0.266m
  const soleH = 0.040;       // Sola militar espessa e tratorada (4.0 cm)
  const heelZ = -0.082;      // Recuo do calcanhar
  const ankleH = 0.150;      // Altura canônica da articulação do tornozelo

  // A. Cano Alto Reforçado da Bota Militar (Shaft perfeitamente coaxial com a perna em z = 0)
  const shaftProfile = [
    { t: 0.00, a: 4.8, b: 5.0, n: 2.2, oz: 0.0 }, // Transição com o pé
    { t: 0.45, a: 5.2, b: 5.4, n: 2.2, oz: 0.0 }, // Meio do cano
    { t: 0.85, a: 5.6, b: 5.8, n: 2.2, oz: 0.0 }, // Topo do cano
    { t: 1.00, a: 5.9, b: 6.1, n: 2.2, oz: 0.0 }  // Colar acolchoado superior
  ];

  const shaftSecs = makeSections({
    start: [0, soleH + 0.008, 0.000],
    dir: [0, 1, 0],
    length: ankleH - (soleH + 0.008),
    profile: shaftProfile,
    rings: 6,
    segments: 20
  });

  const shaftGeo = loftGeometry(THREE, shaftSecs, { capStart: false, capEnd: false });
  const shaftMesh = new THREE.Mesh(shaftGeo, mats.tacticalBootLeatherMat);
  shaftMesh.castShadow = true;
  shaftMesh.receiveShadow = true;
  bootGroup.add(shaftMesh);

  // Colar acolchoado reforçado no topo do cano em cinza escuro (coaxial em z = 0)
  const collarGeo = new THREE.CylinderGeometry(0.062, 0.060, 0.024, 20);
  const collarMesh = new THREE.Mesh(collarGeo, mats.darkTacticalGreyMat);
  collarMesh.position.set(0, ankleH - 0.002, 0.000);
  collarMesh.scale.set(1.0, 1.0, 0.95);
  bootGroup.add(collarMesh);

  // B. Cabedal de Couro Tático com Biqueira Reforçada
  const upperProfile = [
    { t: 0.00, a: 3.8, b: 4.0, n: 2.2, oz: 1.0 }, // Calcanhar
    { t: 0.25, a: 4.6, b: 6.2, n: 2.2, oz: 1.6 }, // Peito do pé
    { t: 0.55, a: 5.2, b: 4.8, n: 2.3, oz: 1.0 }, // Metatarsos
    { t: 0.85, a: 4.8, b: 3.2, n: 2.3, oz: 0.3 }, // Biqueira
    { t: 1.00, a: 3.2, b: 2.0, n: 2.2, oz: 0.0 }  // Ponta dos dedos
  ];

  const upperSecs = makeSections({
    start: [0, soleH, heelZ],
    dir: [0, 0, 1],
    length: footLen * 0.98,
    profile: upperProfile,
    rings: 8,
    segments: 20,
    hint: [0, 1, 0]
  });

  const upperGeo = loftGeometry(THREE, upperSecs);
  const upperMesh = new THREE.Mesh(upperGeo, mats.tacticalBootLeatherMat);
  upperMesh.castShadow = true;
  upperMesh.receiveShadow = true;
  bootGroup.add(upperMesh);

  // Biqueira rígida de segurança reforçada (Toe Bumper Cap)
  const toeBumperGeo = new THREE.SphereGeometry(0.042, 14, 10, 0, Math.PI, 0, Math.PI * 0.55);
  const toeBumperMesh = new THREE.Mesh(toeBumperGeo, mats.tacticalBootSoleMat);
  toeBumperMesh.position.set(0, soleH + 0.012, heelZ + footLen * 0.86);
  toeBumperMesh.rotation.x = Math.PI * 0.5;
  toeBumperMesh.scale.set(1.15, 0.72, 1.0);
  bootGroup.add(toeBumperMesh);

  // Ilhoses e cadarços cruzados da bota militar
  const lacePlacketGeo = new THREE.BoxGeometry(0.044, 0.016, 0.098);
  const lacePlacketMesh = new THREE.Mesh(lacePlacketGeo, mats.vestStrapMat);
  lacePlacketMesh.position.set(0, soleH + 0.045, heelZ + 0.095);
  lacePlacketMesh.rotation.x = -0.42;
  bootGroup.add(lacePlacketMesh);

  // Ilhoses metálicos
  for (let eye = 0; eye < 4; eye++) {
    for (const eSide of [-1, 1]) {
      const eyeletGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.004, 8);
      const eyeletMesh = new THREE.Mesh(eyeletGeo, mats.buckleMetalMat);
      eyeletMesh.position.set(eSide * 0.018, soleH + 0.032 + eye * 0.018, heelZ + 0.065 + eye * 0.020);
      eyeletMesh.rotation.x = 0.5;
      bootGroup.add(eyeletMesh);
    }
  }

  // C. Sola Militar Vulcanizada Tratorada (Lugged Heavy-Duty Sole com Salto Elevado)
  const soleProfile = [
    { t: 0.00, a: 4.6, b: 4.8, n: 2.3, oz: 0.2 }, // Calcanhar traseiro
    { t: 0.32, a: 5.0, b: 5.0, n: 2.3, oz: 0.2 }, // Salto de combate elevado
    { t: 0.48, a: 3.8, b: 4.0, n: 2.2, oz: 0.1 }, // Curvatura do arco plantar
    { t: 0.72, a: 5.8, b: 4.8, n: 2.3, oz: 0.0 }, // Planta anterior
    { t: 0.92, a: 5.4, b: 4.2, n: 2.3, oz: -0.1 }, // Bola do pé
    { t: 1.00, a: 3.8, b: 3.0, n: 2.2, oz: -0.2 }  // Bico
  ];

  const soleSecs = makeSections({
    start: [0, 0.002, heelZ - 0.006],
    dir: [0, 0, 1],
    length: footLen * 1.02,
    profile: soleProfile,
    rings: 9,
    segments: 20,
    hint: [0, 1, 0]
  });

  const soleGeo = loftGeometry(THREE, soleSecs);
  const soleMesh = new THREE.Mesh(soleGeo, mats.tacticalBootSoleMat);
  soleMesh.castShadow = true;
  soleMesh.receiveShadow = true;
  bootGroup.add(soleMesh);

  // Salto de combate reforçado sob o calcanhar
  const heelBlockGeo = new THREE.BoxGeometry(0.088, 0.018, 0.080);
  const heelBlockMesh = new THREE.Mesh(heelBlockGeo, mats.tacticalBootSoleMat);
  heelBlockMesh.position.set(0, 0.010, heelZ + 0.038);
  bootGroup.add(heelBlockMesh);

  // Cravos tratorados sob a planta anterior
  for (let lug = 0; lug < 4; lug++) {
    const lugGeo = new THREE.BoxGeometry(0.082, 0.008, 0.016);
    const lugMesh = new THREE.Mesh(lugGeo, mats.tacticalBootSoleMat);
    lugMesh.position.set(0, 0.005, heelZ + 0.125 + lug * 0.032);
    bootGroup.add(lugMesh);
  }

  return bootGroup;
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPA 6: MEMBROS INFERIORES: HIERARQUIA CINEMÁTICA DE PERNAS & JOELHEIRAS 3D
// ═══════════════════════════════════════════════════════════════════════════
function createTacticalLeg(THREE, side, mats) {
  const isLeft = side === 'left';
  const sgn = isLeft ? 1 : -1;
  const sideStr = isLeft ? 'Left' : 'Right';

  // 1. Quadril / Hip Joint
  const hipGroup = new THREE.Group();
  hipGroup.name = `hip${sideStr}`;
  hipGroup.position.set(sgn * 0.086, -0.095, 0.000);

  // 2. Coxa / Thigh
  const thighGroup = new THREE.Group();
  thighGroup.name = `thigh${sideStr}`;
  hipGroup.add(thighGroup);

  const thighLen = 0.355;
  const thighProfile = [
    { t: 0.00, a: 9.1, b: 9.9, n: 2.3 }, // Encaixe pélvico
    { t: 0.25, a: 8.9, b: 9.5, n: 2.3 },
    { t: 0.55, a: 8.4, b: 8.9, n: 2.3 }, // Meio da coxa
    { t: 0.85, a: 7.7, b: 7.9, n: 2.2 }, // Suprapatelar
    { t: 1.00, a: 6.8, b: 7.2, n: 2.2 }  // Joelho
  ];

  const thighSecs = makeSections({
    start: [0, 0.025, 0],
    dir: [0, -1, 0],
    length: thighLen + 0.035,
    profile: thighProfile,
    rings: 9,
    segments: 22
  });

  const thighGeo = loftGeometry(THREE, thighSecs, { capStart: false, capEnd: false });
  const thighMesh = new THREE.Mesh(thighGeo, mats.oliveCombatMat);
  thighMesh.castShadow = true;
  thighMesh.receiveShadow = true;
  thighGroup.add(thighMesh);

  // Painel suprapatelar de flexão em cinza tático (Knee stretch accordion panel)
  const kneeStretchGeo = new THREE.BoxGeometry(0.078, 0.038, 0.012);
  const kneeStretchMesh = new THREE.Mesh(kneeStretchGeo, mats.darkTacticalGreyMat);
  kneeStretchMesh.position.set(0, -0.300, 0.078);
  kneeStretchMesh.rotation.x = -0.12;
  kneeStretchMesh.castShadow = true;
  thighGroup.add(kneeStretchMesh);

  // Bolso Cargo Tático Volumétrico 3D na Coxa Lateral
  const cargoGeo = new THREE.BoxGeometry(0.044, 0.115, 0.092);
  const cargoMesh = new THREE.Mesh(cargoGeo, mats.oliveCombatMat);
  cargoMesh.position.set(sgn * 0.088, -0.175, 0.015);
  cargoMesh.rotation.z = sgn * -0.06;
  cargoMesh.castShadow = true;
  cargoMesh.receiveShadow = true;
  thighGroup.add(cargoMesh);

  // Aba superior do bolso cargo com puxador em cinza tático
  const cargoFlapGeo = new THREE.BoxGeometry(0.048, 0.024, 0.096);
  const cargoFlapMesh = new THREE.Mesh(cargoFlapGeo, mats.darkTacticalGreyMat);
  cargoFlapMesh.position.set(sgn * 0.090, -0.125, 0.015);
  cargoFlapMesh.rotation.z = sgn * -0.06;
  thighGroup.add(cargoFlapMesh);

  // 3. Joelho Articulado com Bulbo Anatômico
  const kneeGroup = new THREE.Group();
  kneeGroup.name = `knee${sideStr}`;
  kneeGroup.position.set(0, -thighLen, 0);
  thighGroup.add(kneeGroup);

  // Bulbo anatômico de tecido militar que preenche 100% da junta do joelho
  const kneeBulbGeo = new THREE.SphereGeometry(0.068, 18, 14);
  kneeBulbGeo.scale(0.96, 1.05, 0.98);
  const kneeBulbMesh = new THREE.Mesh(kneeBulbGeo, mats.oliveCombatMat);
  kneeBulbMesh.name = `knee_bulb_${sideStr}`;
  kneeBulbMesh.castShadow = true;
  kneeBulbMesh.receiveShadow = true;
  kneeGroup.add(kneeBulbMesh);

  // Joelheira Tática 3D Proeminente (Hard Shell Tactical Knee Pad)
  const kneeCapGeo = new THREE.BoxGeometry(0.076, 0.095, 0.034);
  const kneeCapMesh = new THREE.Mesh(kneeCapGeo, mats.polymerHardPadMat);
  kneeCapMesh.position.set(0, 0, 0.072);
  kneeCapMesh.rotation.x = -0.15;
  kneeCapMesh.castShadow = true;
  kneeCapMesh.receiveShadow = true;
  kneeGroup.add(kneeCapMesh);

  // Tiras de retenção elásticas atrás do joelho
  for (const tOffset of [-0.030, 0.030]) {
    const strapGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.016, 16, 1, true);
    const strapMesh = new THREE.Mesh(strapGeo, mats.vestStrapMat);
    strapMesh.position.set(0, tOffset, 0.005);
    strapMesh.scale.set(1.0, 1.0, 0.88);
    kneeGroup.add(strapMesh);
  }

  // 4. Perna / Canela / Shin Submersa no Bulbo
  const shinGroup = new THREE.Group();
  shinGroup.name = `shin${sideStr}`;
  kneeGroup.add(shinGroup);

  const shinLen = 0.350;
  const shinProfile = [
    { t: 0.00, a: 6.8, b: 7.2, n: 2.2 }, // Joelho
    { t: 0.25, a: 7.4, b: 7.6, n: 2.2 }, // Infrapatelar
    { t: 0.55, a: 7.6, b: 7.4, n: 2.2 }, // Panturrilha
    { t: 0.85, a: 6.6, b: 6.4, n: 2.1 }, // Barra da calça
    { t: 1.00, a: 5.8, b: 5.8, n: 2.1 }  // Encaixe da bota
  ];

  const shinSecs = makeSections({
    start: [0, 0.020, 0],
    dir: [0, -1, 0],
    length: shinLen + 0.020,
    profile: shinProfile,
    rings: 8,
    segments: 22
  });

  const shinGeo = loftGeometry(THREE, shinSecs, { capStart: false, capEnd: false });
  const shinMesh = new THREE.Mesh(shinGeo, mats.oliveCombatMat);
  shinMesh.castShadow = true;
  shinMesh.receiveShadow = true;
  shinGroup.add(shinMesh);

  // Barra da calça drapeada e blusada sobre o cano da bota (coaxial em z = 0)
  const cuffLegGeo = new THREE.CylinderGeometry(0.068, 0.064, 0.032, 22);
  const cuffLegMesh = new THREE.Mesh(cuffLegGeo, mats.oliveCombatMat);
  cuffLegMesh.position.set(0, -0.342, 0.000);
  cuffLegMesh.castShadow = true;
  cuffLegMesh.receiveShadow = true;
  shinGroup.add(cuffLegMesh);

  // Tira elástica de retenção da bainha blusada
  const cuffStrapGeo = new THREE.CylinderGeometry(0.069, 0.069, 0.012, 22, 1, true);
  const cuffStrapMesh = new THREE.Mesh(cuffStrapGeo, mats.vestStrapMat);
  cuffStrapMesh.position.set(0, -0.342, 0.000);
  shinGroup.add(cuffStrapMesh);

  // 5. Tornozelo / Ankle Joint
  const ankleGroup = new THREE.Group();
  ankleGroup.name = `ankle${sideStr}`;
  ankleGroup.position.set(0, -shinLen, 0);
  shinGroup.add(ankleGroup);

  // Bulbo Anatômico do Tornozelo (Sela 100% o espaço interno entre calça e bota)
  const ankleBulbGeo = new THREE.SphereGeometry(0.054, 18, 14);
  ankleBulbGeo.scale(0.96, 1.05, 1.00);
  const ankleBulbMesh = new THREE.Mesh(ankleBulbGeo, mats.tacticalBootLeatherMat);
  ankleBulbMesh.name = `ankle_bulb_${sideStr}`;
  ankleBulbMesh.castShadow = true;
  ankleBulbMesh.receiveShadow = true;
  ankleGroup.add(ankleBulbMesh);

  // 6. Pé / Foot Group
  const footGroup = new THREE.Group();
  footGroup.name = `foot${sideStr}`;
  ankleGroup.add(footGroup);

  // Bota Militar Completa
  const boot = createTacticalBoot(THREE, side, mats);
  boot.position.set(0, -0.150, 0);
  footGroup.add(boot);

  // 7. Ponta do Pé / Toes Joint
  const toesGroup = new THREE.Group();
  toesGroup.name = `toes${sideStr}`;
  toesGroup.position.set(0, -0.110, 0.120);
  footGroup.add(toesGroup);

  return {
    hip: hipGroup,
    thigh: thighGroup,
    knee: kneeGroup,
    shin: shinGroup,
    ankle: ankleGroup,
    foot: footGroup,
    toes: toesGroup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT DO MODELO PROCEDURAL (EXPORTAÇÃO CANÔNICA)
// ═══════════════════════════════════════════════════════════════════════════
export function createCharacter(THREEInstance = THREE, options = {}) {
  const T = THREEInstance || THREE;
  const mats = options.mats || createCharacterMaterials(T, options);

  const rootGroup = new T.Group();
  rootGroup.name = 'TacticalMan_MidPoly';

  // 1. Pelve (Raiz do esqueleto biomecânico em y ≈ 0.950m)
  const pelvis = createTacticalPelvis(T, mats);
  rootGroup.add(pelvis);

  // 2. Coluna & Tórax
  const spineLower = new T.Group();
  spineLower.name = 'spineLower';
  spineLower.position.set(0, 0.050, 0);
  pelvis.add(spineLower);

  const chest = new T.Group();
  chest.name = 'chest';
  chest.position.set(0, 0.110, 0);
  spineLower.add(chest);

  // Tronco & Colete Balístico 3D montados no Tórax (chest)
  const torsoAndVest = createTorsoAndTacticalVest(T, mats);
  torsoAndVest.position.set(0, -0.186, 0);
  chest.add(torsoAndVest);

  // 3. Pescoço & Cabeça (montados no Tórax)
  const neck = createTacticalNeck(T, mats);
  neck.position.set(0, 0.328, 0.005);
  chest.add(neck);

  const head = createTacticalHead(T, mats);
  head.position.set(0, 0.084, 0.010);
  neck.add(head);

  // 4. Membros Superiores (montados no Tórax)
  const leftArm = createTacticalArm(T, 'left', mats, options);
  chest.add(leftArm.shoulder);

  const rightArm = createTacticalArm(T, 'right', mats, options);
  chest.add(rightArm.shoulder);

  // 5. Membros Inferiores (montados na Pelve)
  const leftLeg = createTacticalLeg(T, 'left', mats);
  pelvis.add(leftLeg.hip);

  const rightLeg = createTacticalLeg(T, 'right', mats);
  pelvis.add(rightLeg.hip);

  // 6. Registro oficial de juntas e rig metadata
  rootGroup.userData = {
    characterName: 'Homem Tático Contínuo (Mid-Poly — PBR Físico & Bulbos Anatômicos)',
    hasRig: true,
    isStaticSculpture: false,
    height: H,
    mats,
    joints: {
      pelvis,
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
      toesRight: rightLeg.toes,
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
      handRight: rightArm.hand
    }
  };

  return rootGroup;
}

export default createCharacter;
