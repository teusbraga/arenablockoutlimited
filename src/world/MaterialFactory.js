import * as THREE from 'three';
import { textures } from './TextureGenerator.js';

/**
 * MaterialFactory.js
 * Fábrica e Gerenciador Central de Materiais PBR com Mapeamento World-Space (Triplanar),
 * instanciação LAZY (sob demanda) de texturas procedurais e suporte a imagens externas (PNG/JPG/Bitmap).
 */

export class MaterialFactory {
  constructor() {
    this.materials = new Map();
    this.factories = new Map();
    this.currentMode = 'pbr'; // 'pbr' | 'flat_textures' | 'color_only'
    this.bumpScale = 0.045;
    this._customImageTextures = new Map();
    this._factoriesRegistered = false;
  }

  /**
   * Injeta mapeamento de coordenadas mundiais (World-Space UV) no shader de MeshStandardMaterial.
   * Elimina completamente qualquer distorção ou esticamento de texturas em caixas e paredes de qualquer tamanho!
   */
  static applyWorldSpaceUV(material, scale = 0.35) {
    material.userData.worldUVScale = scale;

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWorldUVScale = { value: material.userData.worldUVScale };

      shader.vertexShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormalVec;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vec4 _wPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          vWorldPos = _wPos.xyz;
          vWorldNormalVec = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
        #else
          vec4 _wPos = modelMatrix * vec4(transformed, 1.0);
          vWorldPos = _wPos.xyz;
          vWorldNormalVec = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        #endif
        `
      );

      shader.fragmentShader = `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormalVec;
        uniform float uWorldUVScale;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <uv_pars_fragment>',
        `#include <uv_pars_fragment>
        vec2 getWorldProjectedUV() {
          vec3 n = abs(vWorldNormalVec);
          if (n.y > 0.6) {
            return vWorldPos.xz * uWorldUVScale;
          } else if (n.x > 0.6) {
            return vWorldPos.zy * uWorldUVScale;
          } else {
            return vWorldPos.xy * uWorldUVScale;
          }
        }
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          vec2 pUv = getWorldProjectedUV();
          vec4 sampledColor = texture2D(map, pUv);
          #ifdef DECODE_VIDEO_TEXTURE
            sampledColor = vec4(videoTextureDecode(sampledColor.rgb), sampledColor.a);
          #endif
          diffuseColor *= sampledColor;
        #endif`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <bumpmap_pars_fragment>',
        `#ifdef USE_BUMPMAP
          uniform sampler2D bumpMap;
          uniform float bumpScale;
          vec2 dHdxy_fwd() {
            vec2 pUv = getWorldProjectedUV();
            vec2 dSTdx = dFdx(pUv);
            vec2 dSTdy = dFdy(pUv);
            float Hll = bumpScale * texture2D(bumpMap, pUv).x;
            float dBx = bumpScale * texture2D(bumpMap, pUv + dSTdx).x - Hll;
            float dBy = bumpScale * texture2D(bumpMap, pUv + dSTdy).x - Hll;
            return vec2(dBx, dBy);
          }
          vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
            vec3 vSigmaX = dFdx(surf_pos);
            vec3 vSigmaY = dFdy(surf_pos);
            vec3 vN = surf_norm;
            vec3 R1 = cross(vSigmaY, vN);
            vec3 R2 = cross(vN, vSigmaX);
            float fDet = dot(vSigmaX, R1) * faceDirection;
            vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
            return normalize(abs(fDet) * surf_norm - vGrad);
          }
        #endif`
      );

