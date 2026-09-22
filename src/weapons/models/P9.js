/**
 * P9 Tactical Pistol — Modelo Procedural
 */

import * as THREE from 'three';

const M_BODY   = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.28, metalness: 0.85 });
const M_ACCENT = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.22, metalness: 0.75 });
const M_STEEL  = new THREE.MeshStandardMaterial({ color: 0x3d434d, roughness: 0.18, metalness: 0.92 });
const M_GRIP   = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.88, metalness: 0.1 });
const M_GOLD   = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.8 });
const M_TRIT   = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildP9() {
  const g = new THREE.Group();

  // Ferrolho metálico usinado com serrilhado frontal
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.032, 0.165), M_STEEL);
  slide.position.set(0, 0.016, -0.015);

  // Janela de ejeção de cartuchos com detalhe dourado
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.032), M_GOLD);
  chamber.position.set(0.006, 0.022, -0.010);

  // Armação de polímero inferior
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.036, 0.11), M_BODY);
  frame.position.set(0, -0.014, -0.005);

  // Trilho de acessórios inferior
  const underRail = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.008, 0.05), M_ACCENT);
  underRail.position.set(0, -0.012, -0.06);

  // Punho anatômico
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.098, 0.042), M_GRIP);
  grip.position.set(0, -0.072, 0.055);
  grip.rotation.x = -0.20;

  // Guarda-mato curvo
  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.005, 0.038), M_BODY);
  trigGuard.position.set(0, -0.042, 0.015);

  // Gatilho
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.008), M_ACCENT);
  trigger.position.set(0, -0.030, 0.012);
  trigger.rotation.x = 0.25;

  // Mira de três pontos (Trítio brilhante)
  const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.009, 0.003), M_BODY);
  frontPost.position.set(0, 0.032, -0.083);
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0020, 8, 8), M_TRIT);
  frontDot.position.set(0, 0.036, -0.083);

  const rearL = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.008, 0.004), M_BODY);
  rearL.position.set(-0.0072, 0.036, 0.06);
  const rearR = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.008, 0.004), M_BODY);
  rearR.position.set(0.0072, 0.036, 0.06);

  g.add(
    slide, chamber, frame, underRail,
    grip, trigGuard, trigger,
    frontPost, frontDot, rearL, rearR
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
