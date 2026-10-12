import { on } from '../core/EventBus.js';

/**
 * GPS Tático dos Bots — Grid de Navegação Esparsa + Pathfinding A* (8 direções sem cortar quinas)
 * + Suavização de Rota (String Pulling).
 *
 * Projetado para custo zero no boot (lazy evaluation com cache O(1) sobre o Spatial Hash
 * do CollisionWorld), suportando desde arenas 60x60m até mapas abertos de 2000x2000m.
 */
export class NavGrid {
  /**
   * @param {import('../physics/CollisionWorld.js').CollisionWorld} world
   * @param {object} [opts]
   */
  constructor(world, opts = {}) {
    this.world = world;
    this.cellSize = opts.cellSize ?? 1.0;
    this.botRadius = opts.botRadius ?? 0.42; // Folga horizontal para AABB 0.8m do bot
    this.stepHeight = opts.stepHeight ?? 0.52;
    this.botHeight = opts.botHeight ?? 1.65;

    /** @type {Map<number, boolean>} Cache de caminhabilidade por célula (chave inteira 32-bit) */
    this._cellCache = new Map();
    this._lastBoxCount = world?.boxes ? world.boxes.length : 0;

    // Se uma porta abrir/fechar no mapa, limpa o cache de células para atualizar passagens
    this._unsubDoor = on('door:toggle', () => {
      this._cellCache.clear();
    });
  }

  destroy() {
    if (this._unsubDoor) {
      this._unsubDoor();
      this._unsubDoor = null;
    }
    this._cellCache.clear();
  }

