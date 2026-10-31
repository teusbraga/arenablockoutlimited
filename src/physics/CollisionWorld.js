/**
 * Mundo de colisão com AABBs puras, Rampas lineares e Domos Elipsoidais.
 * Particionamento Espacial (Spatial Hash Grid) O(1).
 * Suporte a superfícies inclinadas transitáveis (<= 45°) e escorregamento físico (> 45°).
 * Agnóstico a Three.js / GDScript Ready / Headless Server Ready.
 * Convenção: entidade.pos = PÉS (bottom-center).
 *            entidade.size = extents totais {x, y, z}.
 */
const _headroomTestSize = { x: 0.6, y: 1.8, z: 0.6 };

export class CollisionWorld {
  constructor(cellSize = 4.0) {
    this.cellSize = cellSize;
    this.boxes = [];
    this.grid = new Map();
    this.globalBoxes = []; // key: "x,z" -> Set<box>
    this.slopes = [];
    this.domes = [];
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
    const cellCount = (maxCx - minCx + 1) * (maxCz - minCz + 1);
    if (cellCount > 64) {
      this.globalBoxes.push(box);
      return;
    }
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
    const gIdx = this.globalBoxes.indexOf(box);
    if (gIdx >= 0) {
      this.globalBoxes.splice(gIdx, 1);
      return;
    }
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
      type: 'box',
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

  /**
   * Registra uma rampa linear retilínea com plano inclinado contínuo.
   * @param {number} cx Centro X da bounding box
   * @param {number} cy Centro Y da bounding box
   * @param {number} cz Centro Z da bounding box
   * @param {number} sx Largura X total
   * @param {number} sy Altura Y total da rampa
   * @param {number} sz Profundidade Z total
   * @param {string} direction Direção de subida: '+z', '-z', '+x', '-x'
   * @param {object} meta Metadados (material, vaultable, etc.)
   */
  addRamp(cx, cy, cz, sx, sy, sz, direction = '+z', meta = {}) {
    const min = { x: cx - sx/2, y: cy - sy/2, z: cz - sz/2 };
    const max = { x: cx + sx/2, y: cy + sy/2, z: cz + sz/2 };
    const dir = direction.toLowerCase();
    let normal = { x: 0, y: 1, z: 0 };

    if (dir === '+z') {
      const L = Math.hypot(sy, sz);
      normal = { x: 0, y: sz / L, z: -sy / L };
    } else if (dir === '-z') {
      const L = Math.hypot(sy, sz);
      normal = { x: 0, y: sz / L, z: sy / L };
    } else if (dir === '+x') {
      const L = Math.hypot(sy, sx);
      normal = { x: -sy / L, y: sx / L, z: 0 };
    } else if (dir === '-x') {
      const L = Math.hypot(sy, sx);
      normal = { x: sy / L, y: sx / L, z: 0 };
    }

    const ramp = {
      type: 'ramp',
      isRamp: true,
      direction: dir,
      min, max,
      size: { x: sx, y: sy, z: sz },
      center: { x: cx, y: cy, z: cz },
      normal,
      solid: meta.solid !== false,
      vaultable: !!meta.vaultable,
      meta,
      getSurfaceAt(x, z) {
        if (x < min.x - 0.05 || x > max.x + 0.05 || z < min.z - 0.05 || z > max.z + 0.05) return null;
        let t = 0;
        if (dir === '+z')      t = (z - min.z) / sz;
        else if (dir === '-z') t = (max.z - z) / sz;
        else if (dir === '+x') t = (x - min.x) / sx;
        else if (dir === '-x') t = (max.x - x) / sx;
        t = Math.max(0, Math.min(1, t));
        const y = min.y + t * sy;
        return { y, normal };
      }
    };

    this.boxes.push(ramp);
    this._insertIntoGrid(ramp);
    this.slopes.push(ramp);
    return ramp;
  }

  /**
   * Registra um domo elipsoidal (pedra arredondada / monte de terra).
   * O ápice fica em cy + ry; nas bordas elípticas a altura desce até cy.
   * @param {number} cx Centro horizontal X
   * @param {number} cy Altura base Y (chão)
   * @param {number} cz Centro horizontal Z
   * @param {number} rx Raio semi-eixo X
   * @param {number} ry Altura máxima do ápice em relação à base
   * @param {number} rz Raio semi-eixo Z
   * @param {object} meta Metadados
   */
  addDome(cx, cy, cz, rx, ry, rz, meta = {}) {
    const min = { x: cx - rx, y: cy, z: cz - rz };
    const max = { x: cx + rx, y: cy + ry, z: cz + rz };

    const dome = {
      type: 'dome',
      isDome: true,
      min, max,
      center: { x: cx, y: cy, z: cz },
      radius: { x: rx, y: ry, z: rz },
      solid: meta.solid !== false,
      vaultable: !!meta.vaultable,
      meta,
      getSurfaceAt(x, z) {
        const dx = (x - cx) / rx;
        const dz = (z - cz) / rz;
        const q = dx * dx + dz * dz;
        if (q > 1.0) return null;
        const hFactor = Math.sqrt(Math.max(0, 1.0 - q));
        const y = cy + ry * hFactor;

        const gx = dx / rx;
        const gy = hFactor / ry;
        const gz = dz / rz;
        const len = Math.hypot(gx, gy, gz) || 1e-6;
        const normal = { x: gx / len, y: gy / len, z: gz / len };

        return { y, normal };
      }
    };

    this.boxes.push(dome);
    this._insertIntoGrid(dome);
    this.domes.push(dome);
    return dome;
  }

  removeBox(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) {
      this.boxes.splice(i, 1);
      this._removeFromGrid(box);
    }
    const sIdx = this.slopes.indexOf(box);
    if (sIdx >= 0) this.slopes.splice(sIdx, 1);
    const dIdx = this.domes.indexOf(box);
    if (dIdx >= 0) this.domes.splice(dIdx, 1);
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
    let list = [];
    if (minCx === maxCx && minCz === maxCz) {
      const cell = this.grid.get(this._hash(minCx, minCz));
      if (cell) list = Array.from(cell);
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
    if (minCx !== maxCx || minCz !== maxCz) { list = Array.from(candidates); }
    if (this.globalBoxes && this.globalBoxes.length > 0) {
      for (let i = 0; i < this.globalBoxes.length; i++) {
        const gb = this.globalBoxes[i];
        if (maxX >= gb.min.x && minX <= gb.max.x && maxZ >= gb.min.z && minZ <= gb.max.z) {
          list.push(gb);
        }
      }
    }
    return list;
  }

  /**
   * Consulta a superfície de rampa ou domo mais alta nas coordenadas (x, z).
   * @param {number} x
   * @param {number} z
   * @returns {{ y: number, normal: {x: number, y: number, z: number}, box: object } | null}
   */
  getSlopeSurfaceAt(x, z) {
    let highest = null;
    const candidates = this.getNearbyBoxes(x - 0.5, x + 0.5, z - 0.5, z + 0.5);
    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (!b.solid || (!b.isRamp && !b.isDome)) continue;
      const surf = b.getSurfaceAt(x, z);
      if (surf) {
        if (!highest || surf.y > highest.y) {
          highest = { ...surf, box: b };
        }
      }
    }
    return highest;
  }

