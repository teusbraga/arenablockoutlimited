import * as THREE from 'three';

/**
 * Mundo de colisão com AABBs.
 * Convenção: entidade.pos = PÉS (bottom-center).
 *            entidade.size = extents totais {x, y, z}.
 */
export class CollisionWorld {
  constructor() { this.boxes = []; }

  addBox(cx, cy, cz, sx, sy, sz, meta = {}) {
    const box = {
      min: { x: cx - sx/2, y: cy - sy/2, z: cz - sz/2 },
      max: { x: cx + sx/2, y: cy + sy/2, z: cz + sz/2 },
      solid: meta.solid !== false,
      vaultable: !!meta.vaultable,
      meta,
    };
    this.boxes.push(box);
    return box;
  }
  removeBox(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
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
    for (const b of this.boxes) {
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

    // ---------- Y ----------
    pos.y += delta.y;
    for (const b of this.boxes) {
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
    while (drop > 0) {
      pos.y -= 0.02; drop -= 0.02;
      let landed = false;
      for (const b of this.boxes) {
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

  /** Ray-AABB (slab method). Retorna { box, distance, point } ou null. */
  raycast(origin, dir, maxDist = Infinity) {
    const inv = { x: 1/(dir.x || 1e-9), y: 1/(dir.y || 1e-9), z: 1/(dir.z || 1e-9) };
    let bestT = maxDist, bestBox = null;

    for (const b of this.boxes) {
      if (!b.solid) continue;
      let tmin = (b.min.x - origin.x) * inv.x;
      let tmax = (b.max.x - origin.x) * inv.x;
      if (tmin > tmax) [tmin, tmax] = [tmax, tmin];

      let tymin = (b.min.y - origin.y) * inv.y;
      let tymax = (b.max.y - origin.y) * inv.y;
      if (tymin > tymax) [tymin, tymax] = [tymax, tymin];
      if (tmin > tymax || tymin > tmax) continue;
      if (tymin > tmin) tmin = tymin;
      if (tymax < tmax) tmax = tymax;

      let tzmin = (b.min.z - origin.z) * inv.z;
      let tzmax = (b.max.z - origin.z) * inv.z;
      if (tzmin > tzmax) [tzmin, tzmax] = [tzmax, tzmin];
      if (tmin > tzmax || tzmin > tmax) continue;
      if (tzmin > tmin) tmin = tzmin;
      if (tzmax < tmax) tmax = tzmax;

      if (tmax < 0) continue;
      if (tmin > 0 && tmin < bestT) { bestT = tmin; bestBox = b; }
    }
    if (!bestBox) return null;
    return {
      box: bestBox,
      distance: bestT,
      point: new THREE.Vector3(
        origin.x + dir.x * bestT,
        origin.y + dir.y * bestT,
        origin.z + dir.z * bestT,
      ),
    };
  }
}