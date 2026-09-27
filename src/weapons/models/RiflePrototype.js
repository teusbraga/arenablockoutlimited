/**
 * ============================================================================
 *   RIFLE PROTOTYPE — Modelo Procedural (portado do standalone Three.js)
 * ============================================================================
 * Geometria original: protótipo de visualização 3D (rifle_prototype.html)
 * Adaptações para o projeto FPS Blocky:
 *   - Eixo do cano: Z negativo (padrão câmera Three.js, muzzle em -Z)
 *     O original usava X positivo; aqui rotacionamos o grupo raiz 90° em Y.
 *   - Ferrolho isolado em sub-group exportado para animação de blowback
 *     via Viewmodel.js (offset em Z em vez de X do original).
 *   - Sem sistema de desmontagem, slots ou bancada — apenas geometria + bolt.
 *   - Materiais PBR idênticos ao original (steel, polymer, brass, accent).
 * ============================================================================
 */

import * as THREE from 'three';

/* ── Materiais PBR ─────────────────────────────────────────────────────── */
const M_STEEL      = new THREE.MeshStandardMaterial({ color: 0x3c434a, metalness: 0.92, roughness: 0.36 });
const M_DARK_STEEL = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.88, roughness: 0.44 });
const M_BLACK      = new THREE.MeshStandardMaterial({ color: 0x14171a, metalness: 0.35, roughness: 0.78 });
const M_POLYMER    = new THREE.MeshStandardMaterial({ color: 0x1e2226, metalness: 0.12, roughness: 0.86 });
const M_ACCENT     = new THREE.MeshStandardMaterial({ color: 0x9a6630, metalness: 0.75, roughness: 0.42 });
const M_BRASS      = new THREE.MeshStandardMaterial({ color: 0xc09a44, metalness: 0.95, roughness: 0.28 });
const M_SIGHT      = new THREE.MeshStandardMaterial({ color: 0x2c3138, metalness: 0.90, roughness: 0.40 });

/* ── Helper: cria mesh com sombra ──────────────────────────────────────── */
function mk(geo, mat, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat.clone());
  m.position.set(px, py, pz);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * buildRiflePrototype()
 * Retorna { group, boltGroup }.
 *   group     — THREE.Group raiz a ser adicionado ao viewmodel.mount
 *   boltGroup — sub-group do ferrolho para animação de blowback no Viewmodel
 *
 * Convenção de coordenadas (igual demais modelos do projeto):
 *   +Y = cima
 *   -Z = frente (direção do cano / muzzle)
 *   +X = direita
 *
 * O modelo original (standalone) usava +X como direção do cano.
 * Solução: construímos tudo no espaço original (+X = cano) dentro de um
 * innerGroup e rotacionamos innerGroup 90° em Y, alinhando o cano para -Z.
 */