      material.userData.shader = shader;
    };
  }

  /**
   * Registra todas as receitas de materiais no catálogo sem gerá-las previamente (Zero Lag)
   */
  initMaterials() {
    if (this._factoriesRegistered) return this.materials;
    this._factoriesRegistered = true;

    // 1. Cobblestones (CS Italy)
    this.factories.set('cobblestones', () => {
      const cobbles = textures.createCobblestones(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: cobbles.diffuse,
        bumpMap: cobbles.bump,
        bumpScale: 0.05,
        roughnessMap: cobbles.roughness,
        roughness: 0.85,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.45);
      return mat;
    });
    this.factories.set('floor', () => this.get('cobblestones'));

    // 2. Parede Reboco Ocre Toscano Descascado
    this.factories.set('wall_peeling_ochre', () => {
      const peelOchre = textures.createPeelingWall({
        size: 512,
        plasterColor: '#d6a86b',
        brickColor: '#a84128',
        peelAmount: 0.42,
      });
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: peelOchre.diffuse,
        bumpMap: peelOchre.bump,
        bumpScale: 0.05,
        roughness: 0.88,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.4);
      return mat;
    });
    this.factories.set('wall', () => this.get('wall_peeling_ochre'));

    // 3. Parede Terracota Descascada
    this.factories.set('wall_peeling_terra', () => {
      const peelTerra = textures.createPeelingWall({
        size: 512,
        plasterColor: '#b8664e',
        brickColor: '#8a2f1c',
        peelAmount: 0.48,
      });
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: peelTerra.diffuse,
        bumpMap: peelTerra.bump,
        bumpScale: 0.05,
        roughness: 0.88,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.4);
      return mat;
    });

    // 4. Parede Branca Envelhecida
    this.factories.set('wall_white', () => {
      const peelWhite = textures.createPeelingWall({
        size: 512,
        plasterColor: '#ded8cb',
        brickColor: '#b24c32',
        peelAmount: 0.35,
      });
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: peelWhite.diffuse,
        bumpMap: peelWhite.bump,
        bumpScale: 0.045,
        roughness: 0.86,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.4);
      return mat;
    });

    // 5. Blocos de Pedra Travertino
    this.factories.set('stone', () => {
      const stoneArch = textures.createStoneArch(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: stoneArch.diffuse,
        bumpMap: stoneArch.bump,
        bumpScale: 0.06,
        roughness: 0.85,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.35);
      return mat;
    });

    // 6. Telhas de Terracota Curvas
    this.factories.set('roof', () => {
      const roofTiles = textures.createRoofTiles(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: roofTiles.diffuse,
        bumpMap: roofTiles.bump,
        bumpScale: 0.07,
        roughness: 0.82,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.5);
      return mat;
    });

    // 7. Porta de Madeira Rústica
    this.factories.set('door_wood', () => {
      const rusticDoor = textures.createRusticWoodDoor(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: rusticDoor.diffuse,
        bumpMap: rusticDoor.bump,
        bumpScale: 0.04,
        roughness: 0.72,
      });
    });

    // 8. Venezianas de Janela
    this.factories.set('window_shutter', () => {
      const shutters = textures.createWindowShutters(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: shutters.diffuse,
        bumpMap: shutters.bump,
        bumpScale: 0.05,
        roughness: 0.70,
      });
    });

    // 9. Folhagens de Hera
    this.factories.set('ivy_foliage', () => {
      const ivy = textures.createIvyFoliage(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: ivy.diffuse,
        alphaMap: ivy.alpha,
        transparent: true,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.65,
      });
    });

    // 10. Barril de Vinho
    this.factories.set('wine_barrel', () => {
      const wineBarrel = textures.createWineBarrel(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: wineBarrel.diffuse,
        bumpMap: wineBarrel.bump,
        bumpScale: 0.045,
        roughness: 0.68,
      });
    });

    // 11. Caixote de Vinho
    this.factories.set('crate', () => {
      const wineCrate = textures.createWineCrate(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: wineCrate.diffuse,
        bumpMap: wineCrate.bump,
        bumpScale: 0.04,
        roughness: 0.80,
      });
    });
    this.factories.set('wood', () => this.get('crate'));

    // 12. Toldo Listrado
    this.factories.set('awning_red', () => {
      const awning = textures.createStripedAwning(512, '#a8241e', '#ede8dc');
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: awning.diffuse,
        bumpMap: awning.bump,
        bumpScale: 0.03,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
    });

    // 13. Solo / Terra
    this.factories.set('dirt', () => {
      const dirtTex = textures.createDirtPath(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: dirtTex.diffuse,
        bumpMap: dirtTex.bump,
        bumpScale: 0.045,
        roughness: 0.92,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.45);
      return mat;
    });
    this.factories.set('path', () => this.get('dirt'));

    // 14. Grama com Flores Silvestres
    this.factories.set('grass', () => {
      const grassTex = textures.createGrassVillage(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: grassTex.diffuse,
        bumpMap: grassTex.bump,
        bumpScale: 0.04,
        roughnessMap: grassTex.roughness,
        roughness: 0.88,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.45);
      return mat;
    });

    // 15. Tronco de Árvore (Oak Bark)
    this.factories.set('trunk', () => {
      const barkTex = textures.createTreeBark(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: barkTex.diffuse,
        bumpMap: barkTex.bump,
        bumpScale: 0.06,
        roughness: 0.90,
      });
    });

    // 16. Folhagem de Carvalho
    this.factories.set('foliage', () => {
      const oakFoliage = textures.createOakFoliage(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: oakFoliage.diffuse,
        alphaMap: oakFoliage.alpha,
        transparent: true,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.70,
      });
    });
    this.factories.set('foliage_light', () => this.get('foliage'));

    // =========================================================================
    // MATERIAIS DO DUST BLOCK (MIRAGE DUNES)
    // =========================================================================

    // 17. Areia do Deserto com Ondulações de Vento
    this.factories.set('sand', () => {
      const sandDunes = textures.createSandDunes(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: sandDunes.diffuse,
        bumpMap: sandDunes.bump,
        bumpScale: 0.05,
        roughness: 0.92,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.4);
      return mat;
    });
    this.factories.set('sand_dark', () => this.get('sand'));

    // 18. Blocos de Arenito do Oriente Médio
    this.factories.set('sandstone', () => {
      const sandBlocks = textures.createSandstoneBlocks(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: sandBlocks.diffuse,
        bumpMap: sandBlocks.bump,
        bumpScale: 0.06,
        roughness: 0.88,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.35);
      return mat;
    });

    // 19. Adobe / Argamassa Desértica Clara com Rachaduras
    this.factories.set('plaster_light', () => {
      const adobeTex = textures.createAdobePlaster(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: adobeTex.diffuse,
        bumpMap: adobeTex.bump,
        bumpScale: 0.04,
        roughness: 0.86,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.38);
      return mat;
    });

    // 20. Tapetes e Tecidos Árabes
    this.factories.set('fabric_red', () => {
      const rugRed = textures.createArabicRug(512, '#a8241e', '#1e385c');
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: rugRed.diffuse,
        bumpMap: rugRed.bump,
        bumpScale: 0.035,
        roughness: 0.85,
      });
    });
    this.factories.set('arabic_rug', () => this.get('fabric_red'));

    this.factories.set('fabric_green', () => {
      const rugGreen = textures.createArabicRug(512, '#286338', '#8a2b1f');
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: rugGreen.diffuse,
        bumpMap: rugGreen.bump,
        bumpScale: 0.035,
        roughness: 0.85,
      });
    });

    // 21. Palmeiras do Deserto
    this.factories.set('palm_frond', () => {
      const palmFrond = textures.createPalmFronds(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: palmFrond.diffuse,
        alphaMap: palmFrond.alpha,
        transparent: true,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.65,
      });
    });

    this.factories.set('palm_trunk', () => {
      const palmTrunk = textures.createPalmTrunk(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: palmTrunk.diffuse,
        bumpMap: palmTrunk.bump,
        bumpScale: 0.05,
        roughness: 0.88,
      });
    });

    // 22. Caixote Militar de Munição
    this.factories.set('military_crate', () => {
      const milCrate = textures.createMilitaryCrate(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: milCrate.diffuse,
        bumpMap: milCrate.bump,
        bumpScale: 0.045,
        roughness: 0.72,
      });
    });

    // 23. Barril de Petróleo Industrial
    this.factories.set('oil_barrel', () => {
      const oilBarrel = textures.createOilBarrel(512, '#2d5a6e');
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: oilBarrel.diffuse,
        bumpMap: oilBarrel.bump,
        bumpScale: 0.05,
        roughness: 0.55,
        metalness: 0.3,
      });
    });
    this.factories.set('metal_barrel', () => this.get('oil_barrel'));

    // 24. Lona Azul de Construção / Deserto
    this.factories.set('blue_tarp', () => {
      const blueTarp = textures.createStripedAwning(512, '#1e5287', '#2563a6');
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: blueTarp.diffuse,
        bumpMap: blueTarp.bump,
        bumpScale: 0.03,
        roughness: 0.75,
        side: THREE.DoubleSide,
      });
    });

    // 25. Grade de Ferro Forjado
    this.factories.set('iron_grill', () => {
      return new THREE.MeshStandardMaterial({
        color: 0x222428,
        metalness: 0.85,
        roughness: 0.40,
      });
    });
    this.factories.set('fence', () => this.get('iron_grill'));
    this.factories.set('scaffold', () => this.get('iron_grill'));

    // =========================================================================
    // MATERIAIS DE SELVA TROPICAL / WOODS
    // =========================================================================

    // 26. Chão de Selva Úmido com Raízes e Húmus
    this.factories.set('jungle_floor', () => {
      const jFloor = textures.createJungleFloor(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: jFloor.diffuse,
        bumpMap: jFloor.bump,
        bumpScale: 0.055,
        roughnessMap: jFloor.roughness,
        roughness: 0.90,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.4);
      return mat;
    });
    this.factories.set('woods_floor', () => this.get('jungle_floor'));

    // 27. Rocha Coberta de Musgo da Selva
    this.factories.set('mossy_rock', () => {
      const mRock = textures.createMossyRock(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: mRock.diffuse,
        bumpMap: mRock.bump,
        bumpScale: 0.065,
        roughness: 0.88,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.35);
      return mat;
    });
    this.factories.set('rock', () => this.get('mossy_rock'));

    // 28. Tronco de Árvore Gigante Tropical com Musgo
    this.factories.set('jungle_bark', () => {
      const jBark = textures.createJungleBark(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: jBark.diffuse,
        bumpMap: jBark.bump,
        bumpScale: 0.065,
        roughness: 0.90,
      });
    });

    // 29. Folhagem de Samambaia Tropical com Alfa
    this.factories.set('jungle_fern', () => {
      const jFern = textures.createJungleFern(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: jFern.diffuse,
        alphaMap: jFern.alpha,
        transparent: true,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.65,
      });
    });
    this.factories.set('fern', () => this.get('jungle_fern'));

    // 30. Bambu Selvagem
    this.factories.set('bamboo', () => {
      const bamboo = textures.createBambooTexture(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: bamboo.diffuse,
        bumpMap: bamboo.bump,
        bumpScale: 0.045,
        roughness: 0.72,
      });
    });

    // 31. Lona de Camuflagem Militar de Selva
    this.factories.set('camo_tarp', () => {
      const camoTarp = textures.createCamoTarp(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: camoTarp.diffuse,
        bumpMap: camoTarp.bump,
        bumpScale: 0.04,
        roughness: 0.85,
        side: THREE.DoubleSide,
      });
    });
    this.factories.set('camo', () => this.get('camo_tarp'));

    // 32. Sacos de Areia / Bunker Fortificado
    this.factories.set('sandbags', () => {
      const sandbags = textures.createSandbags(512);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: sandbags.diffuse,
        bumpMap: sandbags.bump,
        bumpScale: 0.055,
        roughness: 0.92,
      });
      MaterialFactory.applyWorldSpaceUV(mat, 0.4);
      return mat;
    });

    // 33. Zinco Ondulado Enferrujado (Posto Militar)
    this.factories.set('corrugated_iron', () => {
      const corrIron = textures.createCorrugatedIron(512);
      return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: corrIron.diffuse,
        bumpMap: corrIron.bump,
        bumpScale: 0.06,
        roughness: 0.62,
        metalness: 0.50,
      });
    });
    this.factories.set('rusty_metal', () => this.get('corrugated_iron'));

    return this.materials;
  }

  /**
   * Obtém material por nome, instanciando-o sob demanda (Lazy)
   */
  get(name) {
    if (this.materials.has(name)) {
      return this.materials.get(name);
    }
    if (!this._factoriesRegistered) {
      this.initMaterials();
    }
    if (this.factories.has(name)) {
      const mat = this.factories.get(name)();
      this.materials.set(name, mat);
      return mat;
    }
    return this.materials.get('wall') || new THREE.MeshStandardMaterial({ color: 0x888888 });
  }

  /**
   * Pré-carrega uma lista de materiais de forma assíncrona, dando respiro ao navegador
   * para atualizar a tela de loading.
   */
  async preloadMaterials(names, onProgress) {
    if (!this._factoriesRegistered) {
      this.initMaterials();
    }
    const list = Array.from(new Set(names));
    const toBuild = list.filter(n => this.factories.has(n) && !this.materials.has(n));
    const total = toBuild.length;
    if (total === 0) {
      if (onProgress) onProgress(1.0, 'Texturas prontas');
      return;
    }
    for (let i = 0; i < total; i++) {
      const name = toBuild[i];
      if (onProgress) {
        onProgress(i / total, `Compilando textura: ${name}`);
        // Cede a execução para a thread principal pintar a UI
        await new Promise(r => setTimeout(r, 0));
      }
      this.get(name);
    }
    if (onProgress) onProgress(1.0, 'Texturas compiladas!');
  }

  /**
   * Aplica uma textura de imagem externa (PNG, JPG, Bitmap) a um material existente
   */
  async applyExternalTexture(materialName, fileOrUrl, mapType = 'map') {
    let texture = null;
    if (typeof fileOrUrl === 'string') {
      texture = await textures.loadFromURL(fileOrUrl, mapType === 'map');
    } else if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
      texture = await textures.loadFromFile(fileOrUrl, mapType === 'map');
    }

    if (!texture) return false;

    const mat = this.get(materialName);
    if (mat) {
      mat[mapType] = texture;
      mat.needsUpdate = true;
      this._customImageTextures.set(`${materialName}_${mapType}`, texture);
      return true;
    }
    return false;
  }

  /**
   * Altera modo global de visualização de materiais:
   * - 'pbr': Mapas completos com Diffuse + Bump + Roughness
   * - 'flat_textures': Texturas ativas, mas sem bump/relevo
   * - 'color_only': Somente cor sólida (estilo bloco clássico)
   */
  setRenderMode(mode) {
    this.currentMode = mode;
    for (const mat of this.materials.values()) {
      if (mode === 'color_only') {
        mat.map = null;
        mat.bumpMap = null;
        mat.roughnessMap = null;
      } else if (mode === 'flat_textures') {
        mat.bumpMap = null;
      }
      mat.needsUpdate = true;
    }
  }

  /**
   * Ajusta intensidade global de relevo / bump
   */
  setBumpIntensity(scale) {
    this.bumpScale = scale;
    for (const mat of this.materials.values()) {
      if (mat.bumpMap) {
        mat.bumpScale = scale;
      }
    }
  }

  /**
   * Ajusta escala de repetição de UV para materiais mundiais
   */
  setWorldUVScale(scale) {
    for (const mat of this.materials.values()) {
      if (mat.userData && mat.userData.shader && mat.userData.shader.uniforms.uWorldUVScale) {
        mat.userData.shader.uniforms.uWorldUVScale.value = scale;
      }
      mat.userData.worldUVScale = scale;
    }
  }
}

export const materialFactory = new MaterialFactory();
