import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import createCharacter from '../src/view/models/TacticalManContinuous.js';
import { ViewmodelArms } from '../src/weapons/ViewmodelArms.js';
import { CharacterView } from '../src/view/CharacterView.js';

describe('Tactic Man Continuous & Viewmodel Arms Integration', () => {

  it('TacticalManContinuous cria modelo com juntas completas, colete, botas e cabeça', () => {
    const model = createCharacter(THREE);

    assert.ok(model, 'Modelo deve ser criado com sucesso');
    assert.ok(model.userData.joints, 'Modelo deve conter dicionário de joints');

    const joints = model.userData.joints;
    assert.ok(joints.pelvis, 'Rig deve conter pelvis');
    assert.ok(joints.chest, 'Rig deve conter chest');
    assert.ok(joints.neck, 'Rig deve conter neck');
    assert.ok(joints.head, 'Rig deve conter head');
    assert.ok(joints.shoulderLeft && joints.upperArmLeft && joints.elbowLeft && joints.forearmLeft && joints.handLeft, 'Braço esquerdo completo');
    assert.ok(joints.shoulderRight && joints.upperArmRight && joints.elbowRight && joints.forearmRight && joints.handRight, 'Braço direito completo');
    assert.ok(joints.hipLeft && joints.thighLeft && joints.kneeLeft && joints.shinLeft && joints.footLeft, 'Perna esquerda completa');
    assert.ok(joints.hipRight && joints.thighRight && joints.kneeRight && joints.shinRight && joints.footRight, 'Perna direita completa');

    // Validação da malha da face e do tronco
    const headFace = joints.head.getObjectByName('tactical_head_face');
    const torsoMesh = joints.chest.getObjectByName('combat_shirt_torso_mesh');
    assert.ok(headFace, 'tactical_head_face deve existir na cabeça');
    assert.ok(torsoMesh, 'combat_shirt_torso_mesh deve existir no tronco');
  });

  it('ViewmodelArms instancia braços táticos 1ª pessoa, alinha empunhadura e suporta modo 1 mão', () => {
    const mount = new THREE.Group();
    const arms = new ViewmodelArms(mount);

    assert.ok(arms.root, 'ViewmodelArms deve ter root adicionado ao mount');
    assert.ok(arms.leftArm.hand, 'Mão esquerda deve existir');
    assert.ok(arms.rightArm.hand, 'Mão direita deve existir');

    // Bulbos de ombro devem estar ocultos para evitar clipagem na tela
    const bulbL = arms.leftArm.shoulder.getObjectByName('shoulder_bulb_Left');
    const bulbR = arms.rightArm.shoulder.getObjectByName('shoulder_bulb_Right');
    assert.strictEqual(bulbL?.visible, false, 'Bulbo de ombro esquerdo deve estar oculto em 1ª pessoa');
    assert.strictEqual(bulbR?.visible, false, 'Bulbo de ombro direito deve estar oculto em 1ª pessoa');

    const twoHandWeapons = ['ar15', 'hk416', 'ak47', 'scar_h', 'rifle_proto', 'm249', 'vss', 'uzi', 'm12'];
    for (const wId of twoHandWeapons) {
      arms.setWeapon(wId);
      arms.update(wId, { isADS: false, isSprinting: false, reloadProgress: 0 });
      assert.strictEqual(arms.leftArm.shoulder.visible, true, `Arma ${wId} deve ter braço esquerdo visível (2 mãos)`);
      assert.ok(arms.rightArm.shoulder.position.y < 0, `Ombro direito deve estar abaixo do corte`);

      // Testa animação de recarga dip
      arms.update(wId, { isADS: false, isSprinting: false, reloadProgress: 0.5 });
      assert.ok(arms.leftArm.shoulder.position.y < -0.38, 'Braço esquerdo deve abaixar durante o reload dip');
    }

    // Pistolas e revólveres (1 mão só)
    const oneHandWeapons = ['p9', 'sw500'];
    for (const wId of oneHandWeapons) {
      arms.setWeapon(wId);
      arms.update(wId, { isADS: false, isSprinting: false, reloadProgress: 0 });
      assert.strictEqual(arms.leftArm.shoulder.visible, false, `Arma ${wId} deve ter braço esquerdo oculto (1 mão só)`);
      assert.strictEqual(arms.rightArm.shoulder.visible, true, `Arma ${wId} deve ter braço direito ativo`);
    }

    arms.destroy();
  });

  it('Winchester Model 1912: mão esquerda tem IK travado na calha e acompanha ciclo de recarga e disparo', () => {
    const mount = new THREE.Group();
    const gunGroup = new THREE.Group();
    mount.add(gunGroup);

    const pumpHandle = new THREE.Group();
    pumpHandle.position.set(0, 0.005, -0.240);
    gunGroup.add(pumpHandle);

    const arms = new ViewmodelArms(mount);
    arms.setWeapon('m12');

    // 1. Em repouso (calha em posição inicial)
    arms.update('m12', { isADS: false, isSprinting: false, reloadProgress: 0, pumpHandle });
    
    // Obtém a posição do pulso calculada no espaço do mount
    const initialWristZ = arms.leftArm.hand.parent.getWorldPosition(new THREE.Vector3());
    mount.worldToLocal(initialWristZ);

    assert.ok(initialWristZ.z < -0.18 && initialWristZ.z > -0.22, `Pulso deve estar na base da calha (esperado ~ -0.202, obteve ${initialWristZ.z})`);

    // 2. Ciclo de Bombeamento / Recarga: calha recua 8cm (+0.08 along Z)
    pumpHandle.position.z = -0.240 + 0.08;
    arms.update('m12', { isADS: false, isSprinting: false, reloadProgress: 0.5, pumpHandle });

    const pumpedWristZ = arms.leftArm.hand.parent.getWorldPosition(new THREE.Vector3());
    mount.worldToLocal(pumpedWristZ);

    const deltaZ = pumpedWristZ.z - initialWristZ.z;
    assert.ok(Math.abs(deltaZ - 0.08) < 0.005, `Pulso deve recuar exatamente com a calha (+0.08m, obteve delta de ${deltaZ.toFixed(4)}m)`);

    // 3. Durante reloadProgress com calha, a mão não faz dip no ar; o pulso permanece acoplado à calha
    assert.ok(pumpedWristZ.y > -0.10, `Mão deve permanecer na calha durante reload e não despencar para o colete (y=${pumpedWristZ.y})`);

    // 4. Retorno da calha (Forward)
    pumpHandle.position.z = -0.240;
    arms.update('m12', { isADS: false, isSprinting: false, reloadProgress: 1.0, pumpHandle });

    const restoredWristZ = arms.leftArm.hand.parent.getWorldPosition(new THREE.Vector3());
    mount.worldToLocal(restoredWristZ);
    assert.ok(Math.abs(restoredWristZ.z - initialWristZ.z) < 0.001, 'Pulso deve retornar exatamente à posição inicial com a calha fechada');

    arms.destroy();
  });

  it('CharacterView instancia soldado tático contínuo, fuzil em mãos e expõe head e body para hittables()', () => {
    const mockScene = new THREE.Scene();
    const mockBots = [];

    for (let id = 1; id <= 3; id++) {
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
      assert.ok(view.gunGroup, `Bot ${id} deve conter a arma de 3ª pessoa`);

      assert.strictEqual(view.head.userData.part, 'head');
      assert.strictEqual(view.body.userData.part, 'body');

      // Simula update de renderização
      view.update(0.016);
      assert.ok(view.root.position.x === id * 2, 'Posição do root deve acompanhar a entidade');

      mockBots.push(view);
    }

    mockBots.forEach(b => b.destroy());
  });

});
