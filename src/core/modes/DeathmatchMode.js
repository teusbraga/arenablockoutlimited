import { GameMode } from './GameMode.js';

/**
 * DeathmatchMode (Mata-Mata FFA)
 * Implementação do modo Todos contra Todos:
 * - Toda entidade é inimiga de qualquer outra diferente de si mesma.
 * - Fogo livre contra qualquer oponente (sem fogo amigo de time).
 * - Algoritmo de spawn por máxima dispersão (mantém distância máxima dos combatentes vivos).
 * - Ranking individual de abates e mortes.
 */
export class DeathmatchMode extends GameMode {
  constructor(options = {}) {
    super(options);
    this.id = 'deathmatch';
    this.name = 'Mata-Mata (FFA)';
    this.bounds = options.bounds || [-24, 24, -24, 24];
    this.spawns = options.spawns || [];
  }

  isEnemy(entityA, entityB) {
    if (!entityA || !entityB) return false;
    if (entityA === entityB) return false;
    return (entityA.alive !== false) && (entityB.alive !== false);
  }

  canDamage(attacker, victim) {
    if (!attacker || !victim) return true;
    return attacker !== victim;
  }

  /**
   * Seleciona o ponto de spawn mais seguro e disperso para a entidade.
   * Prioriza pontos com a maior distância mínima até qualquer combatente vivo.
   * @param {Object} entity
   * @param {Object} context
   * @returns {{x: number, y: number, z: number}}
   */
  getSpawnPoint(entity, context = {}) {
    const spawnsPool = context.spawns || this.spawns || [];
    const combatants = context.combatants || [];
    const isPositionClear = context.isPositionClear;

    // Coleta todos os combatentes ativos para calcular a distância
    const activeEnemies = combatants.filter(c => c && c !== entity && c.alive && c.pos);

    // 1. Testa os presets de spawn configurados do mapa
    if (spawnsPool.length > 0) {
      const candidates = [];

      for (let i = 0; i < spawnsPool.length; i++) {
        const s = spawnsPool[i];
        const sx = s[0] ?? s.x;
        const sy = s[1] ?? s.y ?? 0.6;
        const sz = s[2] ?? s.z;

        if (isPositionClear && !isPositionClear(sx, sy, sz, 2.5, 8.0, entity)) {
          continue;
        }

        // Calcula a menor distância até qualquer inimigo vivo
        let minDist = Infinity;
        for (const enemy of activeEnemies) {
          const d = Math.hypot(sx - enemy.pos.x, sz - enemy.pos.z);
          if (d < minDist) minDist = d;
        }

        candidates.push({ x: sx, y: sy, z: sz, minDist });
      }

      if (candidates.length > 0) {
        // Ordena por maior distância até o inimigo mais próximo
        candidates.sort((a, b) => b.minDist - a.minDist);
        // Filtra candidatos dentro de 15% do melhor índice para garantir segurança máxima
        const bestMinDist = candidates[0].minDist;
        const safeCandidates = candidates.filter(c => c.minDist >= bestMinDist * 0.85);
        const pick = safeCandidates[Math.floor(Math.random() * safeCandidates.length)];
        return { x: pick.x, y: pick.y, z: pick.z };
      }
    }

    // 2. Busca aleatória por espaço aberto dentro dos bounds
    const [minX, maxX, minZ, maxZ] = context.bounds || this.bounds;
    const padX = Math.min(3.5, Math.max(0.5, (maxX - minX) * 0.15));
    const padZ = Math.min(3.5, Math.max(0.5, (maxZ - minZ) * 0.15));
    const spanX = Math.max(0.5, (maxX - minX) - padX * 2);
    const spanZ = Math.max(0.5, (maxZ - minZ) - padZ * 2);
    const randomCandidates = [];

    for (let i = 0; i < 35; i++) {
      const rx = minX + padX + Math.random() * spanX;
      const rz = minZ + padZ + Math.random() * spanZ;
      const ry = 0.6;

      if (isPositionClear && !isPositionClear(rx, ry, rz, 2.5, 8.0, entity)) {
        continue;
      }

      let minDist = Infinity;
      for (const enemy of activeEnemies) {
        const d = Math.hypot(rx - enemy.pos.x, rz - enemy.pos.z);
        if (d < minDist) minDist = d;
      }

      randomCandidates.push({ x: rx, y: ry, z: rz, minDist });
    }

    if (randomCandidates.length > 0) {
      randomCandidates.sort((a, b) => b.minDist - a.minDist);
      const pick = randomCandidates[0];
      return { x: pick.x, y: pick.y, z: pick.z };
    }

    // 3. Fallback
    if (spawnsPool.length > 0) {
      const s0 = spawnsPool[0];
      return { x: s0[0] ?? s0.x, y: s0[1] ?? s0.y ?? 0.6, z: s0[2] ?? s0.z };
    }

    return { x: 0, y: 0.6, z: 0 };
  }
}
