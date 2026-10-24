import * as THREE from 'three';
import { WEAPONS } from '../weapons/WeaponDefs.js';

export class ItemDrop {
  static builders = {};
  // Mantém suporte ao modelo 3D giratório para uso futuro em menus (false = adesivo 2D anti-lag no chão)
  static use3DModel = false;
  static _stickerMats = {};
  static _stickerGeo = null;

  static setBuilders(map) {
    ItemDrop.builders = map || {};
  }

  static prepareTemplate(tpl) {
    if (!tpl || tpl.userData._prepared) return tpl;
    const bbox = new THREE.Box3().setFromObject(tpl);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    tpl.userData._precomputedCenter = center;

    tpl.traverse(o => {
      if (o.isLight) o.intensity = 0;
      if (o.name && (o.name.includes('flash') || o.name.includes('Flash'))) o.visible = false;
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    tpl.userData._prepared = true;
    return tpl;
  }

  static _drawWeaponSilhouette2D(ctx, weaponId, colorHex) {
    ctx.save();
    ctx.translate(128, 86);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 3;

    if (weaponId === 'p9' || weaponId === 'sw500') {
      // Pistola / Revólver
      const isRevolver = weaponId === 'sw500';
      ctx.fillRect(-38, -16, isRevolver ? 78 : 56, 16); // cano/slide
      ctx.strokeRect(-38, -16, isRevolver ? 78 : 56, 16);
      if (isRevolver) {
        ctx.fillStyle = colorHex;
        ctx.fillRect(-14, -12, 22, 14); // tambor
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-36, 0);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-26, 28);
      ctx.lineTo(-44, 26);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (weaponId === 'uzi') {
      // Micro-SMG
      ctx.fillRect(-36, -16, 68, 18);
      ctx.strokeRect(-36, -16, 68, 18);
      ctx.fillRect(-8, 2, 14, 30); // mag vertical
      ctx.strokeRect(-8, 2, 14, 30);
      ctx.fillRect(-32, 2, 12, 20); // grip
      ctx.strokeRect(-32, 2, 12, 20);
    } else if (weaponId === 'm12') {
      // Shotgun
      ctx.fillRect(-82, -10, 160, 10); // cano longo
      ctx.strokeRect(-82, -10, 160, 10);
      ctx.fillStyle = colorHex;
      ctx.fillRect(-20, 0, 56, 8); // pump
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-82, -10);
      ctx.lineTo(-48, -10);
      ctx.lineTo(-56, 18);
      ctx.lineTo(-90, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Rifles / LMG / Sniper (ar15, ak47, m249, vss, rifle_proto)
      ctx.fillRect(-52, -12, 86, 15); // corpo
      ctx.strokeRect(-52, -12, 86, 15);
      ctx.fillRect(34, -8, 52, 7); // cano
      ctx.strokeRect(34, -8, 52, 7);
      // Coronha
      ctx.beginPath();
      ctx.moveTo(-52, -12);
      ctx.lineTo(-86, -6);
      ctx.lineTo(-86, 14);
      ctx.lineTo(-52, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Magazine / Caixa M249
      ctx.fillStyle = colorHex;
      if (weaponId === 'm249') {
        ctx.fillRect(-10, 3, 28, 24);
        ctx.strokeRect(-10, 3, 28, 24);
      } else {
        ctx.beginPath();
        ctx.moveTo(-4, 3);
        ctx.lineTo(12, 3);
        ctx.lineTo(20, 28);
        ctx.lineTo(2, 28);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Scope para VSS / Proto / SCAR-H
      if (weaponId === 'vss' || weaponId === 'rifle_proto' || weaponId === 'scar_h') {
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(-22, -24, 42, 9);
        ctx.strokeRect(-22, -24, 42, 9);
      }
    }
    ctx.restore();
  }

  static getStickerMaterial(weaponId) {
    if (ItemDrop._stickerMats[weaponId]) {
      return ItemDrop._stickerMats[weaponId];
    }

    const def = WEAPONS[weaponId];
    let glowColor = 0xffcc00;
    if (def) {
      if (def.type === 'sniper' || weaponId === 'scar_h') {
        glowColor = 0x00f0ff;
      } else if (def.type === 'heavy') {
        glowColor = 0xff6600;
      } else if (def.type === 'shotgun') {
        glowColor = 0xff3344;
      } else if (def.type === 'smg') {
        glowColor = 0x33ff66;
      } else if (def.type === 'pistol') {
        glowColor = weaponId === 'sw500' ? 0xff00bb : 0x33ff66;
      }
    }

    if (typeof document === 'undefined') {
      const fallbackMat = new THREE.MeshBasicMaterial({ color: glowColor, side: THREE.DoubleSide });
      ItemDrop._stickerMats[weaponId] = fallbackMat;
      return fallbackMat;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 176;
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || typeof ctx.clearRect !== 'function') {
      const fallbackMat = new THREE.MeshBasicMaterial({ color: glowColor, side: THREE.DoubleSide });
      ItemDrop._stickerMats[weaponId] = fallbackMat;
      return fallbackMat;
    }
    const colorHex = '#' + glowColor.toString(16).padStart(6, '0');
    const label = (def?.name || weaponId).toUpperCase();

    ctx.clearRect(0, 0, 256, 176);

    // 1. Borda branca grossa estilo adesivo recortado na tesoura (die-cut sticker)
    ctx.save();
    ctx.translate(128, 88);
    ctx.rotate(-0.03);
    ctx.fillStyle = '#f8f9fa';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-112, -68);
    ctx.lineTo(106, -72);
    ctx.lineTo(116, 64);
    ctx.lineTo(-108, 70);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Fundo interno escuro com moldura neon da raridade/tipo da arma
    ctx.fillStyle = '#14181d';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    ctx.fillRect(-100, -56, 200, 112);
    ctx.strokeRect(-100, -56, 200, 112);

    // 3. Linha pontilhada de recorte ("✂️ RECORTE AQUI")
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-94, -50, 188, 100);
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Desenho 2D descarado da arma no centro
    ItemDrop._drawWeaponSilhouette2D(ctx, weaponId, colorHex);

    // 5. Textos zoeiros de "Adesivo 2D Anti-Lag"
    ctx.fillStyle = colorHex;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('✂️ ADESIVO 2D ANTI-LAG™', 128, 49);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Impact, sans-serif';
    ctx.fillText(`${label}.PNG`, 128, 134);

    // 6. Pedaços de fita crepe amarela colando o adesivo no chão
    ctx.fillStyle = 'rgba(245, 222, 130, 0.88)';
    ctx.strokeStyle = 'rgba(120, 100, 40, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.translate(34, 26);
    ctx.rotate(-0.55);
    ctx.fillRect(-26, -9, 52, 18);
    ctx.strokeRect(-26, -9, 52, 18);
    ctx.restore();

    ctx.save();
    ctx.translate(222, 148);
    ctx.rotate(-0.48);
    ctx.fillRect(-26, -9, 52, 18);
    ctx.strokeRect(-26, -9, 52, 18);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    ItemDrop._stickerMats[weaponId] = mat;
    return mat;
  }

  constructor({ id, weaponId, ammo = 30, pos, scene = null, world = null, use3DModel = null }) {
    this.id = id || Math.random().toString(36).substring(2, 9);
    this.weaponId = weaponId || 'ar15';
    this.ammo = ammo;
    this.pos = new THREE.Vector3(pos.x, Math.max(0.2, pos.y), pos.z);
    this.baseY = Math.max(0.38, this.pos.y);
    this.size = new THREE.Vector3(0.8, 0.4, 0.8);
    this.scene = scene;
    this.world = world;
    this.collected = false;
    this.animTime = Math.random() * Math.PI * 2;
    this.use3DModel = use3DModel !== null ? use3DModel : ItemDrop.use3DModel;

    // Trigger de colisão puro (solid: false para permitir passagem e detecção)
    this.triggerBox = null;
    if (this.world) {
      this.triggerBox = this.world.addBox(
        this.pos.x, this.pos.y, this.pos.z,
        this.size.x, this.size.y, this.size.z,
        { solid: false, isTrigger: true, itemDrop: this }
      );
    }

    // Representação visual (Adesivo 2D no chão por padrão, ou modelo 3D se use3DModel = true)
    this.mesh = null;
    this._disposables = [];
    if (this.scene) {
      this._createVisual();
    }
  }

  _createVisual() {
    // ── MODO PADRÃO EM PARTIDA: ADESIVO 2D DESCARADO COLADO NO CHÃO (ZERO LAG) ──
    if (!this.use3DModel) {
      if (!ItemDrop._stickerGeo) {
        ItemDrop._stickerGeo = new THREE.PlaneGeometry(1.15, 0.80);
        ItemDrop._stickerGeo.rotateX(-Math.PI / 2);
      }
      const mat = ItemDrop.getStickerMaterial(this.weaponId);
      const stickerMesh = new THREE.Mesh(ItemDrop._stickerGeo, mat);
      const floorY = Math.max(0.03, this.pos.y - 0.27);
      stickerMesh.position.set(this.pos.x, floorY, this.pos.z);
      stickerMesh.rotation.y = this.animTime;
      this.mesh = stickerMesh;
      this.scene.add(this.mesh);
      return;
    }

    // ── MODO 3D (Mantido intacto para uso futuro em menus/vitrine) ──
    const def = WEAPONS[this.weaponId];
    const group = new THREE.Group();
    group.position.set(this.pos.x, this.baseY, this.pos.z);

    // Cor do halo / identificação por tipo de arma
    let glowColor = 0xffcc00; // rifle padrão
    if (def) {
      if (def.type === 'sniper' || this.weaponId === 'scar_h') {
        glowColor = 0x00f0ff;
      } else if (def.type === 'heavy') {
        glowColor = 0xff6600;
      } else if (def.type === 'shotgun') {
        glowColor = 0xff3344;
      } else if (def.type === 'smg') {
        glowColor = 0x33ff66;
      } else if (def.type === 'pistol') {
        glowColor = this.weaponId === 'sw500' ? 0xff00bb : 0x33ff66;
      }
    }

    let weaponObj = null;
    
    if (!ItemDrop._templates) ItemDrop._templates = {};

    if (!ItemDrop._templates[this.weaponId]) {
      const builder = ItemDrop.builders[this.weaponId];
      if (typeof builder === 'function') {
        try {
          const res = builder();
          ItemDrop._templates[this.weaponId] = ItemDrop.prepareTemplate(res.group ?? res);
        } catch (err) {
          console.warn(`[ItemDrop] Falha ao construir modelo 3D para ${this.weaponId}:`, err);
        }
      }
    }

    const tpl = ItemDrop.prepareTemplate(ItemDrop._templates[this.weaponId]);
    if (tpl) {
      weaponObj = tpl.clone();
      if (tpl.userData._precomputedCenter) {
        weaponObj.position.sub(tpl.userData._precomputedCenter);
      }

      // Leve inclinação tática para dar destaque à silhueta
      weaponObj.rotation.x = 0.15;
      weaponObj.rotation.z = 0.20;

      group.add(weaponObj);
    } else {
      // Fallback procedural clássico: caixa/estojo tático
      const boxGeo = new THREE.BoxGeometry(0.5, 0.15, 0.22);
      const boxMat = new THREE.MeshStandardMaterial({
        color: glowColor,
        roughness: 0.4,
        metalness: 0.6,
        emissive: glowColor,
        emissiveIntensity: 0.25
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.castShadow = true;
      group.add(boxMesh);
      this._disposables.push(boxGeo, boxMat);
    }

    // Halo tático no solo (círculo emissivo que marca o drop sem precisar de PointLight dinâmico)
    if (!ItemDrop._ringGeo) {
      ItemDrop._ringGeo = new THREE.RingGeometry(0.25, 0.35, 24);
      ItemDrop._ringGeo.rotateX(-Math.PI / 2);
    }
    const ringMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72
    });
    const ringMesh = new THREE.Mesh(ItemDrop._ringGeo, ringMat);
    ringMesh.position.y = -0.32;
    group.add(ringMesh);
    this._disposables.push(ringMat);

    this.mesh = group;
    this.scene.add(this.mesh);
  }

  update(dt) {
    if (!this.use3DModel) return; // Adesivo 2D fica colado estático no chão (custo 0 de CPU por frame)
    this.animTime += dt;
    if (this.mesh) {
      this.mesh.rotation.y += dt * 1.5;
      this.mesh.position.y = this.baseY + Math.sin(this.animTime * 3) * 0.08;
    }
  }

  checkPickup(character) {
    if (this.collected || !character || !character.alive) return false;
    const dist = Math.hypot(character.pos.x - this.pos.x, character.pos.z - this.pos.z);
    return dist < 1.4;
  }

  destroy() {
    this.collected = true;
    if (this.triggerBox && this.world) {
      this.world.removeBox(this.triggerBox);
      this.triggerBox = null;
    }
    if (this.mesh) {
      if (this.mesh.parent) {
        this.mesh.parent.remove(this.mesh);
      }
      if (this._disposables) {
        for (const item of this._disposables) {
          if (item.dispose) item.dispose();
        }
        this._disposables = [];
      }
      if (this.use3DModel && this.mesh.clear) {
        this.mesh.clear();
      }
      this.mesh = null;
    }
  }
}