  /**
   * Empacota coordenadas de grid (gx, gz) em um inteiro de 30 bits para lookup O(1) sem alocar strings.
   * Suporta gx, gz no intervalo [-16384, +16383].
   */
  _packKey(gx, gz) {
    return ((gx + 16384) << 15) | ((gz + 16384) & 0x7fff);
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.floor(wx / this.cellSize),
      gz: Math.floor(wz / this.cellSize),
    };
  }

  gridToWorld(gx, gz) {
    return {
      x: (gx + 0.5) * this.cellSize,
      z: (gz + 0.5) * this.cellSize,
    };
  }

  /**
   * Verifica se a célula (gx, gz) é livre de obstáculos sólidos na faixa de altura do corpo do bot.
   */
  isCellWalkable(gx, gz) {
    if (!this.world) return true;

    // Se novas caixas foram adicionadas ao mundo após a criação, invalida o cache
    if (this.world.boxes && this.world.boxes.length !== this._lastBoxCount) {
      this._lastBoxCount = this.world.boxes.length;
      this._cellCache.clear();
    }

    const key = this._packKey(gx, gz);
    const cached = this._cellCache.get(key);
    if (cached !== undefined) return cached;

    const wx = (gx + 0.5) * this.cellSize;
    const wz = (gz + 0.5) * this.cellSize;
    const r = this.botRadius;

    const minX = wx - r;
    const maxX = wx + r;
    const minZ = wz - r;
    const maxZ = wz + r;

    const candidates = this.world.getNearbyBoxes
      ? this.world.getNearbyBoxes(minX, maxX, minZ, maxZ)
      : (this.world.boxes || []);

    let walkable = true;
    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (!b.solid) continue;
      // Ignora pisos/degraus baixos (que o moveAndSlide sobe via stepHeight) e tetos altos
      if (b.max.y <= this.stepHeight || b.min.y >= this.botHeight) continue;

      if (!(maxX <= b.min.x || minX >= b.max.x || maxZ <= b.min.z || minZ >= b.max.z)) {
        walkable = false;
        break;
      }
    }

    // Limita tamanho máximo do cache em mapas gigantes
    if (this._cellCache.size > 24000) {
      this._cellCache.clear();
    }
    this._cellCache.set(key, walkable);
    return walkable;
  }

  isWorldWalkable(wx, wz) {
    const gx = Math.floor(wx / this.cellSize);
    const gz = Math.floor(wz / this.cellSize);
    return this.isCellWalkable(gx, gz);
  }

  /**
   * Se a célula inicial ou final cair dentro da margem de uma parede/caixa,
   * busca em espiral a célula caminhável mais próxima (até maxRadius).
   */
  _findNearestWalkable(gx, gz, maxRadius = 4) {
    if (this.isCellWalkable(gx, gz)) return { gx, gz };

    for (let r = 1; r <= maxRadius; r++) {
      let best = null;
      let bestDistSq = Infinity;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = gx + dx;
          const nz = gz + dz;
          if (this.isCellWalkable(nx, nz)) {
            const d2 = dx * dx + dz * dz;
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              best = { gx: nx, gz: nz };
            }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * Verifica se há linha reta livre na grid entre dois pontos em coordenadas de mundo (Bresenham/supercover).
   * Usado para String Pulling (suavização de waypoints).
   */
  hasDirectWalkableLine(x0, z0, x1, z1) {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    if (dist < 0.25) return true;

    const step = this.cellSize * 0.45;
    const steps = Math.ceil(dist / step);
    const invSteps = 1 / steps;

    for (let i = 1; i < steps; i++) {
      const t = i * invSteps;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (!this.isWorldWalkable(x, z)) return false;
    }
    return true;
  }

  /**
   * Calcula rota A* entre startPos e goalPos no plano X/Z.
   * Retorna array de waypoints `[{ x, z }, ...]`.
   *
   * @param {{x: number, z: number}} startPos
   * @param {{x: number, z: number}} goalPos
   * @param {number} [maxIterations=450]
   * @returns {Array<{x: number, z: number}>}
   */
  findPath(startPos, goalPos, maxIterations = 450) {
    const sGrid = this.worldToGrid(startPos.x, startPos.z);
    const gGrid = this.worldToGrid(goalPos.x, goalPos.z);

    const startNode = this._findNearestWalkable(sGrid.gx, sGrid.gz, 4);
    const goalNode = this._findNearestWalkable(gGrid.gx, gGrid.gz, 4);

    if (!startNode || !goalNode) {
      return [{ x: goalPos.x, z: goalPos.z }];
    }

    if (startNode.gx === goalNode.gx && startNode.gz === goalNode.gz) {
      return [{ x: goalPos.x, z: goalPos.z }];
    }

    // Atalho O(1): se o caminho reto já está 100% desobstruído, não precisa expandir A*
    const goalWorld = this.gridToWorld(goalNode.gx, goalNode.gz);
    if (this.hasDirectWalkableLine(startPos.x, startPos.z, goalWorld.x, goalWorld.z)) {
      return [{ x: goalWorld.x, z: goalWorld.z }];
    }

    // Min-Heap binária leve para a Open Set do A*
    const openHeap = [];
    const gScore = new Map();
    const closedSet = new Set();

    const hOctile = (gx, gz) => {
      const dx = Math.abs(gx - goalNode.gx);
      const dz = Math.abs(gz - goalNode.gz);
      return (dx + dz) + (1.41421356 - 2) * Math.min(dx, dz);
    };

    const startKey = this._packKey(startNode.gx, startNode.gz);
    const root = {
      gx: startNode.gx,
      gz: startNode.gz,
      key: startKey,
      g: 0,
      f: hOctile(startNode.gx, startNode.gz),
      h: hOctile(startNode.gx, startNode.gz),
      parent: null,
    };

    this._heapPush(openHeap, root);
    gScore.set(startKey, 0);

    let bestFallbackNode = root;
    let iterations = 0;

    // 8 direções: 4 cardeais + 4 diagonais
    const dirs = [
      { dx: 0, dz: 1, cost: 1.0 },
      { dx: 1, dz: 0, cost: 1.0 },
      { dx: 0, dz: -1, cost: 1.0 },
      { dx: -1, dz: 0, cost: 1.0 },
      { dx: 1, dz: 1, cost: 1.41421356 },
      { dx: 1, dz: -1, cost: 1.41421356 },
      { dx: -1, dz: 1, cost: 1.41421356 },
      { dx: -1, dz: -1, cost: 1.41421356 },
    ];

    let foundNode = null;

    while (openHeap.length > 0 && iterations < maxIterations) {
      iterations++;
      const current = this._heapPop(openHeap);

      if (current.gx === goalNode.gx && current.gz === goalNode.gz) {
        foundNode = current;
        break;
      }

      if (closedSet.has(current.key)) continue;
      closedSet.add(current.key);

      if (current.h < bestFallbackNode.h) {
        bestFallbackNode = current;
      }

      for (let i = 0; i < 8; i++) {
        const d = dirs[i];
        const nx = current.gx + d.dx;
        const nz = current.gz + d.dz;
        const nKey = this._packKey(nx, nz);

        if (closedSet.has(nKey)) continue;
        if (!this.isCellWalkable(nx, nz)) continue;

        // Prevenção de Corner-Cutting: movimento diagonal exige que AMBOS os vizinhos cardeais estejam livres
        if (d.dx !== 0 && d.dz !== 0) {
          if (!this.isCellWalkable(current.gx + d.dx, current.gz) ||
              !this.isCellWalkable(current.gx, current.gz + d.dz)) {
            continue;
          }
        }

        const tentativeG = current.g + d.cost;
        const prevG = gScore.get(nKey);
        if (prevG !== undefined && tentativeG >= prevG) continue;

        const h = hOctile(nx, nz);
        gScore.set(nKey, tentativeG);
        this._heapPush(openHeap, {
          gx: nx,
          gz: nz,
          key: nKey,
          g: tentativeG,
          h,
          f: tentativeG + h,
          parent: current,
        });
      }
    }

    const targetNode = foundNode || bestFallbackNode;
    const rawWaypoints = [];
    let curr = targetNode;
    while (curr && curr.parent !== null) {
      rawWaypoints.push(this.gridToWorld(curr.gx, curr.gz));
      curr = curr.parent;
    }
    rawWaypoints.reverse();

    if (rawWaypoints.length === 0) {
      return [goalWorld];
    }

    return this._smoothPath(startPos, rawWaypoints);
  }

  /**
   * String-Pulling: remove waypoints intermediários redundantes quando há linha de caminhada livre.
   */
  _smoothPath(startPos, waypoints) {
    if (waypoints.length <= 2) return waypoints;

    const smoothed = [];
    let anchor = { x: startPos.x, z: startPos.z };
    let i = 0;

    while (i < waypoints.length) {
      let furthest = i;
      // Testa até 8 waypoints à frente para suavizar zig-zags sem custo alto
      const maxLookahead = Math.min(waypoints.length - 1, i + 8);
      for (let j = maxLookahead; j > i; j--) {
        if (this.hasDirectWalkableLine(anchor.x, anchor.z, waypoints[j].x, waypoints[j].z)) {
          furthest = j;
          break;
        }
      }
      smoothed.push(waypoints[furthest]);
      anchor = waypoints[furthest];
      i = furthest + 1;
    }

    return smoothed;
  }

  /**
   * Sorteia um ponto caminhável válido ao redor do bot para patrulha/dispersão,
   * evitando escolher pontos dentro de paredes ou caixas.
   */
  findRandomWalkablePoint(originPos, bounds = null, minDist = 6.0, maxDist = 20.0) {
    const minX = bounds ? bounds[0] + 2.5 : originPos.x - maxDist;
    const maxX = bounds ? bounds[1] - 2.5 : originPos.x + maxDist;
    const minZ = bounds ? bounds[2] + 2.5 : originPos.z - maxDist;
    const maxZ = bounds ? bounds[3] - 2.5 : originPos.z + maxDist;

    for (let attempt = 0; attempt < 18; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * (maxDist - minDist);
      const tx = Math.max(minX, Math.min(maxX, originPos.x + Math.cos(angle) * dist));
      const tz = Math.max(minZ, Math.min(maxZ, originPos.z + Math.sin(angle) * dist));

      if (this.isWorldWalkable(tx, tz)) {
        return { x: tx, z: tz };
      }
    }

    // Fallback: espiral perto da origem
    const g = this.worldToGrid(originPos.x, originPos.z);
    const near = this._findNearestWalkable(g.gx, g.gz, 5);
    return near ? this.gridToWorld(near.gx, near.gz) : { x: originPos.x, z: originPos.z };
  }

  _heapPush(heap, node) {
    heap.push(node);
    let idx = heap.length - 1;
    while (idx > 0) {
      const parentIdx = (idx - 1) >> 1;
      if (heap[parentIdx].f <= heap[idx].f) break;
      const tmp = heap[parentIdx];
      heap[parentIdx] = heap[idx];
      heap[idx] = tmp;
      idx = parentIdx;
    }
  }

  _heapPop(heap) {
    const top = heap[0];
    const bottom = heap.pop();
    if (heap.length > 0) {
      heap[0] = bottom;
      let idx = 0;
      const len = heap.length;
      while (true) {
        const left = (idx << 1) + 1;
        const right = left + 1;
        let smallest = idx;
        if (left < len && heap[left].f < heap[smallest].f) smallest = left;
        if (right < len && heap[right].f < heap[smallest].f) smallest = right;
        if (smallest === idx) break;
        const tmp = heap[idx];
        heap[idx] = heap[smallest];
        heap[smallest] = tmp;
        idx = smallest;
      }
    }
    return top;
  }
}
