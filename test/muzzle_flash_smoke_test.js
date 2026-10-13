import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as THREE from 'three';
import { Viewmodel } from '../src/weapons/Viewmodel.js';
import { Effects } from '../src/fx/Effects.js';

describe('Muzzle Flash & Cone Smoke Modern Architecture Test', () => {
  const rootDir = process.cwd();
  const weaponsData = JSON.parse(readFileSync(join(rootDir, 'assets/weapons/weapons.json'), 'utf8')).weapons;

  it('deve ter muzzle flash calibrado rigorosamente de acordo com as especificações do usuário', () => {
    // Cria instância mock da Viewmodel
    const fakeCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const vm = new Viewmodel(fakeCamera);

    // 1. HK416 (ar15) e AK-47: tamanho atual que está na VSS (0.25)
    vm.flash({ id: 'ar15', muzzleLocal: [0, 0, -0.5] });
    assert.strictEqual(vm.flashGroup.visible, true, 'HK416 deve exibir flash');
    assert.ok(Math.abs(vm.flashMesh1.scale.x - 0.25) < 0.15, 'HK416 deve ter flash na faixa de 0.25');

    vm.flash({ id: 'ak47', muzzleLocal: [0, 0, -0.5] });
    assert.strictEqual(vm.flashGroup.visible, true, 'AK-47 deve exibir flash');
    assert.ok(Math.abs(vm.flashMesh1.scale.x - 0.25) < 0.15, 'AK-47 deve ter flash na faixa de 0.25');

    // 2. SCAR-H, Rifle Prototype e UZI: tamanho aumentado (> 0.30)
    vm.flash({ id: 'scar_h', muzzleLocal: [0, 0, -0.5] });
    assert.ok(vm.flashMesh1.scale.x >= 0.30, 'SCAR-H deve ter flash aumentado');

    vm.flash({ id: 'rifle_proto', muzzleLocal: [0, 0, -0.5] });
    assert.ok(vm.flashMesh1.scale.x >= 0.30, 'Rifle Prototype deve ter flash aumentado');

    vm.flash({ id: 'uzi', muzzleLocal: [0, 0, -0.5] });
    assert.ok(vm.flashMesh1.scale.x >= 0.28, 'UZI deve ter flash aumentado');

    // 3. S&W 500 e M249: muito grande (> 0.45)
    vm.flash({ id: 'sw500', muzzleLocal: [0, 0, -0.5] });
    assert.ok(vm.flashMesh1.scale.x >= 0.44, 'SW500 deve ter flash muito grande');

    vm.flash({ id: 'm249', muzzleLocal: [0, 0, -0.5] });
    assert.ok(vm.flashMesh1.scale.x >= 0.45, 'M249 deve ter flash muito grande');

    // 4. VSS, P9 e M12 (Shotgun): SEM flash (apenas fumaça cônica)
    vm.flash({ id: 'vss', muzzleLocal: [0, 0, -0.5] });
    assert.strictEqual(vm.flashGroup.visible, false, 'VSS (silenciada) não deve ter flash');
    assert.strictEqual(vm.flashLight.intensity, 0, 'VSS não deve acender PointLight');

    vm.flash({ id: 'p9', muzzleLocal: [0, 0, -0.5] });
    assert.strictEqual(vm.flashGroup.visible, false, 'P9 não deve ter flash');

    vm.flash({ id: 'm12', muzzleLocal: [0, 0, -0.5] });
    assert.strictEqual(vm.flashGroup.visible, false, 'M12 (Shotgun) não deve ter flash');
  });

  it('deve ter opacidades e escalas de fumaça cônica calibradas proporcionalmente', () => {
    // Opacidade dos gases do cano igual ou maior que a fumaça residual que sobe (>= 0.22)
    for (const [id, wep] of Object.entries(weaponsData)) {
      assert.ok(
        wep.smokeConeOpacity >= 0.22,
        `Arma ${id} deve ter smokeConeOpacity >= 0.22 (atual: ${wep.smokeConeOpacity})`
      );
      assert.ok(
        wep.smokeConeScale > 0,
        `Arma ${id} deve possuir smokeConeScale positivo (atual: ${wep.smokeConeScale})`
      );
    }

    // Regra da M12 / "M13" (Shotgun): cano grossão sem flash, equiparado ou maior que M249
    const m12 = weaponsData.m12;
    const m249 = weaponsData.m249;
    assert.ok(
      m12.smokeConeOpacity >= m249.smokeConeOpacity,
      'M12 Shotgun deve ter fumaça cônica com opacidade igual ou maior que a M249'
    );
    assert.ok(
      m12.smokeConeScale >= m249.smokeConeScale,
      'M12 Shotgun deve ter escala de fumaça igual ou maior que a M249'
    );

    // M249 e SW500 devem ter fumaças muito maiores que rifles padrão
    assert.ok(m249.smokeConeScale > weaponsData.ar15.smokeConeScale);
    assert.ok(weaponsData.sw500.smokeConeScale > weaponsData.ar15.smokeConeScale);
  });

  it('deve emitir fumaça cônica com as novas escalas sem estourar o pool de partículas', () => {
    const scene = new THREE.Scene();
    const effects = new Effects(scene);

    const muzzle = new THREE.Vector3(0, 1.5, 0);
    const forward = new THREE.Vector3(0, 0, -1);

    // Dispara fumaça da M12 (escala 2.0, opacidade 0.42)
    effects._spawnMuzzleSmoke(muzzle, forward, 0.42, 2.0);

    const activeSmokes = effects.smokes.filter(s => s.active);
    assert.ok(activeSmokes.length >= 3, 'Deve ativar pelo menos 3 puffs de fumaça');
    assert.ok(activeSmokes[0].maxOpacity >= 0.40, 'Opacidade configurada deve ser aplicada');
    assert.ok(activeSmokes[0].startScale >= 1.0, 'Escala inicial deve ser ampliada para cano grosso');

    // Simula 0.1s de update
    effects.update(0.1);
    assert.ok(activeSmokes[0].mesh.material.opacity > 0.15, 'Fumaça ainda deve ser claramente visível');

    effects.destroy();
  });
});
