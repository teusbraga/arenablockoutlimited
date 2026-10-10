import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Player } from '../src/entities/Player.js';
import { CameraRig } from '../src/core/CameraRig.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';

describe('Player Third Person Perspective & Blocky Soldier Integration', () => {
  const world = new CollisionWorld();
  world.addBox(0, 0, 0, 100, 1, 100, { material: 'floor' });

  it('Player inicia em 1ª pessoa por padrão (view invisível)', () => {
    const player = new Player(world, [-50, 50, -50, 50], [0, 1, 0]);
    assert.strictEqual(player.isThirdPerson(), false, 'Deve iniciar em 1ª pessoa');
    assert.strictEqual(player.rig.perspective, 'first');
    assert.strictEqual(player.rig.thirdPersonAmount, 0);
    player.destroy();
  });

  it('Alternar perspectiva com togglePerspective altera modo e rig', () => {
    const player = new Player(world, [-50, 50, -50, 50], [0, 1, 0]);
    
    // Toggle para 3ª pessoa
    const mode1 = player.togglePerspective();
    assert.strictEqual(mode1, 'third');
    assert.strictEqual(player.isThirdPerson(), true);
    assert.strictEqual(player.rig.perspective, 'third');

    // Toggle de volta para 1ª pessoa
    const mode2 = player.togglePerspective();
    assert.strictEqual(mode2, 'first');
    assert.strictEqual(player.isThirdPerson(), false);
    assert.strictEqual(player.rig.perspective, 'first');
    
    player.destroy();
  });

  it('CameraRig interpola suavemente e calcula offset over-the-shoulder em 3ª pessoa', () => {
    const player = new Player(world, [-50, 50, -50, 50], [0, 1, 0]);
    player.togglePerspective(); // ativa 3rd person
    
    const mockCamera = {
      position: { copy: () => {} },
      rotation: { order: 'YXZ', x: 0, y: 0, z: 0 }
    };

    // Posição inicial da câmera em 1ª pessoa
    player.updateCamera(mockCamera, 0.016);
    const p1 = player.rig.position.clone ? player.rig.position.clone() : { ...player.rig.position };

    // Simula 10 frames de transição para 3ª pessoa
    for (let i = 0; i < 20; i++) {
      player.updateCamera(mockCamera, 0.033);
    }

    assert.ok(player.rig.thirdPersonAmount > 0.8, 'thirdPersonAmount deve ter aproximado de 1.0');
    // Em 3ª pessoa com yaw=0 e pitch=0, a câmera deve recuar em +Z (atrás do jogador)
    assert.ok(player.rig.position.z > p1.z + 1.0, 'Câmera em 3ª pessoa deve recuar para trás do jogador');
    assert.ok(player.rig.position.x > p1.x + 0.2, 'Câmera em 3ª pessoa deve ter offset táctico over-the-shoulder à direita');

    player.destroy();
  });

  it('Spring Arm: Câmera detecta parede atrás e encurta a distância para não clipar', () => {
    const smallWorld = new CollisionWorld();
    // Parede imediatamente atrás do player em Z = 1.0m (jogador em Z = 0)
    smallWorld.addBox(0, 1.5, 1.0, 10, 3, 0.5, { solid: true });

    const player = new Player(smallWorld, [-50, 50, -50, 50], [0, 1, 0]);
    player.togglePerspective();

    const mockCamera = {
      position: { copy: () => {} },
      rotation: { order: 'YXZ', x: 0, y: 0, z: 0 }
    };

    // Atualiza por alguns frames com colisão ativa
    for (let i = 0; i < 25; i++) {
      player.updateCamera(mockCamera, 0.033);
    }

    // A distância padrão é 2.4m, mas como há uma parede a ~1.0m, o spring arm deve encurtar
    assert.ok(player.rig.tpSmoothDist < 1.3, `Spring arm deve limitar distância (atual: ${player.rig.tpSmoothDist})`);
    
    player.destroy();
  });
});
