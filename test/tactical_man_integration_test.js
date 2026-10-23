import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { createTacticalCharacter, TACTICAL_PALETTES, getSharedGeometries } from '../src/view/models/TacticalManModel.js';
import { ViewmodelArms } from '../src/weapons/ViewmodelArms.js';
import { CharacterView } from '../src/view/CharacterView.js';

describe('Tactic Man Continuous & Viewmodel Arms Integration', () => {

  it('TacticalManModel compila geometrias compartilhadas e instancia 5 paletas e 5 variantes de cabeça', () => {
    const geos = getSharedGeometries(THREE);
    assert.ok(geos.torsoGeo, 'torsoGeo deve existir no cache');
    assert.ok(geos.headGeo, 'headGeo deve existir no cache');
    assert.ok(geos.helmetGeo, 'helmetGeo deve existir no cache');
    assert.ok(geos.goggleFrameGeo, 'goggleFrameGeo deve existir no cache');
    assert.ok(geos.balaclavaGeo, 'balaclavaGeo deve existir no cache');

    // Testa as 5 paletas com as 5 variantes
    for (let i = 0; i < 5; i++) {
      const mockChar = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), alive: true };
      const model = createTacticalCharacter(THREE, {
        paletteIndex: i,
        headVariant: i,
        character: mockChar
      });

      assert.ok(model.root, `Modelo da variante ${i} deve possuir root`);
      assert.ok(model.head, `Modelo da variante ${i} deve possuir head`);
      assert.ok(model.chest, `Modelo da variante ${i} deve possuir chest`);
      assert.ok(model.pelvis, `Modelo da variante ${i} deve possuir pelvis`);

      // Validação do rig canônico de juntas
      const joints = model.joints;
      assert.ok(joints.pelvis, 'Rig deve conter pelvis');
      assert.ok(joints.chest, 'Rig deve conter chest');
      assert.ok(joints.neck, 'Rig deve conter neck');
      assert.ok(joints.head, 'Rig deve conter head');
      assert.ok(joints.shoulderLeft && joints.upperArmLeft && joints.elbowLeft && joints.forearmLeft && joints.handLeft, 'Braço esquerdo completo');
      assert.ok(joints.shoulderRight && joints.upperArmRight && joints.elbowRight && joints.forearmRight && joints.handRight, 'Braço direito completo');
      assert.ok(joints.hipLeft && joints.thighLeft && joints.kneeLeft && joints.shinLeft && joints.footLeft, 'Perna esquerda completa');
      assert.ok(joints.hipRight && joints.thighRight && joints.kneeRight && joints.shinRight && joints.footRight, 'Perna direita completa');

      // Validação de hitboxes para disparos
      assert.strictEqual(model.headMesh.userData.part, 'head', 'headMesh deve ser tagged como part head');
      assert.strictEqual(model.torsoMesh.userData.part, 'body', 'torsoMesh deve ser tagged como part body');
    }
  });

  it('ViewmodelArms instancia braços táticos 1ª pessoa e resolve poses para as 10 armas', () => {
    const mount = new THREE.Group();
    const arms = new ViewmodelArms(mount);

    assert.ok(arms.root, 'ViewmodelArms deve ter root adicionado ao mount');
    assert.ok(arms.leftArm.hand, 'Mão esquerda deve existir');
    assert.ok(arms.rightArm.hand, 'Mão direita deve existir');

    const weapons = ['ar15', 'hk416', 'ak47', 'scar_h', 'rifle_proto', 'm249', 'vss', 'uzi', 'm12', 'p9', 'sw500'];
    for (const wId of weapons) {
      arms.setWeapon(wId);
      arms.update(wId, { isADS: false, isSprinting: false, reloadProgress: 0 });
      assert.ok(arms.leftArm.shoulder.position.y < 0, `Ombro esquerdo deve estar posicionado para ${wId}`);
      assert.ok(arms.rightArm.shoulder.position.y < 0, `Ombro direito deve estar posicionado para ${wId}`);

      // Testa pose em ADS
      arms.update(wId, { isADS: true, isSprinting: false, reloadProgress: 0 });

      // Testa animação de recarga
      arms.update(wId, { isADS: false, isSprinting: false, reloadProgress: 0.5 });
      assert.ok(arms.leftArm.shoulder.position.y < -0.25, 'Braço esquerdo deve abaixar durante o reload dip');
    }

    arms.destroy();
  });

  it('CharacterView instancia bots com variações de cabeças e expõe head e body para hittables()', () => {
    const mockScene = new THREE.Scene();
    const mockBots = [];

    for (let id = 1; id <= 5; id++) {
      const mockChar = {
        pos: new THREE.Vector3(id * 2, 0, 0),
        vel: new THREE.Vector3(0, 0, 0),
        alive: true,
        yaw: 0,
        pitch: 0,
        lean: 0
      };

      const view = new CharacterView(mockChar, mockScene, { id, skinType: 'soldier' });
      assert.ok(view.tactical, `Bot ${id} deve usar o modelo tático contínuo`);
      assert.ok(view.head, `Bot ${id} deve expor view.head`);
      assert.ok(view.body, `Bot ${id} deve expor view.body`);

      assert.strictEqual(view.head.userData.part, 'head');
      assert.strictEqual(view.body.userData.part, 'body');

      // Simula update de renderização
      view.update(0.016);
      assert.ok(view.root.position.x === id * 2, 'Posição do root deve acompanhar a entidade');

      mockBots.push(view);
    }

    // Limpeza
    mockBots.forEach(b => b.destroy());
  });

});
