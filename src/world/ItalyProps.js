import * as THREE from 'three';
import { materialFactory } from './MaterialFactory.js';
import { TextureGenerator } from './TextureGenerator.js';
import { on } from '../core/EventBus.js';

/**
 * ItalyProps.js
 * Fábrica e construtor de props 3D especializados para o mapa CS Italy:
 * - Janelas italianas com venezianas e peitoris de pedra
 * - Portas rústicas com batentes de travertino
 * - Arcos de pedra conectando edifícios
 * - Sacadas/varandas com grades de ferro e vasos
 * - Trepadeiras/hera com folhas recortadas
 * - Barris de vinho e caixotes de feira
 * - Toldos listrados de mercado italiano
 * - Lanternas de ferro forjado
 * - Galeria/Parede de Inspeção e Teste de Texturas (Material Showcase)
 */

export class ItalyProps {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.plinkers = [];
  }

  /**
   * Adiciona janela italiana completa com venezianas verdes abertas e peitoril de pedra
   */
  addWindow(x, y, z, rotY = 0, width = 1.4, height = 2.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matStone = materialFactory.get('stone');
    const matShutter = materialFactory.get('window_shutter');

    // Peitoril inferior saliente de pedra
    const sillGeo = new THREE.BoxGeometry(width + 0.35, 0.16, 0.28);
    const sillMesh = new THREE.Mesh(sillGeo, matStone);
    sillMesh.position.set(0, -height / 2, 0.08);
    sillMesh.castShadow = true;
    sillMesh.receiveShadow = true;
    group.add(sillMesh);

    // Lintel superior de pedra
    const lintelGeo = new THREE.BoxGeometry(width + 0.35, 0.2, 0.22);
    const lintelMesh = new THREE.Mesh(lintelGeo, matStone);
    lintelMesh.position.set(0, height / 2 + 0.06, 0.05);
    lintelMesh.castShadow = true;
    group.add(lintelMesh);

    // Vidro e venezianas (Painel frontal texturizado)
    const winGeo = new THREE.PlaneGeometry(width, height);
    const winMesh = new THREE.Mesh(winGeo, matShutter);
    winMesh.position.set(0, 0, 0.02);
    winMesh.castShadow = true;
    winMesh.receiveShadow = true;
    group.add(winMesh);

    this.scene.add(group);
    return group;
  }

  /**
   * Adiciona porta rústica de madeira com moldura de pedra
   */
  addRusticDoorFrame(x, y, z, rotY = 0, width = 1.3, height = 2.4) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matStone = materialFactory.get('stone');
    const matDoor = materialFactory.get('door_wood');

    // Lintel e ombreiras de pedra
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.18, height + 0.2, 0.25), matStone);
    frameL.position.set(-width / 2 - 0.08, height / 2, 0.04);
    frameL.castShadow = true;
    group.add(frameL);

    const frameR = frameL.clone();
    frameR.position.x = width / 2 + 0.08;
    group.add(frameR);

    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(width + 0.36, 0.25, 0.28), matStone);
    frameTop.position.set(0, height + 0.1, 0.04);
    frameTop.castShadow = true;
    group.add(frameTop);

    // Folha de madeira da porta
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.1), matDoor);
    doorMesh.position.set(0, height / 2, 0);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;
    group.add(doorMesh);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + height / 2, z, width + 0.2, height, 0.3);
    }
    return group;
  }

  /**
   * Arco de pedra clássico do CS Italy conectando dois edifícios através do beco
   */
  addStoneArchway(x, y, z, span = 7.0, height = 5.2, thickness = 1.2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matStone = materialFactory.get('stone');
    const pillarWidth = 1.1;

    // Pilar Esquerdo
    const pL = new THREE.Mesh(new THREE.BoxGeometry(pillarWidth, height, thickness), matStone);
    pL.position.set(-span / 2 + pillarWidth / 2, height / 2, 0);
    pL.castShadow = true;
    pL.receiveShadow = true;
    group.add(pL);

    // Pilar Direito
    const pR = pL.clone();
    pR.position.x = span / 2 - pillarWidth / 2;
    group.add(pR);

    // Viga/Arco Superior
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(span, 1.2, thickness), matStone);
    topBeam.position.set(0, height + 0.6, 0);
    topBeam.castShadow = true;
    topBeam.receiveShadow = true;
    group.add(topBeam);

    // Chanfros angulares do arco
    const wedgeGeo = new THREE.BoxGeometry(1.2, 0.9, thickness);
    const wL = new THREE.Mesh(wedgeGeo, matStone);
    wL.position.set(-span / 2 + pillarWidth + 0.35, height - 0.2, 0);
    wL.rotation.z = Math.PI * 0.25;
    wL.castShadow = true;
    group.add(wL);

    const wR = wL.clone();
    wR.position.x = span / 2 - pillarWidth - 0.35;
    wR.rotation.z = -Math.PI * 0.25;
    group.add(wR);

    this.scene.add(group);

    if (this.world) {
      // Colisão para os dois pilares laterais (passagem livre por baixo)
      this.world.addBox(x - span / 2 + pillarWidth / 2, y + height / 2, z, pillarWidth, height, thickness);
      this.world.addBox(x + span / 2 - pillarWidth / 2, y + height / 2, z, pillarWidth, height, thickness);
      this.world.addBox(x, y + height + 0.6, z, span, 1.2, thickness);
    }
    return group;
  }

  /**
   * Sacada/Varanda italiana com laje de pedra e grade de ferro forjado
   */
  addBalcony(x, y, z, width = 3.5, depth = 1.2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matStone = materialFactory.get('stone');
    const matIron = materialFactory.get('iron_grill');

    // Laje de pedra
    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), matStone);
    slab.position.set(0, 0, depth / 2);
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);

    // Mísulas decorativas embaixo da sacada
    const corbelGeo = new THREE.BoxGeometry(0.35, 0.7, depth * 0.8);
    const c1 = new THREE.Mesh(corbelGeo, matStone);
    c1.position.set(-width * 0.35, -0.45, depth * 0.45);
    c1.castShadow = true;
    group.add(c1);

    const c2 = c1.clone();
    c2.position.x = width * 0.35;
    group.add(c2);

    // Grade frontal de ferro
    const railH = 1.0;
    const railFront = new THREE.Mesh(new THREE.BoxGeometry(width, railH, 0.08), matIron);
    railFront.position.set(0, railH / 2 + 0.15, depth);
    railFront.castShadow = true;
    group.add(railFront);

    // Grades laterais
    const railSideL = new THREE.Mesh(new THREE.BoxGeometry(0.08, railH, depth), matIron);
    railSideL.position.set(-width / 2, railH / 2 + 0.15, depth / 2);
    railSideL.castShadow = true;
    group.add(railSideL);

    const railSideR = railSideL.clone();
    railSideR.position.x = width / 2;
    group.add(railSideR);

    // Vasos de terracota na sacada com flores
    const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.35, 8);
    const matTerra = materialFactory.get('wall_peeling_terra');
    const pot1 = new THREE.Mesh(potGeo, matTerra);
    pot1.position.set(-width * 0.3, 0.35, depth * 0.75);
    group.add(pot1);

    const pot2 = pot1.clone();
    pot2.position.x = width * 0.3;
    group.add(pot2);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y, z + depth / 2, width, 0.3, depth);
    }
    return group;
  }

  /**
   * Folhagem de trepadeira/hera (Ivy) aplicada sobre a parede com canal alfa
   */
  addIvyPatch(x, y, z, rotY = 0, width = 2.4, height = 3.6) {
    const matIvy = materialFactory.get('ivy_foliage');
    const geo = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geo, matIvy);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Barril de vinho de carvalho com anéis de ferro
   */
  addWineBarrel(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matBarrel = materialFactory.get('wine_barrel');
    const radius = 0.45 * scale;
    const height = 1.15 * scale;

    // Geometria de barril abaulado
    const barrelGeo = new THREE.CylinderGeometry(radius * 0.88, radius * 0.88, height, 16);
    const barrelMesh = new THREE.Mesh(barrelGeo, matBarrel);
    barrelMesh.position.set(0, height / 2, 0);
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;
    group.add(barrelMesh);

    // Bojo central mais largo
    const midRingGeo = new THREE.CylinderGeometry(radius, radius, height * 0.45, 16);
    const midMesh = new THREE.Mesh(midRingGeo, matBarrel);
    midMesh.position.set(0, height / 2, 0);
    midMesh.castShadow = true;
    group.add(midMesh);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + height / 2, z, radius * 2, height, radius * 2);
    }
    return group;
  }

  /**
   * Caixote de vinho de madeira empilhável com carimbo
   */
  addWineCrate(x, y, z, rotY = 0, sx = 1.2, sy = 1.0, sz = 1.2) {
    const matCrate = materialFactory.get('crate');
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, matCrate);
    mesh.position.set(x, y + sy / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (this.world) {
      this.world.addBox(x, y + sy / 2, z, sx, sy, sz, { vaultable: true });
    }
    return mesh;
  }

  /**
   * Barraca de mercado com toldo listrado vermelho e branco
   */
  addMarketStall(x, y, z, rotY = 0, width = 3.2, depth = 2.2, height = 2.6) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matWood = materialFactory.get('crate');
    const matAwning = materialFactory.get('awning_red');

    // 4 Postes de sustentação de madeira
    const postGeo = new THREE.BoxGeometry(0.12, height, 0.12);
    const corners = [
      [-width / 2 + 0.1, -depth / 2 + 0.1],
      [ width / 2 - 0.1, -depth / 2 + 0.1],
      [-width / 2 + 0.1,  depth / 2 - 0.1],
      [ width / 2 - 0.1,  depth / 2 - 0.1],
    ];

    for (const [cx, cz] of corners) {
      const post = new THREE.Mesh(postGeo, matWood);
      post.position.set(cx, height / 2, cz);
      post.castShadow = true;
      group.add(post);
    }

    // Bancada de madeira para mercadorias
    const counterGeo = new THREE.BoxGeometry(width - 0.2, 0.9, depth - 0.4);
    const counter = new THREE.Mesh(counterGeo, matWood);
    counter.position.set(0, 0.45, 0);
    counter.castShadow = true;
    counter.receiveShadow = true;
    group.add(counter);

    // Toldo listrado inclinado (Awning)
    const awningGeo = new THREE.PlaneGeometry(width + 0.4, depth + 0.5);
    const awningMesh = new THREE.Mesh(awningGeo, matAwning);
    awningMesh.position.set(0, height + 0.1, 0.1);
    awningMesh.rotation.x = Math.PI * 0.45; // Leve inclinação para escoar chuva
    awningMesh.castShadow = true;
    awningMesh.receiveShadow = true;
    group.add(awningMesh);

    // Caixotes e barris em volta da banca
    this.addWineCrate(x + 0.5, y + 0.9, z, rotY + 0.1, 0.8, 0.6, 0.8);
    this.addWineBarrel(x - width / 2 - 0.5, y, z, 0.9);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + 0.45, z, width, 0.9, depth);
    }
    return group;
  }

  /**
   * Lanterna de ferro forjado de parede com luz pontual quente
   */
  addStreetLantern(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matIron = materialFactory.get('iron_grill');

    // Haste de suporte
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.45), matIron);
    arm.position.set(0, 0, 0.22);
    arm.castShadow = true;
    group.add(arm);

    // Corpo da lanterna
    const lanternGeo = new THREE.CylinderGeometry(0.12, 0.08, 0.35, 6);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffd999,
      emissive: 0xffa033,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });
    const lantern = new THREE.Mesh(lanternGeo, lanternMat);
    lantern.position.set(0, -0.15, 0.45);
    group.add(lantern);

    // Ponto de luz quente iluminando a parede e o chão ao redor
    const light = new THREE.PointLight(0xffb866, 1.2, 8, 1.8);
    light.position.set(0, -0.15, 0.45);
    group.add(light);

    this.scene.add(group);
    return group;
  }

  /**
   * PAREDE DE TESTE & MOSTRUÁRIO DE TEXTURAS (Material Showcase Wall)
   * Área interativa onde o jogador pode inspecionar de perto cada textura criada!
   */
  addTextureShowcaseWall(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const showcaseMaterials = [
      { id: 'wall_peeling_ochre', title: '1. OCRE DESCASCADO' },
      { id: 'cobblestones',        title: '2. COBBLESTONES' },
      { id: 'door_wood',           title: '3. MADEIRA RÚSTICA' },
      { id: 'roof',                title: '4. TELHAS TERRACOTA' },
      { id: 'window_shutter',      title: '5. VENEZIANA VERDE' },
      { id: 'ivy_foliage',         title: '6. HERA (ALPHA)' },
      { id: 'wine_barrel',         title: '7. BARRIL CARVALHO' },
      { id: 'crate',               title: '8. CAIXOTE VINHO' },
      { id: 'awning_red',          title: '9. TOLDO LISTRADO' },
      { id: 'stone',               title: '10. PEDRA ARCO' }
    ];

    const wallW = showcaseMaterials.length * 1.6 + 1.0;
    const wallH = 3.6;

    // Parede estrutural do mostruário
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallW, wallH, 0.6),
      materialFactory.get('stone')
    );
    backWall.position.set(0, wallH / 2, -0.3);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    // Painéis de demonstração
    showcaseMaterials.forEach((item, index) => {
      const px = -wallW / 2 + 1.2 + index * 1.6;

      // Moldura de pedra do painel
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.5, 0.12),
        materialFactory.get('stone')
      );
      frame.position.set(px, 1.9, 0.05);
      frame.castShadow = true;
      group.add(frame);

      // Mostruário da textura (placa)
      const sampleMat = materialFactory.get(item.id);
      const sample = new THREE.Mesh(
        new THREE.PlaneGeometry(1.0, 1.3),
        sampleMat
      );
      sample.position.set(px, 1.9, 0.12);
      sample.castShadow = true;
      sample.receiveShadow = true;
      group.add(sample);

      // Esfera 3D na frente para ver a curvatura e reflexos PBR da textura
      const sphereMat = sampleMat.clone();
      sphereMat.transparent = false; // esfera sólida
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 24, 24),
        sphereMat
      );
      sphere.position.set(px, 0.7, 0.35);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      group.add(sphere);

      // Pedestal para a esfera
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.25, 0.45, 12),
        materialFactory.get('stone')
      );
      ped.position.set(px, 0.22, 0.35);
      ped.castShadow = true;
      group.add(ped);
    });

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + wallH / 2, z, wallW, wallH, 0.8);
    }
    return group;
  }

  // =========================================================================
  // PROPS DA VILA ENSOLARADA (Village Elements)
  // =========================================================================

  /**
   * Árvore 3D da vila com tronco de carvalho e copa de folhagem recortada com alfa
   */
  addVillageTree(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matTrunk = materialFactory.get('trunk');
    const matFoliage = materialFactory.get('foliage');

    const trunkH = 3.8 * scale;
    const trunkR = 0.45 * scale;

    // Tronco principal
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.75, trunkR, trunkH, 12);
    const trunkMesh = new THREE.Mesh(trunkGeo, matTrunk);
    trunkMesh.position.set(0, trunkH / 2, 0);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    group.add(trunkMesh);

    // Copa em 3 níveis esferoidais orgânicos
    const tiers = [
      { y: trunkH * 0.75, rX: 2.2 * scale, rY: 1.4 * scale, rZ: 2.2 * scale },
      { y: trunkH * 1.1,  rX: 1.8 * scale, rY: 1.3 * scale, rZ: 1.8 * scale },
      { y: trunkH * 1.45, rX: 1.3 * scale, rY: 1.1 * scale, rZ: 1.3 * scale },
    ];

    for (const t of tiers) {
      const folGeo = new THREE.SphereGeometry(1, 14, 12);
      const folMesh = new THREE.Mesh(folGeo, matFoliage);
      folMesh.position.set(0, t.y, 0);
      folMesh.scale.set(t.rX, t.rY, t.rZ);
      folMesh.castShadow = true;
      folMesh.receiveShadow = true;
      group.add(folMesh);
    }

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + trunkH / 2, z, trunkR * 2, trunkH, trunkR * 2);
    }
    return group;
  }

  /**
   * Cerca rústica de madeira da vila com postes e travessas horizontais
   */
  addRusticFence(x, y, z, rotY = 0, length = 5.0, height = 1.1) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matWood = materialFactory.get('wood');
    const numPosts = Math.max(2, Math.floor(length / 1.8) + 1);
    const step = length / (numPosts - 1);

    // Postes verticais
    const postGeo = new THREE.BoxGeometry(0.14, height, 0.14);
    for (let i = 0; i < numPosts; i++) {
      const px = -length / 2 + i * step;
      const post = new THREE.Mesh(postGeo, matWood);
      post.position.set(px, height / 2, 0);
      post.castShadow = true;
      group.add(post);
    }

    // Travessas horizontais
    const railGeo = new THREE.BoxGeometry(length, 0.10, 0.08);
    const rail1 = new THREE.Mesh(railGeo, matWood);
    rail1.position.set(0, height * 0.35, 0);
    rail1.castShadow = true;
    group.add(rail1);

    const rail2 = rail1.clone();
    rail2.position.y = height * 0.78;
    group.add(rail2);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + height / 2, z, length, height, 0.3, { vaultable: true });
    }
    return group;
  }

  /**
   * Poço d'água da praça central da vila
   */
  addVillageWell(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matStone = materialFactory.get('stone');
    const matWood = materialFactory.get('wood');
    const matRoof = materialFactory.get('roof');

    // Parede de pedra circular do poço
    const wallGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.9, 16, 1, true);
    const wall = new THREE.Mesh(wallGeo, matStone);
    wall.position.set(0, 0.45, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Superfície da água escura no fundo
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a3340, roughness: 0.1, metalness: 0.8 });
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.35, 16), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.3, 0);
    group.add(water);

    // 2 Postes de madeira do telhadinho
    const postGeo = new THREE.BoxGeometry(0.12, 2.2, 0.12);
    const p1 = new THREE.Mesh(postGeo, matWood);
    p1.position.set(-1.1, 1.1, 0);
    p1.castShadow = true;
    group.add(p1);

    const p2 = p1.clone();
    p2.position.x = 1.1;
    group.add(p2);

    // Telhado de telhas sobre o poço
    const roofGeo = new THREE.ConeGeometry(1.6, 0.9, 4);
    const roof = new THREE.Mesh(roofGeo, matRoof);
    roof.position.set(0, 2.4, 0);
    roof.rotation.y = Math.PI * 0.25;
    roof.castShadow = true;
    group.add(roof);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + 0.45, z, 2.8, 0.9, 2.8, { vaultable: true });
    }
    return group;
  }

  /**
   * Chaminé de pedra para telhados
   */
  addChimney(x, y, z, height = 1.8) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matStone = materialFactory.get('stone');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.8), matStone);
    mesh.position.set(0, height / 2, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Aba superior
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 1.0), matStone);
    cap.position.set(0, height + 0.08, 0);
    cap.castShadow = true;
    group.add(cap);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + height / 2, z, 0.8, height, 0.8);
    }
    return group;
  }

  /**
   * Fardos de feno rústicos da fazenda
   */
  addHayBale(x, y, z, rotY = 0) {
    const matDirt = materialFactory.get('dirt');
    const hayMat = new THREE.MeshStandardMaterial({ color: 0xc49d47, roughness: 0.95 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12), hayMat);
    mesh.position.set(x, y + 0.7, z);
    mesh.rotation.z = Math.PI * 0.5;
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (this.world) {
      this.world.addBox(x, y + 0.7, z, 1.4, 1.4, 1.4, { vaultable: true });
    }
    return mesh;
  }

  // =========================================================================
  // PROPS DO MAPA DUST MIRAGE (Desert Middle-Eastern Elements)
  // =========================================================================

  /**
   * Palmeira do deserto estilo CS:GO Mirage com tronco anelado, colar fibroso,
   * cachos de tâmaras e coroa volumosa de 22 folhas arqueadas em 3 camadas (Tiers)
   */
  addPalmTree(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matTrunk = materialFactory.get('palm_trunk');
    const matFrond = materialFactory.get('palm_frond');

    const trunkH = 6.6 * scale;
    const trunkR = 0.36 * scale;
    const trunkTilt = -0.055;

    // 1. Tronco principal orgânico com leve inclinação de deserto
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.68, trunkR, trunkH, 12);
    const trunk = new THREE.Mesh(trunkGeo, matTrunk);
    const topX = 0.42 * scale;
    const topY = trunkH;
    const topZ = 0;
    trunk.position.set(topX * 0.5, trunkH / 2, topZ);
    trunk.rotation.z = trunkTilt;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 2. Colar fibroso / coroa na ponta do tronco (nódulo de junção das folhas)
    const crownGeo = new THREE.CylinderGeometry(trunkR * 1.08, trunkR * 0.72, 0.42 * scale, 12);
    const crownMesh = new THREE.Mesh(crownGeo, matTrunk);
    crownMesh.position.set(topX, topY - 0.12 * scale, topZ);
    crownMesh.rotation.z = trunkTilt;
    crownMesh.castShadow = true;
    group.add(crownMesh);

    // 3. Cachos de tâmaras do deserto (Date fruit clusters em dourado/laranja sob a copa)
    const dateMat = new THREE.MeshStandardMaterial({ color: 0xba6e2a, roughness: 0.75 });
    const numDateClusters = 3;
    for (let c = 0; c < numDateClusters; c++) {
      const cAng = (c / numDateClusters) * Math.PI * 2 + 0.35;
      const cDist = 0.34 * scale;
      const cx = topX + Math.sin(cAng) * cDist;
      const cz = topZ + Math.cos(cAng) * cDist;
      const cy = topY - 0.32 * scale;

      const cluster = new THREE.Group();
      cluster.position.set(cx, cy, cz);
      const sphereGeo = new THREE.SphereGeometry(0.11 * scale, 6, 6);
      for (let s = 0; s < 5; s++) {
        const berry = new THREE.Mesh(sphereGeo, dateMat);
        berry.position.set(
          Math.sin(s * 1.9) * (0.10 * scale),
          -s * (0.07 * scale),
          Math.cos(s * 1.9) * (0.10 * scale)
        );
        berry.castShadow = true;
        cluster.add(berry);
      }
      group.add(cluster);
    }

    // Função interna para criar geometria de folha com pivô na base e curvatura gravitacional em V
    const createCurvedFrondGeometry = (w, len, droop, vFold = 0.16) => {
      const geo = new THREE.PlaneGeometry(w, len, 2, 7);
      // Pivô na base para que a folha inteira se projete a partir do tronco
      geo.translate(0, len / 2, 0);

      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const lx = pos.getX(i);
        const ly = pos.getY(i);
        const t = Math.max(0, Math.min(1, ly / len));

        // Arqueamento progressivo sob gravidade
        const curve = Math.pow(t, 2.1) * droop;
        // Dobra em V das pínulas
        const sideDist = Math.abs(lx) / (w * 0.5);
        const fold = sideDist * (vFold * w);

        pos.setZ(i, -curve + fold);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // 4. Coroa de 22 folhas exuberantes em 3 Tiers (camadas sobrepostas)
    const tiers = [
      // Camada Alta: 6 folhas jovens apontando para cima e arqueando levemente
      {
        count: 6,
        width: 2.3 * scale,
        length: 4.6 * scale,
        droop: 1.1 * scale,
        tilt: 0.18,
        offsetAng: 0,
        heightOffset: 0.12 * scale
      },
      // Camada Média: 8 folhas adultas grandes da copa principal abrindo em arco
      {
        count: 8,
        width: 2.7 * scale,
        length: 5.4 * scale,
        droop: 1.7 * scale,
        tilt: 0.52,
        offsetAng: Math.PI / 8,
        heightOffset: 0.0
      },
      // Camada Baixa: 8 folhas maduras caídas pendendo graciosamente ao redor do tronco
      {
        count: 8,
        width: 2.4 * scale,
        length: 4.9 * scale,
        droop: 2.3 * scale,
        tilt: 0.94,
        offsetAng: Math.PI / 16,
        heightOffset: -0.15 * scale
      }
    ];

    for (const tier of tiers) {
      const geo = createCurvedFrondGeometry(tier.width, tier.length, tier.droop);
      for (let i = 0; i < tier.count; i++) {
        const ang = (i / tier.count) * Math.PI * 2 + tier.offsetAng;
        const frond = new THREE.Mesh(geo, matFrond);
        frond.position.set(topX, topY + tier.heightOffset, topZ);
        frond.rotation.y = ang;
        frond.rotation.x = tier.tilt;
        frond.rotation.z = Math.sin(i * 1.7) * 0.08; // Quebra de simetria natural
        frond.castShadow = true;
        frond.receiveShadow = true;
        group.add(frond);
      }
    }

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + trunkH / 2, z, trunkR * 2, trunkH, trunkR * 2);
    }
    return group;
  }

  /**
   * Arco Árabe do Oriente Médio (Mirage Palace & A-Site Arch)
   */
  addArabicArch(x, y, z, span = 6.5, height = 4.8, thickness = 1.2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matSandstone = materialFactory.get('sandstone');
    const pillarW = 1.1;

    // Pilar esquerdo e direito
    const pL = new THREE.Mesh(new THREE.BoxGeometry(pillarW, height, thickness), matSandstone);
    pL.position.set(-span / 2 + pillarW / 2, height / 2, 0);
    pL.castShadow = true;
    pL.receiveShadow = true;
    group.add(pL);

    const pR = pL.clone();
    pR.position.x = span / 2 - pillarW / 2;
    group.add(pR);

    // Lintel superior
    const top = new THREE.Mesh(new THREE.BoxGeometry(span, 1.1, thickness), matSandstone);
    top.position.set(0, height + 0.55, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // Chanfros pontiagudos de arco árabe
    const cL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, thickness), matSandstone);
    cL.position.set(-span / 2 + pillarW + 0.3, height - 0.25, 0);
    cL.rotation.z = Math.PI * 0.28;
    cL.castShadow = true;
    group.add(cL);

    const cR = cL.clone();
    cR.position.x = span / 2 - pillarW - 0.3;
    cR.rotation.z = -Math.PI * 0.28;
    group.add(cR);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x - span / 2 + pillarW / 2, y + height / 2, z, pillarW, height, thickness);
      this.world.addBox(x + span / 2 - pillarW / 2, y + height / 2, z, pillarW, height, thickness);
      this.world.addBox(x, y + height + 0.55, z, span, 1.1, thickness);
    }
    return group;
  }

  /**
   * Tapete / Tecido Árabe decorativo pendurado em paredes de bazar
   */
  addArabicRugWall(x, y, z, rotY = 0, width = 2.4, height = 3.2, isGreen = false) {
    const matRug = isGreen ? materialFactory.get('fabric_green') : materialFactory.get('fabric_red');
    const geo = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geo, matRug);
    mesh.position.set(x, y + height / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Caixote militar tático de suprimentos
   */
  addMilitaryCrate(x, y, z, rotY = 0, sx = 1.4, sy = 1.2, sz = 1.4) {
    const matMil = materialFactory.get('military_crate');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), matMil);
    mesh.position.set(x, y + sy / 2, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (this.world) {
      this.world.addBox(x, y + sy / 2, z, sx, sy, sz, { vaultable: true });
    }
    return mesh;
  }

  /**
   * Barril de óleo industrial com marcas inflamáveis
   */
  addOilBarrel(x, y, z, scale = 1.0) {
    const matOil = materialFactory.get('oil_barrel');
    const r = 0.42 * scale;
    const h = 1.15 * scale;
    const geo = new THREE.CylinderGeometry(r, r, h, 14);
    const mesh = new THREE.Mesh(geo, matOil);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (this.world) {
      this.world.addBox(x, y + h / 2, z, r * 2, h, r * 2);
    }
    return mesh;
  }

  /**
   * Lona azul de sombra esticada (Desert Sun Tarp)
   */
  addDesertTarp(x, y, z, rotY = 0, width = 4.2, depth = 3.2) {
    const matTarp = materialFactory.get('blue_tarp');
    const geo = new THREE.PlaneGeometry(width, depth);
    const mesh = new THREE.Mesh(geo, matTarp);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.rotation.x = Math.PI * 0.45;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  /**
   * Caixa d'água metálica cilíndrica de teto desértico
   */
  addWaterTank(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matMetal = materialFactory.get('scaffold') || new THREE.MeshStandardMaterial({ color: 0x9099a2, metalness: 0.8, roughness: 0.4 });
    const tankR = 0.9 * scale;
    const tankH = 1.6 * scale;

    // Tanque
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 14), matMetal);
    tank.position.set(0, 0.5 + tankH / 2, 0);
    tank.castShadow = true;
    group.add(tank);

    // Suporte de pernas de ferro
    const legGeo = new THREE.BoxGeometry(0.08, 0.5, 0.08);
    for (const [lx, lz] of [[-tankR*0.7, -tankR*0.7], [tankR*0.7, -tankR*0.7], [-tankR*0.7, tankR*0.7], [tankR*0.7, tankR*0.7]]) {
      const leg = new THREE.Mesh(legGeo, matMetal);
      leg.position.set(lx, 0.25, lz);
      group.add(leg);
    }

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + (tankH + 0.5) / 2, z, tankR * 2, tankH + 0.5, tankR * 2);
    }
    return group;
  }

  // =========================================================================
  // PROPS DO MAPA WOODS (Bosque & Selva Tropical Semi-Aberta)
  // =========================================================================

  /**
   * Árvore tropical gigante com raízes tabulares (Sapopembas) e copa massiva
   */
  addGiantJungleTree(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matBark = materialFactory.get('jungle_bark');
    const matFern = materialFactory.get('jungle_fern');

    const trunkH = 14.0 * scale;
    const trunkR = 0.85 * scale;

    // Tronco principal massivo
    const trunkGeo = new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 10);
    const trunk = new THREE.Mesh(trunkGeo, matBark);
    trunk.position.set(0, trunkH / 2, 0);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 4 Raízes tabulares (Sapopembas) em cruz na base para cobertura tática
    const buttressAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    const rootLen = 2.8 * scale;
    const rootH = 3.6 * scale;
    const rootThick = 0.35 * scale;

    for (const ang of buttressAngles) {
      const rootGeo = new THREE.BoxGeometry(rootThick, rootH, rootLen);
      const rootMesh = new THREE.Mesh(rootGeo, matBark);
      // Desloca para fora do tronco
      const dist = trunkR * 0.7 + rootLen * 0.45;
      rootMesh.position.set(Math.sin(ang) * dist, rootH * 0.45, Math.cos(ang) * dist);
      rootMesh.rotation.y = ang;
      rootMesh.rotation.x = -0.12; // Inclinada em direção ao chão
      rootMesh.castShadow = true;
      rootMesh.receiveShadow = true;
      group.add(rootMesh);

      if (this.world) {
        const wx = x + Math.sin(ang) * dist;
        const wz = z + Math.cos(ang) * dist;
        this.world.addBox(wx, y + rootH * 0.45, wz, rootThick + 0.3, rootH * 0.9, rootLen * 0.8, { vaultable: true });
      }
    }

    // Copa gigante de folhagens em camadas sobrepostas
    const tiers = [
      { y: trunkH * 0.72, spread: 8.0 * scale, height: 4.5 * scale },
      { y: trunkH * 0.88, spread: 10.0 * scale, height: 5.0 * scale },
      { y: trunkH * 1.02, spread: 7.5 * scale, height: 4.0 * scale },
    ];

    for (const tier of tiers) {
      const numFronds = 6;
      for (let i = 0; i < numFronds; i++) {
        const fAng = (i / numFronds) * Math.PI * 2 + (tier.y * 0.5);
        const frondGeo = new THREE.PlaneGeometry(tier.spread * 0.6, tier.height);
        const frond = new THREE.Mesh(frondGeo, matFern);
        frond.position.set(Math.sin(fAng) * (tier.spread * 0.3), tier.y, Math.cos(fAng) * (tier.spread * 0.3));
        frond.rotation.y = fAng;
        frond.rotation.x = Math.PI * 0.35; // Leque inclinado para fora
        frond.castShadow = true;
        frond.receiveShadow = true;
        group.add(frond);
      }
    }

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + trunkH / 2, z, trunkR * 2.2, trunkH, trunkR * 2.2);
    }
    return group;
  }

  /**
   * Tronco caído de árvore gigante coberto de musgo (Fallen Deadwood Log)
   */
  addFallenLog(x, y, z, rotY = 0, length = 7.5, radius = 0.6) {
    const group = new THREE.Group();
    group.position.set(x, y + radius * 0.8, z);
    group.rotation.y = rotY;

    const matBark = materialFactory.get('jungle_bark');
    const logGeo = new THREE.CylinderGeometry(radius * 0.85, radius, length, 10);
    const logMesh = new THREE.Mesh(logGeo, matBark);
    logMesh.rotation.z = Math.PI * 0.5; // Deitado horizontalmente
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    group.add(logMesh);

    this.scene.add(group);
    if (this.world) {
      // Caixa de colisão transponível
      this.world.addBox(x, y + radius * 0.8, z, length, radius * 1.8, radius * 2, { vaultable: true });
    }
    return group;
  }

  /**
   * Arbusto denso de samambaias tropicais com leques cruzados (Fern Bush)
   */
  addFernCluster(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matFern = materialFactory.get('jungle_fern');
    const numCards = 5;
    const cardW = 2.2 * scale;
    const cardH = 1.8 * scale;

    for (let i = 0; i < numCards; i++) {
      const ang = (i / numCards) * Math.PI;
      const cardGeo = new THREE.PlaneGeometry(cardW, cardH);
      const card = new THREE.Mesh(cardGeo, matFern);
      card.position.set(0, cardH * 0.45, 0);
      card.rotation.y = ang;
      card.rotation.x = 0.15; // Leve inclinação natural
      card.castShadow = true;
      card.receiveShadow = true;
      group.add(card);
    }

    this.scene.add(group);
    return group;
  }

  /**
   * Bosque denso de bambu selvagem com múltiplos colmos (Bamboo Thicket)
   */
  addBambooGrove(x, y, z, count = 8, radius = 1.6, height = 7.5) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matBamboo = materialFactory.get('bamboo');
    const matFern = materialFactory.get('jungle_fern');

    for (let i = 0; i < count; i++) {
      const bAng = (i / count) * Math.PI * 2 + (i * 0.7);
      const bDist = 0.3 + (i / count) * radius * 0.8;
      const bx = Math.sin(bAng) * bDist;
      const bz = Math.cos(bAng) * bDist;
      const bH = height * (0.85 + (i % 3) * 0.12);
      const bR = 0.08 + (i % 2) * 0.03;

      const culm = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR * 1.2, bH, 8), matBamboo);
      culm.position.set(bx, bH / 2, bz);
      culm.castShadow = true;
      culm.receiveShadow = true;
      group.add(culm);

      // Tufo de folhas no topo de cada vara
      const topLeaves = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), matFern);
      topLeaves.position.set(bx, bH, bz);
      topLeaves.rotation.y = bAng;
      topLeaves.rotation.x = 0.4;
      topLeaves.castShadow = true;
      group.add(topLeaves);
    }

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + height / 2, z, radius * 2, height, radius * 2);
    }
    return group;
  }

  /**
   * Posição defensiva / Bunker em 'U' de sacos de areia (Sandbag Fortification)
   */
  addSandbagBunker(x, y, z, rotY = 0, width = 4.2, depth = 3.2, height = 1.25) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matSand = materialFactory.get('sandbags');
    const thick = 0.65;

    // Parapeito Frontal
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(width, height, thick), matSand);
    frontWall.position.set(0, height / 2, -depth / 2 + thick / 2);
    frontWall.castShadow = true;
    frontWall.receiveShadow = true;
    group.add(frontWall);

    // Flanco Esquerdo
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(thick, height, depth - thick), matSand);
    leftWall.position.set(-width / 2 + thick / 2, height / 2, thick / 2);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);

    // Flanco Direito
    const rightWall = leftWall.clone();
    rightWall.position.x = width / 2 - thick / 2;
    group.add(rightWall);

    this.scene.add(group);
    if (this.world) {
      // Colisão para os 3 parapeitos com flag transponível
      this.world.addBox(x, y + height / 2, z, width, height, depth, { vaultable: true });
    }
    return group;
  }

  /**
   * Torre de observação militar de madeira sobre estacas (Jungle Watchtower)
   */
  addJungleWatchtower(x, y, z, height = 6.2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const matWood = materialFactory.get('wood');
    const matIron = materialFactory.get('iron_grill');
    const matRoof = materialFactory.get('corrugated_iron');

    const stiltSpan = 3.4;
    const postGeo = new THREE.BoxGeometry(0.24, height, 0.24);

    // 4 Estacas verticais nos cantos
    const corners = [
      [-stiltSpan / 2, -stiltSpan / 2],
      [stiltSpan / 2, -stiltSpan / 2],
      [-stiltSpan / 2, stiltSpan / 2],
      [stiltSpan / 2, stiltSpan / 2],
    ];

    for (const [cx, cz] of corners) {
      const post = new THREE.Mesh(postGeo, matWood);
      post.position.set(cx, height / 2, cz);
      post.castShadow = true;
      group.add(post);
    }

    // Travessas de suporte horizontal
    const beamGeoX = new THREE.BoxGeometry(stiltSpan, 0.16, 0.16);
    const beamGeoZ = new THREE.BoxGeometry(0.16, 0.16, stiltSpan);
    const bY = height * 0.48;

    const bX1 = new THREE.Mesh(beamGeoX, matWood);
    bX1.position.set(0, bY, -stiltSpan / 2);
    group.add(bX1);

    const bX2 = bX1.clone();
    bX2.position.z = stiltSpan / 2;
    group.add(bX2);

    const bZ1 = new THREE.Mesh(beamGeoZ, matWood);
    bZ1.position.set(-stiltSpan / 2, bY, 0);
    group.add(bZ1);

    const bZ2 = bZ1.clone();
    bZ2.position.x = stiltSpan / 2;
    group.add(bZ2);

    // Plataforma do piso da guarita
    const platY = height - 1.2;
    const platGeo = new THREE.BoxGeometry(stiltSpan + 0.4, 0.2, stiltSpan + 0.4);
    const plat = new THREE.Mesh(platGeo, matWood);
    plat.position.set(0, platY, 0);
    plat.castShadow = true;
    plat.receiveShadow = true;
    group.add(plat);

    // Guarda-corpo / Grade de ferro de proteção
    const railH = 1.0;
    const rFront = new THREE.Mesh(new THREE.BoxGeometry(stiltSpan + 0.4, railH, 0.08), matIron);
    rFront.position.set(0, platY + railH / 2 + 0.1, stiltSpan / 2 + 0.2);
    group.add(rFront);

    const rBack = rFront.clone();
    rBack.position.z = -stiltSpan / 2 - 0.2;
    group.add(rBack);

    const rLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, railH, stiltSpan + 0.4), matIron);
    rLeft.position.set(-stiltSpan / 2 - 0.2, platY + railH / 2 + 0.1, 0);
    group.add(rLeft);

    const rRight = rLeft.clone();
    rRight.position.x = stiltSpan / 2 + 0.2;
    group.add(rRight);

    // Telhado de zinco ondulado sobre 4 pequenos pilaretes
    const roofY = height + 1.2;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(stiltSpan + 0.8, 0.12, stiltSpan + 0.8), matRoof);
    roof.position.set(0, roofY, 0);
    roof.castShadow = true;
    group.add(roof);

    this.scene.add(group);
    if (this.world) {
      // Piso sólido caminhável no topo da torre
      this.world.addBox(x, y + platY, z, stiltSpan + 0.4, 0.25, stiltSpan + 0.4);
      // Colisão para as 4 pernas de sustentação
      for (const [cx, cz] of corners) {
        this.world.addBox(x + cx, y + height / 2, z + cz, 0.35, height, 0.35);
      }
    }
    return group;
  }

  /**
   * Ruínas de templo antigo de pedra cobertas de musgo e hera (Ancient Jungle Ruins)
   */
  addAncientRuins(x, y, z, rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matRock = materialFactory.get('mossy_rock');
    const matFern = materialFactory.get('jungle_fern');

    // 4 Pilares monolíticos ancestrais
    const pillarH = 4.8;
    const pillarW = 1.2;
    const positions = [
      [-3.2, -3.2],
      [3.2, -3.2],
      [-3.2, 3.2],
      [3.2, 3.2],
    ];

    for (const [px, pz] of positions) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(pillarW, pillarH, pillarW), matRock);
      pillar.position.set(px, pillarH / 2, pz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);

      // Hera/samambaia agarrada ao pilar
      const vine = new THREE.Mesh(new THREE.PlaneGeometry(pillarW * 0.9, pillarH * 0.7), matFern);
      vine.position.set(px, pillarH * 0.5, pz + pillarW * 0.52);
      vine.castShadow = true;
      group.add(vine);

      if (this.world) {
        this.world.addBox(x + px, y + pillarH / 2, z + pz, pillarW, pillarH, pillarW);
      }
    }

    // Lintel caído e quebrado sobre dois pilares
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.8, 1.2), matRock);
    lintel.position.set(0, pillarH + 0.4, -3.2);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);

    // Altar cerimonial de pedra no centro das ruínas
    const altar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.8), matRock);
    altar.position.set(0, 0.5, 0);
    altar.castShadow = true;
    altar.receiveShadow = true;
    group.add(altar);

    // Muretas de pedra baixas e derruídas nos flancos
    const wallLow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 4.2), matRock);
    wallLow.position.set(-3.2, 0.55, 0);
    wallLow.castShadow = true;
    wallLow.receiveShadow = true;
    group.add(wallLow);

    this.scene.add(group);
    if (this.world) {
      this.world.addBox(x, y + 0.5, z, 2.6, 1.0, 1.8, { vaultable: true });
      this.world.addBox(x - 3.2, y + 0.55, z, 0.8, 1.1, 4.2, { vaultable: true });
    }
    return group;
  }

  /**
   * Tenda / Posto de comando tático com lona camuflada (Military Camo Tent)
   */
  addMilitaryCamoTent(x, y, z, rotY = 0, width = 5.2, length = 7.0, height = 3.2) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matCamo = materialFactory.get('camo_tarp');
    const matWood = materialFactory.get('wood');

    // Postes de madeira da estrutura
    const postGeo = new THREE.BoxGeometry(0.14, height, 0.14);
    const pFront = new THREE.Mesh(postGeo, matWood);
    pFront.position.set(0, height / 2, length / 2);
    group.add(pFront);

    const pBack = pFront.clone();
    pBack.position.z = -length / 2;
    group.add(pBack);

    // Viga mestra central no cume
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, length), matWood);
    ridge.position.set(0, height, 0);
    group.add(ridge);

    // 2 Águas do teto inclinado de lona camuflada
    const slopeW = Math.sqrt((width / 2) ** 2 + height ** 2);
    const slopeAngle = Math.atan2(height, width / 2);

    const roofGeo = new THREE.PlaneGeometry(slopeW, length);
    const roofL = new THREE.Mesh(roofGeo, matCamo);
    roofL.position.set(-width / 4, height / 2, 0);
    roofL.rotation.y = Math.PI * 0.5;
    roofL.rotation.x = -slopeAngle;
    roofL.castShadow = true;
    roofL.receiveShadow = true;
    group.add(roofL);

    const roofR = new THREE.Mesh(roofGeo, matCamo);
    roofR.position.set(width / 4, height / 2, 0);
    roofR.rotation.y = Math.PI * 0.5;
    roofR.rotation.x = slopeAngle;
    roofR.castShadow = true;
    roofR.receiveShadow = true;
    group.add(roofR);

    this.scene.add(group);
    if (this.world) {
      // Cobertura sólida nas laterais da tenda
      this.world.addBox(x - width / 2 + 0.3, y + height / 2, z, 0.6, height, length);
      this.world.addBox(x + width / 2 - 0.3, y + height / 2, z, 0.6, height, length);
    }
    return group;
  }

  /**
   * Monólito / Rocha gigante com musgo (Mossy Boulder)
   */
  addMossyBoulder(x, y, z, sx = 2.8, sy = 2.0, sz = 2.5, rotY = 0) {
    const matRock = materialFactory.get('mossy_rock');
    const geo = new THREE.DodecahedronGeometry(1.0, 1);
    const mesh = new THREE.Mesh(geo, matRock);
    mesh.position.set(x, y + sy * 0.45, z);
    mesh.scale.set(sx * 0.55, sy * 0.55, sz * 0.55);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    if (this.world) {
      this.world.addBox(x, y + sy * 0.45, z, sx, sy * 0.9, sz, { vaultable: true });
    }
    return mesh;
  }


  // =========================================================================
  // PROPS DO ESTANDE DE TIRO (RANGE FACELIFT)
  // =========================================================================

  /**
   * Suporte de madeira com alvo de papel militar e anéis concêntricos
   */
  addPaperTarget(x, y, z, rotY = 0, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matWood = materialFactory.get('wood');
    const matTarget = materialFactory.get('target');

    // 1. Mourões verticais de madeira (2x4)
    const legGeo = new THREE.BoxGeometry(0.06 * scale, 1.8 * scale, 0.06 * scale);
    const legL = new THREE.Mesh(legGeo, matWood);
    legL.position.set(-0.35 * scale, 0.9 * scale, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, matWood);
    legR.position.set(0.35 * scale, 0.9 * scale, 0);
    legR.castShadow = true;
    group.add(legR);

    // 2. Travessas e sapatas de base no chão (H-base)
    const footGeo = new THREE.BoxGeometry(0.06 * scale, 0.06 * scale, 0.65 * scale);
    const footL = new THREE.Mesh(footGeo, matWood);
    footL.position.set(-0.35 * scale, 0.03 * scale, 0);
    footL.castShadow = true;
    group.add(footL);

    const footR = new THREE.Mesh(footGeo, matWood);
    footR.position.set(0.35 * scale, 0.03 * scale, 0);
    footR.castShadow = true;
    group.add(footR);

    // 3. Placa de sustentação de papelão/compensado
    const boardW = 0.88 * scale;
    const boardH = 1.25 * scale;
    const boardGeo = new THREE.BoxGeometry(boardW, boardH, 0.02 * scale);
    const board = new THREE.Mesh(boardGeo, matWood);
    board.position.set(0, 1.25 * scale, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);

    // 4. Folha de alvo frontal com textura concêntrica (virada para +Z)
    const paperGeo = new THREE.PlaneGeometry(boardW * 0.98, boardH * 0.98);
    const paperFront = new THREE.Mesh(paperGeo, matTarget);
    paperFront.position.set(0, 1.25 * scale, 0.012 * scale);
    paperFront.receiveShadow = true;
    group.add(paperFront);

    // 5. Folha de alvo traseira (virada para -Z)
    const paperBack = new THREE.Mesh(paperGeo, matTarget);
    paperBack.position.set(0, 1.25 * scale, -0.012 * scale);
    paperBack.rotation.y = Math.PI;
    paperBack.receiveShadow = true;
    group.add(paperBack);

    this.scene.add(group);

    if (this.world) {
      this.world.addBox(x, y + 1.25 * scale, z, boardW, boardH, 0.22 * scale, {
        material: 'target',
        isTarget: true
      });
    }

    return group;
  }

  /**
   * Alvo pendular de plinker (gongo metálico em cavalete que balança e emite PLIINNNG)
   */
  addPlinkerTarget(x, y, z, rotY = 0, plateRadius = 0.28, frameHeight = 1.75) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matSteel = materialFactory.get('scaffold');
    const matPlinker = materialFactory.get('plinker');

    // 1. Armação de cavalete em A (tubos de aço)
    const legLen = frameHeight / Math.cos(0.24);
    const legGeo = new THREE.CylinderGeometry(0.028, 0.028, legLen, 8);

    const legFL = new THREE.Mesh(legGeo, matSteel);
    legFL.position.set(-0.48, frameHeight * 0.5, 0.24);
    legFL.rotation.z = 0.22;
    legFL.rotation.x = -0.24;
    legFL.castShadow = true;
    group.add(legFL);

    const legFR = new THREE.Mesh(legGeo, matSteel);
    legFR.position.set(0.48, frameHeight * 0.5, 0.24);
    legFR.rotation.z = -0.22;
    legFR.rotation.x = -0.24;
    legFR.castShadow = true;
    group.add(legFR);

    const legBL = new THREE.Mesh(legGeo, matSteel);
    legBL.position.set(-0.48, frameHeight * 0.5, -0.24);
    legBL.rotation.z = 0.22;
    legBL.rotation.x = 0.24;
    legBL.castShadow = true;
    group.add(legBL);

    const legBR = new THREE.Mesh(legGeo, matSteel);
    legBR.position.set(0.48, frameHeight * 0.5, -0.24);
    legBR.rotation.z = -0.22;
    legBR.rotation.x = 0.24;
    legBR.castShadow = true;
    group.add(legBR);

    // Barra superior horizontal do pivô
    const barGeo = new THREE.CylinderGeometry(0.038, 0.038, 1.15, 10);
    barGeo.rotateZ(Math.PI / 2);
    const topBar = new THREE.Mesh(barGeo, matSteel);
    topBar.position.set(0, frameHeight, 0);
    topBar.castShadow = true;
    group.add(topBar);

    // 2. Montagem Balançante Suspensa no Pivô (Eixo no topo em frameHeight)
    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(0, frameHeight, 0);
    group.add(pivotGroup);

    // Hastes/correntes de suspensão
    const armLen = frameHeight * 0.56;
    const armGeo = new THREE.BoxGeometry(0.022, armLen, 0.015);

    const armL = new THREE.Mesh(armGeo, matSteel);
    armL.position.set(-plateRadius * 0.6, -armLen * 0.5, 0);
    armL.castShadow = true;
    pivotGroup.add(armL);

    const armR = new THREE.Mesh(armGeo, matSteel);
    armR.position.set(plateRadius * 0.6, -armLen * 0.5, 0);
    armR.castShadow = true;
    pivotGroup.add(armR);

    // Chapa circular do gongo de aço
    const gongGeo = new THREE.CylinderGeometry(plateRadius, plateRadius, 0.028, 24);
    gongGeo.rotateX(Math.PI / 2);
    const gongMesh = new THREE.Mesh(gongGeo, matPlinker);
    gongMesh.position.set(0, -armLen, 0);
    gongMesh.castShadow = true;
    gongMesh.receiveShadow = true;
    pivotGroup.add(gongMesh);

    // Centro bullseye em vermelho escarlate vivo
    const dotGeo = new THREE.CylinderGeometry(plateRadius * 0.38, plateRadius * 0.38, 0.032, 20);
    dotGeo.rotateX(Math.PI / 2);
    const matDot = new THREE.MeshStandardMaterial({
      color: 0xd32f2f,
      roughness: 0.38,
      metalness: 0.60
    });
    const dotMesh = new THREE.Mesh(dotGeo, matDot);
    dotMesh.position.set(0, -armLen, 0.002);
    pivotGroup.add(dotMesh);

    this.scene.add(group);

    const worldPlateY = y + frameHeight - armLen;

    // 3. Colisor no CollisionWorld
    let colBox = null;
    if (this.world) {
      colBox = this.world.addBox(x, worldPlateY, z, plateRadius * 2.1, plateRadius * 2.1, 0.28, {
        material: 'plinker',
        isPlinker: true
      });
    }

    // 4. Controlador de Física Pendular do Plinker
    const plinker = {
      group,
      pivotGroup,
      box: colBox,
      pos: new THREE.Vector3(x, worldPlateY, z),
      angle: 0,
      angularVel: 0,
      hit(e) {
        const dmg = e?.weapon?.ballistics?.terminal?.damage || 35;
        const kick = Math.min(13.5, 3.2 + dmg * 0.14);
        this.angularVel -= kick;
      },
      update(dt) {
        if (Math.abs(this.angle) < 0.0005 && Math.abs(this.angularVel) < 0.002) {
          if (this.angle !== 0 || this.angularVel !== 0) {
            this.angle = 0;
            this.angularVel = 0;
            this.pivotGroup.rotation.x = 0;
          }
          return;
        }

        const omegaSq = 32.0; // torque restaurador da gravidade
        const damping = 3.2;  // atrito viscoso nos rolamentos
        const accel = -omegaSq * Math.sin(this.angle) - damping * this.angularVel;

        this.angularVel += accel * dt;
        this.angle += this.angularVel * dt;

        if (this.angle < -2.9) {
          this.angle = -2.9;
          this.angularVel = -this.angularVel * 0.35;
        } else if (this.angle > 2.9) {
          this.angle = 2.9;
          this.angularVel = -this.angularVel * 0.35;
        }

        this.pivotGroup.rotation.x = this.angle;
      },
      destroy() {
        if (this._unsub) {
          this._unsub();
          this._unsub = null;
        }
      }
    };

    if (colBox) {
      colBox.meta.plinker = plinker;
    }

    plinker._unsub = on('shot:world', e => {
      if (e?.box === plinker.box || e?.box?.meta?.plinker === plinker) {
        plinker.hit(e);
      }
    });

    this.plinkers.push(plinker);
    return plinker;
  }

  /**
   * Bancada de tiro com divisórias de baia acústica
   */
  addShootingBench(x, y, z, rotY = 0, width = 2.4, depth = 0.9, height = 0.95) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matWood = materialFactory.get('wood');
    const matSteel = materialFactory.get('scaffold');

    // Tampo da bancada
    const topGeo = new THREE.BoxGeometry(width, 0.08, depth);
    const topMesh = new THREE.Mesh(topGeo, matWood);
    topMesh.position.set(0, height, 0);
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    group.add(topMesh);

    // 4 pernas tubulares de aço
    const legGeo = new THREE.CylinderGeometry(0.035, 0.035, height, 8);
    const px = width * 0.44;
    const pz = depth * 0.40;
    const offsets = [
      [-px, pz], [px, pz],
      [-px, -pz], [px, -pz]
    ];
    for (const [ox, oz] of offsets) {
      const leg = new THREE.Mesh(legGeo, matSteel);
      leg.position.set(ox, height * 0.5, oz);
      leg.castShadow = true;
      group.add(leg);
    }

    // Divisória lateral de baia (Sound Baffle Partition)
    const baffleGeo = new THREE.BoxGeometry(0.06, 1.6, depth * 1.1);
    const baffleMesh = new THREE.Mesh(baffleGeo, matWood);
    baffleMesh.position.set(width * 0.5, height + 0.8, 0);
    baffleMesh.castShadow = true;
    group.add(baffleMesh);

    this.scene.add(group);

    if (this.world) {
      this.world.addBox(x, y + height * 0.5, z, width, height, depth, {
        material: 'wood',
        vaultable: true
      });
    }

    return group;
  }

  /**
   * Placa de marcação de distância (ex: 10m, 25m, 50m, 75m)
   */
  /** =========================================================================
   * PROPS ESPECIALIZADOS DE FAVELA (Labirinto, Vielas, Lajes e Telhados)
   * ========================================================================= */

  /**
   * Antenas de TV de laje (UHF espinha de peixe ou antena parabólica com prato)
   */
  addFavelaAntenna(x, y, z, rotY = 0, scale = 1.0, type = 'uhf') {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matMetal = new THREE.MeshStandardMaterial({
      color: 0xa0a5ab,
      metalness: 0.85,
      roughness: 0.35
    });

    // Mastro principal de fixação
    const mastH = 2.4 * scale;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.035 * scale, mastH, 8), matMetal);
    mast.position.set(0, mastH / 2, 0);
    mast.castShadow = true;
    group.add(mast);

    if (type === 'dish') {
      // Antena Parabólica de laje
      const dishR = 0.65 * scale;
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(dishR, dishR * 0.9, 0.05 * scale, 16), matMetal);
      dish.position.set(0, mastH - 0.15 * scale, 0.25 * scale);
      dish.rotation.x = -Math.PI / 4; // Inclinada para o céu
      dish.castShadow = true;
      group.add(dish);

      // Haste do LNB receptor
      const lnb = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * scale, 0.015 * scale, 0.55 * scale, 6), matMetal);
      lnb.position.set(0, mastH + 0.1 * scale, 0.45 * scale);
      lnb.rotation.x = Math.PI / 4;
      group.add(lnb);
    } else {
      // Antena UHF Espinha de Peixe clássica brasileira
      const boomLen = 1.4 * scale;
      const boom = new THREE.Mesh(new THREE.BoxGeometry(0.03 * scale, 0.03 * scale, boomLen), matMetal);
      boom.position.set(0, mastH - 0.1 * scale, boomLen / 2);
      boom.castShadow = true;
      group.add(boom);

      // Varetas transversais decrescentes
      const elements = 6;
      for (let i = 0; i < elements; i++) {
        const elemW = (0.75 - i * 0.08) * scale;
        const elemZ = (i / (elements - 1)) * (boomLen * 0.9) + 0.05 * scale;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * scale, 0.012 * scale, elemW, 6), matMetal);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, mastH - 0.1 * scale, elemZ);
        bar.castShadow = true;
        group.add(bar);
      }
    }

    if (this.world) {
      this.world.addBox(x, y + 0.45, z, 0.4, 0.9, 0.4, { vaultable: true });
    }

    this.scene.add(group);
    return group;
  }

  /**
   * Fiação elétrica aérea e cabos pretos suspensos cruzando o beco
   */
  addOverheadWires(x1, y1, z1, x2, y2, z2, sag = 0.35, cableCount = 3) {
    const group = new THREE.Group();
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x141517 });

    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.5) return group;

    // Vetor perpendicular horizontal para espalhar os fios
    const perpX = -dz / dist;
    const perpZ = dx / dist;

    for (let c = 0; c < cableCount; c++) {
      const offset = (c - (cableCount - 1) * 0.5) * 0.16;
      const p1 = new THREE.Vector3(x1 + perpX * offset, y1 - c * 0.08, z1 + perpZ * offset);
      const p2 = new THREE.Vector3(x2 + perpX * offset, y2 - c * 0.08, z2 + perpZ * offset);
      const mid = new THREE.Vector3(
        (p1.x + p2.x) * 0.5,
        (p1.y + p2.y) * 0.5 - sag * (1.0 + c * 0.15),
        (p1.z + p2.z) * 0.5
      );

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const tubeGeo = new THREE.TubeGeometry(curve, 8, 0.018, 4, false);
      const wireMesh = new THREE.Mesh(tubeGeo, wireMat);
      group.add(wireMesh);
    }

    this.scene.add(group);
    return group;
  }

  /**
   * Poste de concreto de viela com cruzeta, isoladores e transformador ("gatos")
   */
  addUtilityPole(x, y, z, rotY = 0, height = 7.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matPole = materialFactory.get('concrete') || new THREE.MeshStandardMaterial({ color: 0x888b90, roughness: 0.9 });
    const matWood = materialFactory.get('wood') || new THREE.MeshStandardMaterial({ color: 0x4a321f });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x2e3338, metalness: 0.8, roughness: 0.4 });

    // 1. Coluna de concreto do poste
    const poleGeo = new THREE.BoxGeometry(0.38, height, 0.38);
    const poleMesh = new THREE.Mesh(poleGeo, matPole);
    poleMesh.position.set(0, height / 2, 0);
    poleMesh.castShadow = true;
    group.add(poleMesh);

    // 2. Cruzeta horizontal superior
    const armGeo = new THREE.BoxGeometry(2.2, 0.14, 0.14);
    const armMesh = new THREE.Mesh(armGeo, matWood);
    armMesh.position.set(0, height - 0.35, 0);
    armMesh.castShadow = true;
    group.add(armMesh);

    // 3. 4 isoladores de cerâmica
    const insMat = new THREE.MeshStandardMaterial({ color: 0x2b4f3b, roughness: 0.3 });
    const insPositions = [-0.85, -0.3, 0.3, 0.85];
    for (const ip of insPositions) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 8), insMat);
      ins.position.set(ip, height - 0.22, 0);
      group.add(ins);
    }

    // 4. Transformador de energia em balanço
    const trafo = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.55), matMetal);
    trafo.position.set(0, height - 2.5, 0.42);
    trafo.castShadow = true;
    group.add(trafo);

    if (this.world) {
      this.world.addBox(x, y + height / 2, z, 0.5, height, 0.5);
    }

    this.scene.add(group);
    return group;
  }

  /**
   * A autêntica caixa d'água azul brasileira (polietileno 1000L com tampa e anéis)
   */
  addFavelaWaterTank(x, y, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x0c4ea2, // Azul escuro royal característico
      roughness: 0.42,
      metalness: 0.12
    });

    const tankH = 1.35 * scale;
    const tankRTop = 0.85 * scale;
    const tankRBot = 0.72 * scale;

    // Corpo cilíndrico cônico da caixa
    const tankGeo = new THREE.CylinderGeometry(tankRTop, tankRBot, tankH, 16);
    const tankMesh = new THREE.Mesh(tankGeo, tankMat);
    tankMesh.position.set(0, tankH / 2, 0);
    tankMesh.castShadow = true;
    group.add(tankMesh);

    // Tampa sobreposta cônica
    const lidH = 0.22 * scale;
    const lidGeo = new THREE.CylinderGeometry(0.15 * scale, tankRTop + 0.05 * scale, lidH, 16);
    const lidMesh = new THREE.Mesh(lidGeo, tankMat);
    lidMesh.position.set(0, tankH + lidH / 2, 0);
    lidMesh.castShadow = true;
    group.add(lidMesh);

    // Anéis de reforço
    const ringGeo = new THREE.TorusGeometry(tankRTop * 0.94, 0.025 * scale, 6, 20);
    const ring1 = new THREE.Mesh(ringGeo, tankMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.set(0, tankH * 0.4, 0);
    group.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, tankMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.set(0, tankH * 0.75, 0);
    group.add(ring2);

    if (this.world) {
      this.world.addBox(x, y + (tankH + lidH) / 2, z, tankRTop * 2, tankH + lidH, tankRTop * 2, { vaultable: true });
    }

    this.scene.add(group);
    return group;
  }

  /**
   * Escada de alvenaria/concreto para acesso transitável a lajes e pisos superiores
   */
  addFavelaStairs(x, y, z, rotY = 0, steps = 8, width = 1.2, stepHeight = 0.35, stepDepth = 0.45, withHandrail = true) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matSlab = materialFactory.get('favela_concrete_slab') || materialFactory.get('concrete');
    const matRail = materialFactory.get('iron_grill');

    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);

    for (let i = 0; i < steps; i++) {
      const localZ = i * stepDepth + stepDepth / 2;
      const localY = i * stepHeight + stepHeight / 2;

      const stepGeo = new THREE.BoxGeometry(width, stepHeight, stepDepth);
      const stepMesh = new THREE.Mesh(stepGeo, matSlab);
      stepMesh.position.set(0, localY, localZ);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);

      // Colisão para o player caminhar (stepHeight <= 0.4m permite subir sem travar)
      if (this.world) {
        const wx = x + (-sin * localZ);
        const wz = z + (cos * localZ);
        const wy = y + localY;
        if (Math.abs(sin) > 0.7) {
          this.world.addBox(wx, wy, wz, stepDepth, stepHeight, width);
        } else {
          this.world.addBox(wx, wy, wz, width, stepHeight, stepDepth);
        }
      }
    }

    if (withHandrail) {
      const totalZ = steps * stepDepth;
      const totalY = steps * stepHeight;
      const railGeo = new THREE.BoxGeometry(0.06, 0.06, totalZ * 1.05);
      const railMesh = new THREE.Mesh(railGeo, matRail);
      railMesh.position.set(width / 2, totalY / 2 + 0.9, totalZ / 2);
      railMesh.rotation.x = Math.atan2(totalY, totalZ);
      group.add(railMesh);
    }

    this.scene.add(group);
    return group;
  }

  addDistanceSign(x, y, z, text = "25m", rotY = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;

    const matWood = materialFactory.get('wood');
    const legGeo = new THREE.BoxGeometry(0.06, 1.2, 0.06);
    const leg = new THREE.Mesh(legGeo, matWood);
    leg.position.set(0, 0.6, 0);
    leg.castShadow = true;
    group.add(leg);

    // Placa amarela de trânsito/militar com texto preto
    const { canvas, ctx } = TextureGenerator.createCanvas(256, 128);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, 256, 128);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#111111';
    ctx.strokeRect(4, 4, 248, 120);

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 56px "Oswald", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);

    const tex = TextureGenerator.toTexture(canvas, true);
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.6,
      metalness: 0.1
    });

    const signGeo = new THREE.BoxGeometry(0.8, 0.45, 0.03);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 1.15, 0);
    signMesh.castShadow = true;
    group.add(signMesh);

    this.scene.add(group);
    return group;
  }
}
