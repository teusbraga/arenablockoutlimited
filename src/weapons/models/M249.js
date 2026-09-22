/**
 * ============================================================================
 *               M249 SAW 5.56mm — MODELO PROCEDURAL
 * ============================================================================
 * Metralhadora leve de esquadra (Squad Automatic Weapon) com caixa de munição
 * de 100 tiros (Ammo Box) em verde-oliva, fita de munição 5.56 visível,
 * escudo térmico perfurado, bipé recolhido e coronha militar clubfoot.
 */

import * as THREE from 'three';

const M_PARKERIZED    = new THREE.MeshStandardMaterial({ color: 0x1f2226, roughness: 0.35, metalness: 0.85 });
const M_STEEL_GUN     = new THREE.MeshStandardMaterial({ color: 0x333840, roughness: 0.22, metalness: 0.92 });
const M_AMMO_BOX      = new THREE.MeshStandardMaterial({ color: 0x363d2e, roughness: 0.75, metalness: 0.15 }); // Olive Drab
const M_BRASS_BELT    = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.30, metalness: 0.88 }); // Latão dourado 5.56
const M_POLYMER_BLACK = new THREE.MeshStandardMaterial({ color: 0x0b0d0e, roughness: 0.88, metalness: 0.10 });
const M_HEAT_SHIELD   = new THREE.MeshStandardMaterial({ color: 0x282c32, roughness: 0.40, metalness: 0.70 });
const M_TRIT          = new THREE.MeshBasicMaterial({ color: 0x55ff77 });

export function buildM249() {
  const g = new THREE.Group();

  // 1. Receptor Principal Robusto (Receiver Box)
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.062, 0.34), M_PARKERIZED);
  receiver.position.set(0, 0.015, -0.06);

  // Tampa de alimentação superior com trilho (Feed Tray Cover)
  const feedCover = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.018, 0.22), M_PARKERIZED);
  feedCover.position.set(0, 0.052, -0.08);

  // Trilho superior sobre a tampa
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.16), M_STEEL_GUN);
  topRail.position.set(0, 0.064, -0.08);

  // 2. Cano Pesado Flutuante & Quebra-Chamas Militar
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.22, 12), M_STEEL_GUN);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.018, -0.32);

  const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.045, 12), M_STEEL_GUN);
  flashHider.rotation.x = Math.PI / 2;
  flashHider.position.set(0, 0.018, -0.44);

  // Escudo térmico perfurado sobre o cano (Heat Shield)
  const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.026, 0.15), M_HEAT_SHIELD);
  heatShield.position.set(0, 0.038, -0.26);

  // Bloco de gás e cilindro de pistão inferior
  const gasTube = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.18, 10), M_STEEL_GUN);
  gasTube.rotation.x = Math.PI / 2;
  gasTube.position.set(0, -0.008, -0.28);

  // 3. Caixa de Munição de 100 Tiros (Olive Drab Ammo Box)
  const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.095, 0.085), M_AMMO_BOX);
  ammoBox.position.set(-0.012, -0.068, -0.08);

  // Fita de munição 5.56mm dourada saindo da caixa para a janela de alimentação
  for (let i = 0; i < 4; i++) {
    const round = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 8), M_BRASS_BELT);
    round.rotation.z = Math.PI / 2;
    round.position.set(-0.030 - i * 0.004, 0.012 + i * 0.006, -0.07 + i * 0.008);
    g.add(round);
  }

  // 4. Empunhadura de Pistola Militar (SAW Grip)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.095, 0.044), M_POLYMER_BLACK);
  grip.position.set(0, -0.055, 0.05);
  grip.rotation.x = -0.22;

  // Guarda-mato e Gatilho
  const trigGuard = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.006, 0.044), M_PARKERIZED);
  trigGuard.position.set(0, -0.036, 0.01);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, 0.008), M_STEEL_GUN);
  trigger.position.set(0, -0.024, 0.01);
  trigger.rotation.x = 0.20;

  // 5. Coronha Militar Clubfoot (M249 Stock)
  const stockTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 10), M_STEEL_GUN);
  stockTube.rotation.x = Math.PI / 2;
  stockTube.position.set(0, 0.018, 0.16);

  const stockPad = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.095, 0.035), M_POLYMER_BLACK);
  stockPad.position.set(0, 0.012, 0.23);

  // 6. Alça de Transporte Superior (Carry Handle)
  const handleStem = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.040, 0.012), M_PARKERIZED);
  handleStem.position.set(0.028, 0.055, -0.16);
  handleStem.rotation.z = -0.30;
  const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.065, 8), M_POLYMER_BLACK);
  handleGrip.rotation.x = Math.PI / 2;
  handleGrip.position.set(0.038, 0.075, -0.16);

  // 7. Pernas de Bipé Dobradas (Tucked Bipod Legs)
  const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 8), M_STEEL_GUN);
  bipodL.rotation.x = Math.PI / 2;
  bipodL.position.set(-0.024, -0.010, -0.26);

  const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.18, 8), M_STEEL_GUN);
  bipodR.rotation.x = Math.PI / 2;
  bipodR.position.set(0.024, -0.010, -0.26);

  // 8. Miras de Ferro M249
  // Alça de mira traseira ajustável
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.014), M_PARKERIZED);
  rearSight.position.set(0, 0.072, 0.03);

  // Massa de mira frontal circular com ponto de mira
  const frontBase = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.024, 0.012), M_PARKERIZED);
  frontBase.position.set(0, 0.046, -0.38);
  const frontPin = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.010, 8), M_STEEL_GUN);
  frontPin.position.set(0, 0.056, -0.38);
  const frontDot = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 8), M_TRIT);
  frontDot.position.set(0, 0.060, -0.38);

  g.add(
    receiver, feedCover, topRail,
    barrel, flashHider, heatShield, gasTube,
    ammoBox,
    grip, trigGuard, trigger,
    stockTube, stockPad,
    handleStem, handleGrip,
    bipodL, bipodR,
    rearSight, frontBase, frontPin, frontDot
  );

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
