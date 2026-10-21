/**
 * BarrelCrosshairAlignment.js
 * 
 * Mecânica de Alinhamento Dinâmico de Crosshair pelo Cano (inspirado no WARDOGS / Tarkov):
 * 
 * 1. Projeta um vetor forward a partir da orientação e posição exata do cano (Muzzle)
 *    no espaço de mundo (incorporando sway de viewmodel, recoil, inércia, bob e wall press).
 * 2. Faz raycast contra o mundo físico (ou ponto de mira virtual a distância de convergência).
 * 3. Converte esse ponto de impacto/mira 3D para coordenadas de tela 2D (NDC -> Pixels) via camera.project().
 * 4. Move o elemento DOM da crosshair (#crosshair) para essas coordenadas em pixels:
 *    A CROSSHAIR SEMPRE APONTA PARA ONDE O CANO ESTÁ APONTANDO!
 * 5. Garante que os projéteis disparados sigam exatamente o vetor da crosshair projetada,
 *    eliminando discrepâncias angulares de 90° e mitigando drasticamente o "tracer elástico".
 * 
 * Mapeamento e Pontos de Integração no Projeto:
 * - HUD / DOM Crosshair: src/ui/HUD.js (#crosshair, style.left / style.top)
 * - Viewmodel Muzzle: src/weapons/Viewmodel.js (mount.localToWorld com def.muzzleLocal)
 * - Disparo e Balística: src/weapons/WeaponSystem.js (_fire)
 * - Colisão para Raycast de Convergência: src/physics/CollisionWorld.js
 * 
 * Godot 4.x Porting Reference:
 * - Viewmodel Node3D: Marker3D "MuzzleMarker" no skeleton/viewmodel.
 * - Raycast: PhysicsRayQueryParameters3D.create(muzzle_pos, muzzle_pos + muzzle_dir * 100.0)
 * - Projeção 2D: Camera3D.unproject_position(world_hit_point)
 * - Control UI: CrosshairControl.global_position = screen_pos
 */

import * as THREE from 'three';

const _vMuzzle = new THREE.Vector3();
const _vPureDir = new THREE.Vector3();
const _vMuzzleDir = new THREE.Vector3();
const _vRight = new THREE.Vector3();
const _vUp = new THREE.Vector3();
const _vPureTarget3D = new THREE.Vector3();
const _vScreen = new THREE.Vector3();
const _matRot = new THREE.Matrix4();

export class BarrelCrosshairAlignment {
  /**
   * @param {Object} options
   * @param {THREE.Camera} options.camera Câmera principal de renderização
   * @param {Object} options.viewmodel Instância de src/weapons/Viewmodel.js
   * @param {Object} options.collisionWorld Instância de src/physics/CollisionWorld.js
   * @param {HTMLElement} [options.crosshairEl] Elemento DOM da crosshair (se nulo, busca #crosshair)
   * @param {number} [options.defaultZeroDistance=50.0] Distância padrão de convergência quando não atinge obstáculos (metros)
   */
  constructor({ camera, viewmodel, collisionWorld, crosshairEl = null, defaultZeroDistance = 50.0 }) {
    this.camera = camera;
    this.viewmodel = viewmodel;
    this.collisionWorld = collisionWorld;
    this.crosshairEl = crosshairEl || (typeof document !== 'undefined' ? document.getElementById('crosshair') : null);
    this.defaultZeroDistance = defaultZeroDistance;

    // Estado público da mira guiada pelo cano
    this.screenPos = { x: 0, y: 0 };
    this.aimPointWorld = new THREE.Vector3();
    this.pureAimPointWorld = new THREE.Vector3();
    this.muzzleWorld = new THREE.Vector3();
    this.barrelAimDir = new THREE.Vector3(0, 0, -1);
    this.pureBarrelDir = new THREE.Vector3(0, 0, -1);
    this.hasTarget = false;
    this.distanceToTarget = defaultZeroDistance;

    // Suavização do movimento da crosshair na tela para evitar jitter visual
    this.currentScreenX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    this.currentScreenY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
  }

