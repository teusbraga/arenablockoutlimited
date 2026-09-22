/**
 * ============================================================================
 *               UZI 9mm SUBMACHINE GUN — MODELO PROCEDURAL
 * ============================================================================
 * Micro-SMG compacta com ferrolho telescópico e carregador inserido na empunhadura
 * (mag-in-grip). Modelada puramente com primitivas geométricas e materiais PBR.
 */

import * as THREE from 'three';

const M_STEEL_DARK   = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.32, metalness: 0.86 });
const M_PARKERIZED   = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.25, metalness: 0.80 });
const M_GRIP_POLYMER = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.90, metalness: 0.08 });
const M_WIRE_STOCK   = new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.20, metalness: 0.92 });
const M_TRIT         = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildUZI() {
  const g = new THREE.Group();

  // 1. Caixa da Culatra Principal (Stamped Steel Receiver)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.045, 0.23), M_STEEL_DARK);
  receiver.position.set(0, 0.012, -0.05);

  // Tampa superior com canaleta da alavanca de manejo
  const topCover = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.012, 0.21), M_PARKERIZED);
  topCover.position.set(0, 0.038, -0.05);

  // Botão de armar superior (Charging Handle com canaleta central vazada para visada limpa)
  const chargerL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.009, 0.018), M_PARKERIZED);
  chargerL.position.set(-0.009, 0.045, -0.03);
  const chargerR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.009, 0.018), M_PARKERIZED);
  chargerR.position.set(0.009, 0.045, -0.03);

  // Janela de ejeção lateral direita
  const ejector = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.038), M_PARKERIZED);
  ejector.position.set(0.016, 0.022, -0.02);

  // 2. Cano & Porca de Fixação Frontal (Barrel & Barrel Nut)
  const barrelNut = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.016, 12), M_PARKERIZED);
  barrelNut.rotation.x = Math.PI / 2;
  barrelNut.position.set(0, 0.012, -0.17);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.065, 12), M_STEEL_DARK);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -0.20);

  // 3. Empunhadura Central (Pistol Grip com Magazine dentro)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.105, 0.045), M_GRIP_POLYMER);
  grip.position.set(0, -0.055, -0.02);
  grip.rotation.x = -0.16;

  // Carregador 9mm estendido saindo por baixo
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.055, 0.038), M_STEEL_DARK);
  mag.position.set(0, -0.125, -0.005);
  mag.rotation.x = -0.16;

  // Guarda-mato e Gatilho
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.005, 0.042), M_PARKERIZED);
  guard.position.set(0, -0.042, -0.06);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.016, 0.007), M_PARKERIZED);
  trigger.position.set(0, -0.030, -0.055);
  trigger.rotation.x = 0.22;

  // Trava de segurança da empunhadura (Grip Safety traseira)
  const gripSafety = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.035, 0.008), M_PARKERIZED);
  gripSafety.position.set(0, -0.032, 0.004);
  gripSafety.rotation.x = -0.16;

  // Guarda-mão frontal de polímero estriado
  const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.030, 0.055), M_GRIP_POLYMER);
  foregrip.position.set(0, -0.012, -0.12);

  // 4. Coronha Dobrável Recolhida (Underfolding Wire Stock)
  const stockBarL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.16), M_WIRE_STOCK);
  stockBarL.position.set(-0.019, -0.010, -0.04);
  const stockBarR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.16), M_WIRE_STOCK);
  stockBarR.position.set(0.019, -0.010, -0.04);

  // 5. Conjunto de Miras UZI Limpo (Clean Peep / U-Notch Sight Picture)
  // Alça de mira traseira: base baixa + aletas laterais finas deixando vão central aberto
  const rearBase = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.005, 0.006), M_PARKERIZED);
  rearBase.position.set(0, 0.043, 0.045);
  const rearWingL = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.006), M_PARKERIZED);
  rearWingL.position.set(-0.009, 0.051, 0.045);
  const rearWingR = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.006), M_PARKERIZED);
  rearWingR.position.set(0.009, 0.051, 0.045);

  // Massa de mira dianteira: aletas curvas com pino e ponto de trítio verde brilhante
  const frontWingL = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.006), M_PARKERIZED);
  frontWingL.position.set(-0.011, 0.049, -0.15);
  const frontWingR = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.016, 0.006), M_PARKERIZED);
  frontWingR.position.set(0.011, 0.049, -0.15);
  const frontPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.011, 8), M_PARKERIZED);
  frontPost.position.set(0, 0.048, -0.15);
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 10, 10), M_TRIT);
  frontDot.position.set(0, 0.053, -0.15);

  g.add(
    receiver, topCover, chargerL, chargerR, ejector,
    barrelNut, barrel,
    grip, mag, guard, trigger, gripSafety, foregrip,
    stockBarL, stockBarR,
    rearBase, rearWingL, rearWingR,
    frontWingL, frontWingR, frontPost, frontDot
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
