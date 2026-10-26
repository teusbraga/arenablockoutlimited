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
   * Calcula o ponto focal de convergência (Zeroing) na linha de visada central da câmera.
   * @param {THREE.Vector3} camPos Posição da câmera no mundo
   * @param {THREE.Vector3} camForward Direção frontal da câmera (linha de visada)
   * @param {number} [zeroDistance=50.0] Distância de convergência (padrão: 50m)
   * @param {Object} [world=null] Instância de CollisionWorld para raycast contra obstáculos próximos
   * @param {THREE.Vector3} [targetOut] Vetor de saída reutilizável
   * @returns {THREE.Vector3} Ponto focal no espaço de mundo
   */
  static getConvergenceTarget(camPos, camForward, zeroDistance = MASTER_DEFAULTS.zeroDistance, world = null, targetOut = new THREE.Vector3()) {
    targetOut.copy(camPos).addScaledVector(camForward, zeroDistance);
    if (world && typeof world.raycast === 'function') {
      const hit = world.raycast(camPos, camForward, zeroDistance);
      if (hit && (hit.distance || hit.dist) > 0.4) {
        targetOut.copy(hit.point);
      }
    }
    return targetOut;
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
