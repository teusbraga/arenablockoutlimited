/**
 * MasterWeapon.js
 * 
 * Contrato canônico e motor geométrico de balística pura:
 * - 100% de precisão intrínseca (zero dispersão cônica na saída do cano).
 * - Queda gravitacional pura e vertical (eixo -Y).
 * - Convergência focal tridimensional (Zeroing) unificada para Hipfire e ADS.
 * - Modo Calibração (Zeroing Mode) para auditoria e teste de armas sem debuffs.
 */

import * as THREE from 'three';
import { CONFIG } from '../core/ConfigLoader.js';

export const MASTER_DEFAULTS = {
  zeroDistance: 50.0,   // Distância focal padrão de convergência (metros)
  intrinsicSpread: 0.0, // Precisão pura de 100%
  baseGravity: 9.8      // Aceleração gravitacional vertical (m/s²)
};

export class MasterWeapon {
  /**
   * Verifica se o modo calibração / zeroing está ativo.
   * Ativo quando configurado explicitamente ou no mapa Range.
   * @param {string} [mapName=''] Nome do mapa atual
   * @returns {boolean}
   */
  static isZeroingMode(mapName = '') {
    if (CONFIG?.ZEROING?.zeroingMode || CONFIG?.ZEROING_MODE || CONFIG?.GAMEPLAY?.zeroingMode) return true;
    if (typeof mapName === 'string') {
      const lower = mapName.toLowerCase();
      if (lower === 'range' || lower.includes('range') || lower.includes('campo de tiro')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calcula a elevação mecânica analítica necessária no cano (radianos de pitch-up)
   * para compensar o Height-Over-Bore (HOB) e a gravidade na distância zero nominal (50m).
   * Elimina qualquer necessidade de raycasts dinâmicos no frame do tiro.
   *
   * Fórmula analítica: theta_zero = (hob / Z) + (g * Z) / (2 * v^2)
   *
   * @param {Object} weaponDef Definição da arma com muzzleLocal, sightLocal e ballistics
   * @param {number} [zeroDistance=50.0] Distância nominal de zeroing em metros
   * @returns {number} Ângulo de elevação do cano em radianos
   */
  static calculateZeroingElevation(weaponDef, zeroDistance = MASTER_DEFAULTS.zeroDistance) {
    if (!weaponDef) return 0.0;
    const muzzleLocal = weaponDef.muzzleLocal || [0, 0.02, -0.5];
    const sightLocal = weaponDef.sightLocal || [0, 0.08, -0.2];

    // Height-Over-Bore geométrico local (distância vertical entre o cano e a mira ótica)
    const hob = sightLocal[1] - muzzleLocal[1];

    const bulletSpeed = weaponDef.ballistics?.terminal?.bulletSpeed || 800.0;
    const bulletDrop = weaponDef.ballistics?.terminal?.bulletDrop || MASTER_DEFAULTS.baseGravity;

    const vSq = Math.max(10.0, bulletSpeed * bulletSpeed);
    const elevation = (hob / zeroDistance) + (bulletDrop * zeroDistance) / (2.0 * vSq);
    return elevation;
  }

  /**
   * Calcula o ponto focal fixo de convergência (Zeroing) na linha de visada central da câmera.
   * O ponto focal é estático e posicionado estritamente na distância zero especificada (50m),
   * sem sofrer snap ou dobras por raycast contra obstáculos próximos (elimina o 'tiro chicote').
   *
   * @param {THREE.Vector3} camPos Posição da câmera no mundo
   * @param {THREE.Vector3} camForward Direção frontal da câmera (linha de visada)
   * @param {number} [zeroDistance=50.0] Distância nominal de convergência
   * @param {Object|THREE.Vector3} [worldOrTarget=null] Instância legada de world ou vetor de saída
   * @param {THREE.Vector3} [maybeTarget=null] Vetor de saída reutilizável
   * @returns {THREE.Vector3} Ponto focal no espaço de mundo
   */
  static getConvergenceTarget(camPos, camForward, zeroDistance = MASTER_DEFAULTS.zeroDistance, worldOrTarget = null, maybeTarget = null) {
    let out;
    if (worldOrTarget instanceof THREE.Vector3) {
      out = worldOrTarget;
    } else if (maybeTarget instanceof THREE.Vector3) {
      out = maybeTarget;
    } else {
      out = new THREE.Vector3();
    }
    return out.copy(camPos).addScaledVector(camForward, zeroDistance);
  }

  /**
   * Calcula o vetor diretor unificado de saída do bocal em direção ao ponto de convergência.
   * @param {THREE.Vector3} muzzleWorld Posição 3D da boca do cano
   * @param {THREE.Vector3} convergenceTarget Ponto focal de convergência
   * @param {THREE.Vector3} [dirOut] Vetor de saída reutilizável
   * @returns {THREE.Vector3} Vetor diretor normalizado
   */
  static computeShotDirection(muzzleWorld, convergenceTarget, dirOut = new THREE.Vector3()) {
    return dirOut.copy(convergenceTarget).sub(muzzleWorld).normalize();
  }
}