export function buildRiflePrototype() {
  /* Grupo raiz retornado ao Viewmodel */
  const group = new THREE.Group();

  /**
   * innerGroup: espaço de construção original (+X = cano).
   * Após montagem completa, é rotacionado -90° em Y para que
   * o cano aponte em -Z (padrão do projeto).
   */
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2;
  group.add(inner);

  /* ── 1. RECEIVER (base) ─────────────────────────────────────────────── */
  const receiver = new THREE.Group();

  // Corpo principal
  receiver.add(mk(new THREE.BoxGeometry(0.36, 0.09, 0.10), M_STEEL, 0, 0, 0));

  // Porta de ejeção (lado direito)
  receiver.add(mk(new THREE.BoxGeometry(0.115, 0.042, 0.012), M_DARK_STEEL, 0.025, 0.013, 0.0535));

  // Alça de mira traseira
  receiver.add(mk(new THREE.BoxGeometry(0.042, 0.046, 0.058), M_SIGHT, -0.145, 0.067, 0));
  const rearRing = mk(new THREE.TorusGeometry(0.018, 0.0055, 8, 18), M_SIGHT);
  rearRing.position.set(-0.145, 0.101, 0);
  rearRing.rotation.y = Math.PI / 2;
  receiver.add(rearRing);

  // Detalhe inferior (housing do gatilho)
  receiver.add(mk(new THREE.BoxGeometry(0.15, 0.022, 0.082), M_DARK_STEEL, -0.02, -0.052, 0));

  // Pino de articulação
  receiver.add(mk(new THREE.CylinderGeometry(0.007, 0.007, 0.104, 10), M_DARK_STEEL,
    0.12, -0.03, 0, Math.PI / 2, 0, 0));

  inner.add(receiver);

  /* ── 2. CANO ────────────────────────────────────────────────────────── */
  const barrel = new THREE.Group();

  // Cano principal
  barrel.add(mk(new THREE.CylinderGeometry(0.017, 0.017, 0.52, 18), M_STEEL,
    0.44, 0.012, 0, 0, 0, Math.PI / 2));
  // Freio de boca
  barrel.add(mk(new THREE.CylinderGeometry(0.024, 0.024, 0.062, 18), M_DARK_STEEL,
    0.676, 0.012, 0, 0, 0, Math.PI / 2));
  // Bloco de gás
  barrel.add(mk(new THREE.BoxGeometry(0.062, 0.056, 0.056), M_DARK_STEEL, 0.56, 0.014, 0));
  // Tubo de gás
  barrel.add(mk(new THREE.CylinderGeometry(0.0085, 0.0085, 0.30, 10), M_BRASS,
    0.335, 0.032, 0, 0, 0, Math.PI / 2));
  // Massa de mira frontal
  barrel.add(mk(new THREE.BoxGeometry(0.018, 0.052, 0.018), M_SIGHT, 0.56, 0.058, 0));
  const frontRing = mk(new THREE.TorusGeometry(0.014, 0.0042, 8, 16), M_SIGHT);
  frontRing.position.set(0.56, 0.090, 0);
  frontRing.rotation.y = Math.PI / 2;
  barrel.add(frontRing);

  inner.add(barrel);

  /* ── 3. GUARDA-MÃO ──────────────────────────────────────────────────── */
  const handguard = new THREE.Group();

  handguard.add(mk(new THREE.BoxGeometry(0.30, 0.080, 0.088), M_POLYMER, 0.33, -0.004, 0));
  // Trilho inferior
  handguard.add(mk(new THREE.BoxGeometry(0.30, 0.012, 0.020), M_DARK_STEEL, 0.33, -0.048, 0));
  // Tampa frontal
  handguard.add(mk(new THREE.BoxGeometry(0.022, 0.090, 0.096), M_DARK_STEEL, 0.478, -0.004, 0));
  // Fendas laterais
  for (let i = 0; i < 4; i++) {
    handguard.add(mk(new THREE.BoxGeometry(0.020, 0.040, 0.0915), M_BLACK,
      0.235 + i * 0.062, 0.006, 0));
  }

  inner.add(handguard);

  /* ── 4. CORONHA ─────────────────────────────────────────────────────── */
  const stock = new THREE.Group();

  stock.add(mk(new THREE.BoxGeometry(0.34, 0.100, 0.075), M_POLYMER, -0.35, -0.012, 0));
  // Apoio de bochecha
  stock.add(mk(new THREE.BoxGeometry(0.185, 0.036, 0.070), M_POLYMER, -0.400, 0.050, 0));
  // Borracha de culatra
  stock.add(mk(new THREE.BoxGeometry(0.034, 0.132, 0.086), M_BLACK, -0.527, -0.015, 0));
  // Tubo de conexão
  stock.add(mk(new THREE.CylinderGeometry(0.026, 0.026, 0.10, 12), M_DARK_STEEL,
    -0.20, -0.010, 0, 0, 0, Math.PI / 2));

  inner.add(stock);

  /* ── 5. CONJUNTO DO GATILHO ─────────────────────────────────────────── */
  const triggerGroup = new THREE.Group();

  // Empunhadura
  const grip = mk(new THREE.BoxGeometry(0.055, 0.150, 0.070), M_POLYMER,
    -0.055, -0.115, 0, 0, 0, -0.18);
  triggerGroup.add(grip);

  // Guarda do gatilho
  triggerGroup.add(mk(new THREE.BoxGeometry(0.100, 0.008, 0.028), M_DARK_STEEL, -0.025, -0.086, 0));
  triggerGroup.add(mk(new THREE.BoxGeometry(0.008, 0.050, 0.028), M_DARK_STEEL,  0.025, -0.062, 0));

  // Gatilho
  triggerGroup.add(mk(new THREE.BoxGeometry(0.012, 0.050, 0.022), M_ACCENT,
    -0.020, -0.062, 0, 0, 0, 0.12));

  // Martelo interno simplificado
  triggerGroup.add(mk(new THREE.BoxGeometry(0.020, 0.058, 0.030), M_STEEL,
    -0.062, -0.048, 0, 0, 0, -0.20));

  inner.add(triggerGroup);

  /* ── 6. CARREGADOR ──────────────────────────────────────────────────── */
  const magazine = new THREE.Group();
  magazine.position.set(0.070, -0.045, 0);
  magazine.rotation.z = 0.08;

  magazine.add(mk(new THREE.BoxGeometry(0.055, 0.200, 0.080), M_POLYMER, 0, -0.100, 0));
  magazine.add(mk(new THREE.BoxGeometry(0.062, 0.014, 0.088), M_DARK_STEEL, 0, -0.205, 0));
  magazine.add(mk(new THREE.BoxGeometry(0.058, 0.028, 0.084), M_DARK_STEEL, 0, -0.020, 0));
  // Munição visível no topo
  magazine.add(mk(new THREE.BoxGeometry(0.014, 0.020, 0.060), M_BRASS, 0, 0.012, 0));

  inner.add(magazine);

  /* ── 7. FERROLHO (sub-group exportado para blowback) ───────────────── */
  const boltGroup = new THREE.Group();
  boltGroup.position.set(0, 0.073, 0);

  boltGroup.add(mk(new THREE.CylinderGeometry(0.028, 0.028, 0.20, 18), M_DARK_STEEL,
    0, 0, 0, 0, 0, Math.PI / 2));
  // Cabeça do ferrolho
  boltGroup.add(mk(new THREE.CylinderGeometry(0.021, 0.021, 0.032, 14), M_STEEL,
    0.112, 0, 0, 0, 0, Math.PI / 2));
  // Alavanca de manejo
  boltGroup.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 0.062, 10), M_STEEL,
    0.055, 0, 0.046, Math.PI / 2, 0, 0));
  const boltKnob = mk(new THREE.SphereGeometry(0.017, 14, 12), M_ACCENT);
  boltKnob.position.set(0.055, 0, 0.079);
  boltGroup.add(boltKnob);

  inner.add(boltGroup);

  /* ── 8. BOTÃO DE LIBERAÇÃO DO CARREGADOR ────────────────────────────── */
  const magRelease = new THREE.Group();
  magRelease.add(mk(new THREE.CylinderGeometry(0.013, 0.013, 0.024, 14), M_ACCENT,
    0.132, -0.020, 0.056, Math.PI / 2, 0, 0));
  magRelease.add(mk(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 14), M_DARK_STEEL,
    0.132, -0.020, 0.045, Math.PI / 2, 0, 0));
  inner.add(magRelease);

  /* ── 9. Sombras em tudo ─────────────────────────────────────────────── */
  group.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, boltGroup };
}
