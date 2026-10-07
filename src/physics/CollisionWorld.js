/**
 * Mundo de colisão com AABBs puras e Particionamento Espacial (Spatial Hash Grid).
 * O(1) tempo de busca médio para raycast e overlaps.
 * Agnóstico a Three.js / GDScript Ready.
 * Convenção: entidade.pos = PÉS (bottom-center).
 *            entidade.size = extents totais {x, y, z}.
 */
export class CollisionWorld {
  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
    this.boxes = [];
    this.grid = new Map(); // key: "x,z" -> Set<box>
  }

  _hash(cx, cz) {
    return `${cx},${cz}`;
  }

  _getBoxCoords(box) {
    const minCx = Math.floor(box.min.x / this.cellSize);
    const maxCx = Math.floor(box.max.x / this.cellSize);
    const minCz = Math.floor(box.min.z / this.cellSize);
    const maxCz = Math.floor(box.max.z / this.cellSize);
    return { minCx, maxCx, minCz, maxCz };
  }

  _insertIntoGrid(box) {
    const { minCx, maxCx, minCz, maxCz } = this._getBoxCoords(box);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this._hash(cx, cz);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = new Set();
          this.grid.set(key, cell);
        }
        cell.add(box);
      }
    }
  }

  _removeFromGrid(box) {
    const { minCx, maxCx, minCz, maxCz } = this._getBoxCoords(box);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this._hash(cx, cz);
        const cell = this.grid.get(key);
        if (cell) {
          cell.delete(box);
          if (cell.size === 0) {
            this.grid.delete(key);
          }
        }
      }
    }
  }

  addBox(cx, cy, cz, sx, sy, sz, meta = {}) {
    const box = {
      min: { x: cx - sx/2, y: cy - sy/2, z: cz - sz/2 },
      max: { x: cx + sx/2, y: cy + sy/2, z: cz + sz/2 },
      solid: meta.solid !== false,
      vaultable: !!meta.vaultable,
      meta,
    };
    this.boxes.push(box);
    this._insertIntoGrid(box);
    return box;
  }

  removeBox(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) {
      this.boxes.splice(i, 1);
      this._removeFromGrid(box);
    }
  }

  /**
   * Obtém caixas candidatas que interceptam a região (AABB da query).
   */
  getNearbyBoxes(minX, maxX, minZ, maxZ) {
    const minCx = Math.floor(minX / this.cellSize);
    const maxCx = Math.floor(maxX / this.cellSize);
    const minCz = Math.floor(minZ / this.cellSize);
    const maxCz = Math.floor(maxZ / this.cellSize);

    // Se tocar apenas em uma célula, evita criar Set
    if (minCx === maxCx && minCz === maxCz) {
      const cell = this.grid.get(this._hash(minCx, minCz));
      return cell ? Array.from(cell) : [];
    }

    const candidates = new Set();
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const cell = this.grid.get(this._hash(cx, cz));
        if (cell) {
          for (const box of cell) {
            candidates.add(box);
          }
        }
      }
    }
    return Array.from(candidates);
  }

  overlaps(pos, size, b) {
    const minX = pos.x - size.x/2, maxX = pos.x + size.x/2;
    const minY = pos.y,            maxY = pos.y + size.y;
    const minZ = pos.z - size.z/2, maxZ = pos.z + size.z/2;
    return !(maxX <= b.min.x || minX >= b.max.x ||
             maxY <= b.min.y || minY >= b.max.y ||
             maxZ <= b.min.z || minZ >= b.max.z);
  }

  _anyOverlap(pos, size) {
    const minX = pos.x - size.x/2, maxX = pos.x + size.x/2;
    const minZ = pos.z - size.z/2, maxZ = pos.z + size.z/2;
    const nearby = this.getNearbyBoxes(minX, maxX, minZ, maxZ);

    for (let i = 0; i < nearby.length; i++) {
      const b = nearby[i];
      if (!b.solid) continue;
      if (this.overlaps(pos, size, b)) return true;
    }
    return false;
  }

  /**
   * Move a entidade resolvendo colisão por eixo (Y, X, Z) com step-up.
   * Retorna flags de contato.
   */
  moveAndSlide(pos, size, delta, opts = {}) {
    const stepHeight = opts.stepHeight ?? 0.55;
    const res = { onGround: false, hitCeiling: false, hitWall: false, hitX: false, hitZ: false };

    // Delimita a AABB da trajetória para recuperar caixas locais via Spatial Grid
    const minX = Math.min(pos.x, pos.x + delta.x) - size.x/2 - 0.2;
    const maxX = Math.max(pos.x, pos.x + delta.x) + size.x/2 + 0.2;
    const minZ = Math.min(pos.z, pos.z + delta.z) - size.z/2 - 0.2;
    const maxZ = Math.max(pos.z, pos.z + delta.z) + size.z/2 + 0.2;
    const relevantBoxes = this.getNearbyBoxes(minX, maxX, minZ, maxZ);

    // ---------- Y ----------
    pos.y += delta.y;
    for (let i = 0; i < relevantBoxes.length; i++) {
      const b = relevantBoxes[i];
      if (!b.solid) continue;
      if (!this.overlaps(pos, size, b)) continue;
      if (delta.y <= 0) { pos.y = b.max.y; res.onGround = true; }
      else              { pos.y = b.min.y - size.y; res.hitCeiling = true; }
    }

    // ---------- X ----------
    if (delta.x !== 0) {
      const oldX = pos.x;
      pos.x += delta.x;
      if (this._anyOverlap(pos, size)) {
        pos.x = oldX;
        if (res.onGround && stepHeight > 0 && this._tryStepUp(pos, size, delta.x, 0, stepHeight)) {
          res.onGround = true;
        } else {
          res.hitWall = true; res.hitX = true;
        }
      }
    }

    // ---------- Z ----------
    if (delta.z !== 0) {
      const oldZ = pos.z;
      pos.z += delta.z;
      if (this._anyOverlap(pos, size)) {
        pos.z = oldZ;
        if (res.onGround && stepHeight > 0 && this._tryStepUp(pos, size, 0, delta.z, stepHeight)) {
          res.onGround = true;
        } else {
          res.hitWall = true; res.hitZ = true;
        }
      }
    }

    return res;
  }

  _tryStepUp(pos, size, dx, dz, stepHeight) {
    const oldX = pos.x, oldY = pos.y, oldZ = pos.z;
    pos.y += stepHeight + 0.01;
    pos.x += dx; pos.z += dz;

    if (this._anyOverlap(pos, size)) {
      pos.x = oldX; pos.y = oldY; pos.z = oldZ;
      return false;
    }

    // desce até achar chão
    let drop = stepHeight + 0.05;
    const minX = pos.x - size.x/2, maxX = pos.x + size.x/2;
    const minZ = pos.z - size.z/2, maxZ = pos.z + size.z/2;
    const nearby = this.getNearbyBoxes(minX, maxX, minZ, maxZ);

    while (drop > 0) {
      pos.y -= 0.02; drop -= 0.02;
      let landed = false;
      for (let i = 0; i < nearby.length; i++) {
        const b = nearby[i];
        if (!b.solid) continue;
        if (this.overlaps(pos, size, b)) {
          pos.y = b.max.y; landed = true; break;
        }
      }
      if (landed) return true;
    }
    pos.x = oldX; pos.y = oldY; pos.z = oldZ;
    return false;
  }

  /** 
   * Ray-AABB (slab method) com Spatial Hash Grid Traversal.
   * Retorna { box, distance, point } ou null.
   */
  raycast(origin, dir, maxDist = Infinity) {
    const inv = { x: 1/(dir.x || 1e-9), y: 1/(dir.y || 1e-9), z: 1/(dir.z || 1e-9) };
    const effectiveDist = Math.min(maxDist, 400);

    // Bounding Box do Raio
    const endX = origin.x + dir.x * effectiveDist;
    const endZ = origin.z + dir.z * effectiveDist;
    const minX = Math.min(origin.x, endX) - 0.5;
    const maxX = Math.max(origin.x, endX) + 0.5;
    const minZ = Math.min(origin.z, endZ) - 0.5;
    const maxZ = Math.max(origin.z, endZ) + 0.5;

    const candidates = this.getNearbyBoxes(minX, maxX, minZ, maxZ);

    let bestT = maxDist, bestBox = null;

    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (!b.solid) continue;

      let tmin = (b.min.x - origin.x) * inv.x;
      let tmax = (b.max.x - origin.x) * inv.x;
      if (tmin > tmax) { const tmp = tmin; tmin = tmax; tmax = tmp; }

      let tymin = (b.min.y - origin.y) * inv.y;
      let tymax = (b.max.y - origin.y) * inv.y;
      if (tymin > tymax) { const tmp = tymin; tymin = tymax; tymax = tmp; }
      if (tmin > tymax || tymin > tmax) continue;
      if (tymin > tmin) tmin = tymin;
      if (tymax < tmax) tmax = tymax;

      let tzmin = (b.min.z - origin.z) * inv.z;
      let tzmax = (b.max.z - origin.z) * inv.z;
      if (tzmin > tzmax) { const tmp = tzmin; tzmin = tzmax; tzmax = tmp; }
      if (tmin > tzmax || tzmin > tmax) continue;
      if (tzmin > tmin) tmin = tzmin;
      if (tzmax < tmax) tmax = tzmax;

      if (tmax < 0) continue;
      if (tmin > 0 && tmin < bestT) {
        bestT = tmin;
        bestBox = b;
      }
    }

    if (!bestBox) return null;
    return {
      box: bestBox,
      distance: bestT,
      point: {
        x: origin.x + dir.x * bestT,
        y: origin.y + dir.y * bestT,
        z: origin.z + dir.z * bestT,
      },
    };
  }
}