  overlaps(pos, size, b) {
    const minX = pos.x - size.x/2, maxX = pos.x + size.x/2;
    const minY = pos.y,            maxY = pos.y + size.y;
    const minZ = pos.z - size.z/2, maxZ = pos.z + size.z/2;
    if (maxX <= b.min.x || minX >= b.max.x ||
        maxY <= b.min.y || minY >= b.max.y ||
        maxZ <= b.min.z || minZ >= b.max.z) {
      return false;
    }
    if (!b.isRamp && !b.isDome) return true;

    // Primitiva de rampa ou domo: verifica penetração na superfície
    const surf = b.getSurfaceAt(pos.x, pos.z);
    if (!surf) return false;
    // Se os pés estiverem na superfície ou acima, não há penetração sólida
    if (minY >= surf.y - 0.005) return false;
    // Se todo o corpo estiver abaixo da base da rampa/domo
    if (maxY <= b.min.y + 0.005) return false;
    // Pés estão abaixo da superfície sólida
    return true;
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
   * Verifica se uma entidade na posição pos tem espaço vertical livre até targetHeight.
   * Usado para headroom check (impede levantar agachado sob tetos baixos).
   * @param {{x: number, y: number, z: number}} pos 
   * @param {{x: number, y: number, z: number}} size 
   * @param {number} targetHeight 
   * @returns {boolean} true se houver espaço livre sem colisão sólida
   */
  hasHeadroom(pos, size, targetHeight) {
    _headroomTestSize.x = size.x;
    _headroomTestSize.y = targetHeight;
    _headroomTestSize.z = size.z;
    return !this._anyOverlap(pos, _headroomTestSize);
  }

  /**
   * Move a entidade resolvendo colisão por eixo (Y, X, Z) com suporte a rampas e step-up.
   * Retorna flags de contato, normal do solo e estado de escorregamento.
   */
  moveAndSlide(pos, size, delta, opts = {}) {
    const stepHeight = opts.stepHeight ?? 0.55;
    const maxWalkSlope = opts.maxWalkSlope ?? 0.7071; // cos(45 deg)
    const res = {
      onGround: false,
      hitCeiling: false,
      hitWall: false,
      hitX: false,
      hitZ: false,
      groundMaterial: null,
      groundNormal: { x: 0, y: 1, z: 0 },
      isSliding: false,
      slopeAngle: 0
    };

    // Delimita a AABB da trajetória para recuperar caixas locais via Spatial Grid
    const minX = Math.min(pos.x, pos.x + delta.x) - size.x/2 - 0.2;
    const maxX = Math.max(pos.x, pos.x + delta.x) + size.x/2 + 0.2;
    const minZ = Math.min(pos.z, pos.z + delta.z) - size.z/2 - 0.2;
    const maxZ = Math.max(pos.z, pos.z + delta.z) + size.z/2 + 0.2;
    const relevantBoxes = this.getNearbyBoxes(minX, maxX, minZ, maxZ);

    // ---------- Y ----------
    pos.y += delta.y;
    let highestGround = -Infinity;
    let groundBox = null;
    let groundNorm = { x: 0, y: 1, z: 0 };

    for (let i = 0; i < relevantBoxes.length; i++) {
      const b = relevantBoxes[i];
      if (!b.solid) continue;
      if (!this.overlaps(pos, size, b)) continue;

      if (delta.y <= 0) {
        if (b.isRamp || b.isDome) {
          const surf = b.getSurfaceAt(pos.x, pos.z);
          if (surf && surf.y > highestGround) {
            highestGround = surf.y;
            groundBox = b;
            groundNorm = surf.normal;
          }
        } else {
          if (b.max.y > highestGround) {
            highestGround = b.max.y;
            groundBox = b;
            groundNorm = { x: 0, y: 1, z: 0 };
          }
        }
      } else {
        pos.y = b.min.y - size.y;
        res.hitCeiling = true;
      }
    }

    if (highestGround > -Infinity) {
      pos.y = highestGround;
      res.groundMaterial = groundBox?.meta?.material || 'floor';
      res.groundNormal = groundNorm;

      if (groundNorm.y >= maxWalkSlope) {
        res.onGround = true;
        res.isSliding = false;
      } else {
        res.onGround = false;
        res.isSliding = true;
        res.slopeAngle = Math.acos(Math.max(-1, Math.min(1, groundNorm.y)));
      }
    }

    // ---------- X ----------
    if (delta.x !== 0) {
      const oldX = pos.x;
      const oldY = pos.y;
      pos.x += delta.x;

      // Ajuste contínuo de altura em rampa transitável
      if (res.onGround || delta.y <= 0) {
        const surf = this.getSlopeSurfaceAt(pos.x, pos.z);
        if (surf && surf.normal.y >= maxWalkSlope && Math.abs(surf.y - pos.y) <= stepHeight + 0.1) {
          pos.y = surf.y;
          res.groundNormal = surf.normal;
          res.onGround = true;
        }
      }

      if (this._anyOverlap(pos, size)) {
        pos.x = oldX;
        pos.y = oldY;
        if (res.onGround && stepHeight > 0 && this._tryStepUp(pos, size, delta.x, 0, stepHeight, res)) {
          res.onGround = true;
        } else {
          res.hitWall = true; res.hitX = true;
        }
      }
    }

    // ---------- Z ----------
    if (delta.z !== 0) {
      const oldZ = pos.z;
      const oldY = pos.y;
      pos.z += delta.z;

      // Ajuste contínuo de altura em rampa transitável
      if (res.onGround || delta.y <= 0) {
        const surf = this.getSlopeSurfaceAt(pos.x, pos.z);
        if (surf && surf.normal.y >= maxWalkSlope && Math.abs(surf.y - pos.y) <= stepHeight + 0.1) {
          pos.y = surf.y;
          res.groundNormal = surf.normal;
          res.onGround = true;
        }
      }

      if (this._anyOverlap(pos, size)) {
        pos.z = oldZ;
        pos.y = oldY;
        if (res.onGround && stepHeight > 0 && this._tryStepUp(pos, size, 0, delta.z, stepHeight, res)) {
          res.onGround = true;
        } else {
          res.hitWall = true; res.hitZ = true;
        }
      }
    }

    return res;
  }

  _tryStepUp(pos, size, dx, dz, stepHeight, res = null) {
    const oldX = pos.x, oldY = pos.y, oldZ = pos.z;
    pos.y += stepHeight + 0.01;
    pos.x += dx; pos.z += dz;

    if (this._anyOverlap(pos, size)) {
      pos.x = oldX; pos.y = oldY; pos.z = oldZ;
      return false;
    }

    // desce até achar chão sólido
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
          if (b.isRamp || b.isDome) {
            const surf = b.getSurfaceAt(pos.x, pos.z);
            if (surf) {
              pos.y = surf.y;
              landed = true;
              if (res) {
                res.groundMaterial = b.meta?.material || 'floor';
                res.groundNormal = surf.normal;
              }
              break;
            }
          } else {
            pos.y = b.max.y;
            landed = true;
            if (res) res.groundMaterial = b.meta?.material || 'floor';
            break;
          }
        }
      }
      if (landed) return true;
    }
    pos.x = oldX; pos.y = oldY; pos.z = oldZ;
    return false;
  }

  /** 
   * Ray-AABB / Ray-Ramp / Ray-Dome com Spatial Hash Grid Traversal.
   * Retorna { box, distance, point, normal } ou null.
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

    let bestT = maxDist, bestBox = null, bestTMax = 0, bestNormal = { x: 0, y: 0, z: 0 };

    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      if (!b.solid) continue;

      let normX = 0, normY = 0, normZ = 0;

      let tmin = (b.min.x - origin.x) * inv.x;
      let tmax = (b.max.x - origin.x) * inv.x;
      let nx = -1;
      if (tmin > tmax) { const tmp = tmin; tmin = tmax; tmax = tmp; nx = 1; }

      let tymin = (b.min.y - origin.y) * inv.y;
      let tymax = (b.max.y - origin.y) * inv.y;
      let ny = -1;
      if (tymin > tymax) { const tmp = tymin; tymin = tymax; tymax = tmp; ny = 1; }
      if (tmin > tymax || tymin > tmax) continue;

      if (tymin > tmin) {
        tmin = tymin; normX = 0; normY = ny; normZ = 0;
      } else {
        normX = nx; normY = 0; normZ = 0;
      }
      if (tymax < tmax) tmax = tymax;

      let tzmin = (b.min.z - origin.z) * inv.z;
      let tzmax = (b.max.z - origin.z) * inv.z;
      let nz = -1;
      if (tzmin > tzmax) { const tmp = tzmin; tzmin = tzmax; tzmax = tmp; nz = 1; }
      if (tmin > tzmax || tzmin > tmax) continue;

      if (tzmin > tmin) {
        tmin = tzmin; normX = 0; normY = 0; normZ = nz;
      }
      if (tzmax < tmax) tmax = tzmax;

      if (tmax < 0) continue;

      // Intersecção analítica de Rampa
      if (b.isRamp) {
        const denom = dir.x * b.normal.x + dir.y * b.normal.y + dir.z * b.normal.z;
        if (Math.abs(denom) > 1e-6) {
          const p0 = {
            x: b.center.x,
            y: b.min.y,
            z: b.direction === '+z' ? b.min.z : (b.direction === '-z' ? b.max.z : b.center.z)
          };
          if (b.direction === '+x') p0.x = b.min.x;
          if (b.direction === '-x') p0.x = b.max.x;

          const numer = (p0.x - origin.x)*b.normal.x + (p0.y - origin.y)*b.normal.y + (p0.z - origin.z)*b.normal.z;
          const tr = numer / denom;
          if (tr > 0 && tr < bestT) {
            const hx = origin.x + dir.x * tr;
            const hy = origin.y + dir.y * tr;
            const hz = origin.z + dir.z * tr;
            const eps = 0.05;
            if (hx >= b.min.x - eps && hx <= b.max.x + eps &&
                hy >= b.min.y - eps && hy <= b.max.y + eps &&
                hz >= b.min.z - eps && hz <= b.max.z + eps) {
              bestT = tr;
              bestTMax = tmax;
              bestBox = b;
              bestNormal = { ...b.normal };
              continue;
            }
          }
        }
      }

      // Intersecção analítica de Domo Elipsoidal
      if (b.isDome) {
        const cx = b.center.x, cy = b.center.y, cz = b.center.z;
        const rx = b.radius.x, ry = b.radius.y, rz = b.radius.z;

        const ox = (origin.x - cx) / rx;
        const oy = (origin.y - cy) / ry;
        const oz = (origin.z - cz) / rz;

        const dx = dir.x / rx;
        const dy = dir.y / ry;
        const dz = dir.z / rz;

        const aCoeff = dx*dx + dy*dy + dz*dz;
        const bCoeff = 2 * (ox*dx + oy*dy + oz*dz);
        const cCoeff = ox*ox + oy*oy + oz*oz - 1.0;

        const discr = bCoeff*bCoeff - 4*aCoeff*cCoeff;
        if (discr >= 0) {
          const sqrtD = Math.sqrt(discr);
          const t1 = (-bCoeff - sqrtD) / (2*aCoeff);
          const t2 = (-bCoeff + sqrtD) / (2*aCoeff);
          const td = t1 > 1e-4 ? t1 : (t2 > 1e-4 ? t2 : -1);

          if (td > 0 && td < bestT) {
            const hy = origin.y + dir.y * td;
            if (hy >= cy - 0.01) {
              const hx = origin.x + dir.x * td;
              const hz = origin.z + dir.z * td;
              const gx = (hx - cx) / (rx * rx);
              const gy = (hy - cy) / (ry * ry);
              const gz = (hz - cz) / (rz * rz);
              const glen = Math.hypot(gx, gy, gz) || 1e-6;

              bestT = td;
              bestTMax = t2 > 0 ? t2 : td;
              bestBox = b;
              bestNormal = { x: gx / glen, y: gy / glen, z: gz / glen };
              continue;
            }
          }
        }
      }

      if (tmin > 0 && tmin < bestT) {
        bestT = tmin;
        bestTMax = tmax;
        bestBox = b;
        bestNormal = { x: normX, y: normY, z: normZ };
      }
    }

    if (!bestBox) return null;
    return {
      box: bestBox,
      distance: bestT,
      exitDistance: bestTMax,
      thickness: Math.max(0.01, bestTMax - bestT),
      normal: bestNormal,
      point: {
        x: origin.x + dir.x * bestT,
        y: origin.y + dir.y * bestT,
        z: origin.z + dir.z * bestT,
      },
    };
  }
}
