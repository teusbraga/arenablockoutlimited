import * as THREE from 'three';
import { on } from '../core/EventBus.js';
import { surfaceEyedropper } from '../world/SurfaceEyedropper.js';
import { ProceduralDecalAtlas } from './ProceduralDecalAtlas.js';

// Vetores e constantes pré-alocados para Zero-Alloc no loop de combate
const _tempPos = new THREE.Vector3();
const _tempNorm = new THREE.Vector3();
const _tempTangent = new THREE.Vector3();
const _tempBitangent = new THREE.Vector3();
const _upZ = new THREE.Vector3(0, 0, 1);
const _defaultNormal = new THREE.Vector3(0, 1, 0);

// Escalas base por calibre de munição (metros de raio de cratera)
const CALIBER_SCALES = {
  '9x19': 0.055,
  '5.56x45': 0.075,
  '7.62x39': 0.090,
  '7.62x51': 0.105,
  '9x39': 0.085,
  '.500': 0.150,
  '12gauge': 0.040 // Pellets individuais
};

export class DecalSystem {
  /**
   * @param {THREE.Scene} scene Cena Three.js
   * @param {object} options Configurações data-driven
   */
  constructor(scene, options = {}) {
    this.scene = scene;
    this.config = options.config || {};
    this.surfaceImpacts = options.surfaceImpacts?.materials || options.surfaceImpacts || {};

    // Parâmetros Data-Driven com fallbacks canônicos
    this.maxDecals = this.config.maxDecals || 128;
    this.lifetime = this.config.lifetime || 40.0;
    this.fadeDuration = this.config.fadeDuration || 5.0;
    this.normalOffset = this.config.normalOffset || 0.0015;

    // Gerador de Atlas e Normal Map Procedural
    this.atlas = new ProceduralDecalAtlas(512);
    const { diffuseTexture, normalTexture } = this.atlas.generate();
    this.diffuseTexture = diffuseTexture;
    this.normalTexture = normalTexture;

    // Grupo de decals na cena
    this.group = new THREE.Group();
    this.group.name = 'DecalSystemGroup';
    if (this.scene) {
      this.scene.add(this.group);
    }

    // Pool de Decals (Ring Buffer)
    this.pool = [];
    this.poolIdx = 0;
    this._initPool();

    // Inscrição em eventos do EventBus
    this._unsubscribes = [];
    this._bindEvents();
  }