  /**
   * Atualiza separadamente:
   * 1) A projeção 2D pura do alinhamento físico do cano (this.screenPos: sway, inércia de giro, bobbing,
   *    paralaxe de curta distância e wall press, SEM o recuo de tiro) para a opção "Alinhamento Dinâmico" no HUD.
   * 2) O ponto de mira balístico 3D completo (this.aimPointWorld: alinhamento do cano + recuo/spray)
   *    para onde as balas e tracers realmente vão no mundo 3D.
   * 
   * @param {Object} weaponDef Definição da arma (de src/weapons/WeaponDefs.js)
   * @param {boolean} isADS Se o jogador está mirando com a arma (Iron Sight / Scope)
   * @param {number} [dt=0.016] Delta time do frame
   * @param {THREE.Vector3} [muzzlePosOverride=null] Posição pré-compensada da boca do cano
   * @returns {{ aimPointWorld: THREE.Vector3, barrelAimDir: THREE.Vector3, screenPos: {x: number, y: number} }}
   */
  update(weaponDef, isADS, dt = 0.016, sprayRecoil = null, muzzlePosOverride = null) {
    if (!this.viewmodel || !this.viewmodel.mount || !this.camera || !weaponDef) {
      return {
        aimPointWorld: this.aimPointWorld,
        barrelAimDir: this.barrelAimDir,
        screenPos: this.screenPos
      };
    }

    const mount = this.viewmodel.mount;

    // 1. Obter a posição de mundo da boca do cano (Muzzle)
    if (muzzlePosOverride) {
      this.muzzleWorld.copy(muzzlePosOverride);
    } else {
      const mz = weaponDef.muzzleLocal || [0, 0.02, -0.5];
      _vMuzzle.set(mz[0], mz[1], mz[2]);
      mount.localToWorld(_vMuzzle);
      this.muzzleWorld.copy(_vMuzzle);
    }

    // 2. Extrair matriz de rotação atual do mount
    mount.updateWorldMatrix(true, false);
    _matRot.extractRotation(mount.matrixWorld);

    // 2A. Direção PURA de Alinhamento do Cano (desconta o kickRotX visual do tiro e não soma sprayRecoil)
    // Garante que "Alinhamento Dinâmico ON + Follow Recoil OFF" mostre apenas sway/inércia/paralaxe do cano
    const kickRotX = this.viewmodel.kickRotX || 0;
    _vPureDir.set(0, -Math.sin(kickRotX), -Math.cos(kickRotX)).applyMatrix4(_matRot).normalize();
    this.pureBarrelDir.copy(_vPureDir);

    const rayDist = 120.0;
    let pureHit = null;
    if (this.collisionWorld && typeof this.collisionWorld.raycast === 'function') {
      pureHit = this.collisionWorld.raycast(this.muzzleWorld, this.pureBarrelDir, rayDist);
    }
    if (pureHit && pureHit.point && (pureHit.distance || pureHit.dist) > 0.3) {
      _vPureTarget3D.copy(pureHit.point);
    } else {
      _vPureTarget3D.copy(this.muzzleWorld).addScaledVector(this.pureBarrelDir, this.defaultZeroDistance);
    }
    this.pureAimPointWorld.copy(_vPureTarget3D);

    // 2B. Direção BALÍSTICA Fiel do Cano 3D (respeita mount.matrixWorld, kickRotX físico e sway natural)
    _vMuzzleDir.set(0, 0, -1).applyMatrix4(_matRot).normalize();
    if (sprayRecoil && (Math.abs(sprayRecoil.pitch) > 0.0001 || Math.abs(sprayRecoil.yaw) > 0.0001)) {
      _vRight.set(1, 0, 0).applyMatrix4(_matRot).normalize();
      _vUp.set(0, 1, 0).applyMatrix4(_matRot).normalize();
      const recoilGain = 0.54; // ~17% mais conservador que o antigo 0.65
      _vMuzzleDir.addScaledVector(_vUp, sprayRecoil.pitch * recoilGain)
                 .addScaledVector(_vRight, -sprayRecoil.yaw * recoilGain)
                 .normalize();
    }
    this.barrelAimDir.copy(_vMuzzleDir);

    // 3. Raycast físico balístico para onde o tiro/tracer realmente vai no mundo 3D
    let hit = null;
    if (this.collisionWorld && typeof this.collisionWorld.raycast === 'function') {
      hit = this.collisionWorld.raycast(this.muzzleWorld, this.barrelAimDir, rayDist);
    }

    if (hit && hit.point && (hit.distance || hit.dist) > 0.3) {
      this.hasTarget = true;
      this.distanceToTarget = hit.distance || hit.dist;
      this.aimPointWorld.copy(hit.point);
    } else {
      this.hasTarget = false;
      this.distanceToTarget = this.defaultZeroDistance;
      this.aimPointWorld.copy(this.muzzleWorld).addScaledVector(this.barrelAimDir, this.defaultZeroDistance);
    }

    // 4. Projetar o ponto PURO de alinhamento do cano (_vPureTarget3D) para coordenadas 2D de tela (HUD)
    _vScreen.copy(this.aimPointWorld).project(this.camera);

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

    // Coordenadas em pixels na tela (0,0 no canto superior esquerdo)
    let targetScreenX = screenWidth * 0.5;
    let targetScreenY = screenHeight * 0.5;
    if (_vScreen.z < 1.0) {
      targetScreenX = (_vScreen.x * 0.5 + 0.5) * screenWidth;
      targetScreenY = (-(_vScreen.y * 0.5) + 0.5) * screenHeight;
    }

    // Suavização responsiva das coordenadas 2D projetadas do alinhamento do cano
    if (isADS) {
      const centerX = screenWidth * 0.5;
      const centerY = screenHeight * 0.5;
      const lerpSpeed = Math.min(1.0, dt * 25.0);
      this.currentScreenX += (centerX - this.currentScreenX) * lerpSpeed;
      this.currentScreenY += (centerY - this.currentScreenY) * lerpSpeed;
    } else {
      const lerpSpeed = Math.min(1.0, dt * 35.0);
      this.currentScreenX += (targetScreenX - this.currentScreenX) * lerpSpeed;
      this.currentScreenY += (targetScreenY - this.currentScreenY) * lerpSpeed;
    }

    this.screenPos.x = this.currentScreenX;
    this.screenPos.y = this.currentScreenY;

    return {
      aimPointWorld: this.aimPointWorld,
      pureAimPointWorld: this.pureAimPointWorld,
      barrelAimDir: this.barrelAimDir,
      screenPos: this.screenPos
    };
  }

  /**
   * Retorna a direção balística inicial que o projétil deve tomar para garantir que
   * O TIRO SEMPRE VÁ NA DIREÇÃO DA CROSSHAIR / PONTO DE MIRA DO CANO.
   * 
   * @param {THREE.Vector3} muzzleOrigin Ponto de saída do projétil
   * @param {THREE.Vector3} outDir Vetor de saída preenchido e normalizado
   * @returns {THREE.Vector3}
   */
  getFiringDirection(muzzleOrigin, outDir = new THREE.Vector3()) {
    outDir.copy(this.aimPointWorld).sub(muzzleOrigin).normalize();
    return outDir;
  }
}