  /**
   * Inicializa o Ring Buffer pré-alocado de quads.
   */
  _initPool() {
    for (let i = 0; i < this.maxDecals; i++) {
      // Cada decal possui sua própria geometria de 4 vértices para mapeamento de UV individual
      const geometry = new THREE.PlaneGeometry(1, 1);

      // Material PBR Standard com Normal Map e polygonOffset para eliminar Z-fighting
      const material = new THREE.MeshStandardMaterial({
        map: this.diffuseTexture,
        normalMap: this.normalTexture,
        normalScale: new THREE.Vector2(1.2, 1.2),
        transparent: true,
        opacity: 1.0,
        roughness: 0.85,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1.0,
        polygonOffsetUnits: -4.0,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.matrixAutoUpdate = true;
      this.group.add(mesh);

      this.pool.push({
        mesh,
        geometry,
        material,
        active: false,
        lifeRemaining: 0,
        maxLife: this.lifetime,
        fadeDuration: this.fadeDuration,
        baseScale: 1.0
      });
    }
  }

  /**
   * Conecta os listeners ao EventBus.
   */
  _bindEvents() {
    this._unsubscribes.push(
      on('shot:world', e => this._onShotWorld(e)),
      on('shot:penetration', e => this._onShotPenetration(e)),
      on('shot:ricochet', e => this._onShotRicochet(e)),
      on('game:reset', () => this.reset())
    );
  }

  /**
   * Handler de impacto no mundo estático (paredes e pisos).
   */
  _onShotWorld(e) {
    if (!e || !e.point) return;

    const normal = e.normal || _defaultNormal;
    const materialKey = (e.material || 'concrete').toLowerCase();
    const weaponDef = e.weapon || null;

    this.spawnDecal({
      point: e.point,
      normal,
      materialKey,
      weaponDef,
      type: 'entry'
    });
  }

  /**
   * Handler de penetração de superfície (wallbang).
   * Spawna decal de entrada com fuligem + cratera violenta de saída sem fuligem.
   */
  _onShotPenetration(e) {
    if (!e) return;
    const materialKey = (e.material || 'concrete').toLowerCase();
    const weaponDef = e.weapon || null;

    // 1. Buraco de entrada
    if (e.entryPoint) {
      const entryNormal = e.normal || _defaultNormal;
      this.spawnDecal({
        point: e.entryPoint,
        normal: entryNormal,
        materialKey,
        weaponDef,
        type: 'entry',
        scaleMultiplier: 0.9
      });
    }

    // 2. Cratera de saída (blowout)
    if (e.exitPoint) {
      // Normal de saída aponta para o lado oposto da entrada
      const exitNormal = e.normal
        ? _tempNorm.set(-e.normal.x, -e.normal.y, -e.normal.z)
        : _defaultNormal;

      this.spawnDecal({
        point: e.exitPoint,
        normal: exitNormal,
        materialKey,
        weaponDef,
        type: 'exit',
        scaleMultiplier: 1.65 // Blowout significativamente maior
      });
    }
  }

  /**
   * Handler de ricochete angular físico.
   * Spawna sulco de raspão elíptico na direção da reflexão.
   */
  _onShotRicochet(e) {
    if (!e || !e.point) return;

    const normal = e.normal || _defaultNormal;
    const materialKey = (e.material || 'metal').toLowerCase();
    const weaponDef = e.weapon || null;

    this.spawnDecal({
      point: e.point,
      normal,
      materialKey,
      weaponDef,
      type: 'ricochet',
      scaleMultiplier: 1.2
    });
  }

  /**
   * Spawna ou reutiliza um decal do Ring Buffer.
   */
  spawnDecal(params) {
    const { point, normal, materialKey, weaponDef, type = 'entry', scaleMultiplier = 1.0 } = params;

    // Avança ponteiro circular do pool
    const decal = this.pool[this.poolIdx];
    this.poolIdx = (this.poolIdx + 1) % this.maxDecals;

    const mesh = decal.mesh;
    const mat = decal.material;

    // 1. Resolve configurações do material
    const matConfig = this._resolveMaterialConfig(materialKey);
    const decalCfg = matConfig?.decal || {};
    const slotKey = decalCfg.atlasSlot || this._getSlotForMaterial(materialKey);

    // 2. Configura UVs no BufferGeometry conforme o slot do Atlas
    this._applyUVs(decal.geometry, slotKey);

    // 3. Posicionamento e alinhamento com a normal
    _tempNorm.copy(normal).normalize();
    if (_tempNorm.lengthSq() < 0.001) _tempNorm.copy(_defaultNormal);

    // Posição com micro-offset para eliminar Z-fighting
    _tempPos.copy(point).addScaledVector(_tempNorm, this.normalOffset);
    mesh.position.copy(_tempPos);

    // Orientação: o plano original tem normal apontando para +Z
    mesh.quaternion.setFromUnitVectors(_upZ, _tempNorm);

    // Rotação aleatória no eixo Z local (quebra repetição)
    const randomAngle = Math.random() * Math.PI * 2;
    mesh.rotateZ(randomAngle);

    // 4. Escala calibrada pelo calibre da arma
    const caliberKey = weaponDef?.ammo || '5.56x45';
    const baseCaliberScale = CALIBER_SCALES[caliberKey] || 0.075;
    const matScale = decalCfg.baseScale ?? 1.0;
    const finalScale = baseCaliberScale * matScale * scaleMultiplier;

    if (type === 'ricochet') {
      // Sulco de raspão: esticado longitudinalmente
      mesh.scale.set(finalScale * 0.65, finalScale * 2.4, 1.0);
    } else if (type === 'exit') {
      // Cratera de saída: estilhaçada irregular
      mesh.scale.set(finalScale * 1.25, finalScale * 1.15, 1.0);
    } else {
      // Entrada padrão
      mesh.scale.set(finalScale, finalScale, 1.0);
    }

    // 5. Ajustes de Material PBR e Amostragem de Cor (SurfaceEyedropper)
    mat.roughness = decalCfg.roughness ?? 0.85;
    mat.metalness = decalCfg.metalness ?? 0.05;

    // Amostragem com conta-gotas na parede
    const sampledColor = surfaceEyedropper.sampleColor(point, _tempNorm, materialKey);
    if (sampledColor !== null && type !== 'exit') {
      // Multiplica sutilmente a cor base da parede na borda do decal
      mat.color.setHex(sampledColor);
      // Mantém contraste suficiente para o buraco escuro
      mat.color.lerp(new THREE.Color(0xffffff), 0.45);
    } else if (type === 'exit') {
      // Saída de parede: cor do miolo do material
      mat.color.setHex(0xe8dfd5);
    } else {
      mat.color.setHex(0xffffff);
    }

    // 6. Ativação e Ciclo de Vida
    mat.opacity = 1.0;
    decal.lifeRemaining = this.lifetime;
    decal.maxLife = this.lifetime;
    decal.fadeDuration = this.fadeDuration;
    decal.active = true;
    mesh.visible = true;

    return decal;
  }

  /**
   * Aplica coordenadas UV no buffer geometry conforme o slot do atlas.
   */
  _applyUVs(geometry, slotKey) {
    const uvAttr = geometry.attributes.uv;
    if (!uvAttr) return;

    const bounds = this.atlas.getUVBounds(slotKey);
    const u0 = bounds.uOffset;
    const u1 = bounds.uOffset + bounds.uScale;
    const v0 = bounds.vOffset;
    const v1 = bounds.vOffset + bounds.vScale;

    // PlaneGeometry ordem padrão: (0, 1), (1, 1), (0, 0), (1, 0)
    const arr = uvAttr.array;
    arr[0] = u0; arr[1] = v1;
    arr[2] = u1; arr[3] = v1;
    arr[4] = u0; arr[5] = v0;
    arr[6] = u1; arr[7] = v0;

    uvAttr.needsUpdate = true;
  }

  /**
   * Mapeia nome do material da engine para o slot do atlas correspondente.
   */
  _getSlotForMaterial(matKey) {
    if (!matKey) return 'concrete';
    if (matKey.includes('metal') || matKey.includes('iron') || matKey.includes('steel') || matKey.includes('plinker')) return 'metal';
    if (matKey.includes('wood') || matKey.includes('target')) return 'wood';
    if (matKey.includes('dirt') || matKey.includes('sand') || matKey.includes('grass')) return 'dirt';
    return 'concrete';
  }

  /**
   * Resolve configurações do material a partir de `surface_impacts.json`.
   */
  _resolveMaterialConfig(key) {
    if (!key) return this.surfaceImpacts.default || null;
    const k = key.toLowerCase();
    for (const [matName, cfg] of Object.entries(this.surfaceImpacts)) {
      if (k.includes(matName)) return cfg;
    }
    return this.surfaceImpacts.default || null;
  }

  /**
   * Atualização de ciclo de vida e fade-out (chamado em renderUpdate a 60 Hz).
   * @param {number} dt Delta time em segundos
   */
  update(dt) {
    if (dt <= 0) return;

    for (let i = 0; i < this.maxDecals; i++) {
      const d = this.pool[i];
      if (!d.active) continue;

      d.lifeRemaining -= dt;

      if (d.lifeRemaining <= 0) {
        // Expirou: desliga e disponibiliza
        d.active = false;
        d.mesh.visible = false;
      } else if (d.lifeRemaining < d.fadeDuration) {
        // Fade-out suave nos últimos segundos
        const progress = Math.max(0, d.lifeRemaining / d.fadeDuration);
        d.material.opacity = progress;
      }
    }
  }

  /**
   * Reseta todos os decals ativos (ex: na troca de round ou game reset).
   */
  reset() {
    for (let i = 0; i < this.maxDecals; i++) {
      const d = this.pool[i];
      d.active = false;
      d.lifeRemaining = 0;
      if (d.mesh) d.mesh.visible = false;
    }
    this.poolIdx = 0;
  }

  /**
   * Teardown limpo: descarte de recursos de GPU e unbind de eventos.
   */
  destroy() {
    // 1. Cancela listeners
    for (const unsub of this._unsubscribes) {
      if (typeof unsub === 'function') unsub();
    }
    this._unsubscribes = [];

    // 2. Descarta meshes, geometrias e materiais da GPU
    for (let i = 0; i < this.pool.length; i++) {
      const d = this.pool[i];
      if (d.geometry) d.geometry.dispose();
      if (d.material) d.material.dispose();
    }
    this.pool = [];

    // 3. Remove grupo da cena
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // 4. Descarta atlas de textura
    if (this.atlas) {
      this.atlas.destroy();
      this.atlas = null;
    }
  }
}
