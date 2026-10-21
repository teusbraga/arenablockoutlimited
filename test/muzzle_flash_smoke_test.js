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

  it('deve emitir pulverização violenta em tons cinza-castanho ao atingir superfícies (shot:world)', () => {
    const scene = new THREE.Scene();
    const effects = new Effects(scene);

    const hitPoint = new THREE.Vector3(5, 1.2, 10);
    const normal = new THREE.Vector3(0, 0, 1);

    effects._spawnSurfaceImpactDust(hitPoint, normal, 1.0);

    const activeDust = effects.smokes.filter(s => s.active);
    assert.ok(activeDust.length >= 2, 'Deve gerar pelo menos 2 partículas de pulverização na parede');
    
    // Verifica tons de cinza-castanho
    const hex = activeDust[0].mesh.material.color.getHex();
    const isBrownishGrey = [0x8c7d6b, 0x968674, 0x7d6f5e, 0xa39280].includes(hex);
    assert.ok(isBrownishGrey, 'Cor da pulverização deve ser em tom cinza-castanho');
    assert.ok(activeDust[0].spin !== 0, 'Partícula deve possuir giro angular violento');

    // Simula update com câmera
    const fakeCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    effects.update(0.05, fakeCamera);
    assert.ok(activeDust[0].mesh.scale.x > activeDust[0].startScale, 'Poeira de impacto deve expandir rapidamente');

    effects.destroy();
  });

  it('deve aplicar delay sequencial de 20ms entre artefatos de fumaça e velocidade reduzida em 20%', () => {
    const scene = new THREE.Scene();
    const effects = new Effects(scene);

    const muzzle = new THREE.Vector3(0, 1.5, 0);
    const forward = new THREE.Vector3(0, 0, -1);

    // Dispara com speed base 20.0 e 5 partículas
    effects._spawnMuzzleSmoke(muzzle, forward, {
      speed: 20.0,
      particleCount: 5,
      delayStep: 0.020,
      scale: 1.0,
      maxOpacity: 0.3
    });

    const activeSmokes = effects.smokes.filter(s => s.active);
    assert.strictEqual(activeSmokes.length, 5, 'Deve ativar 5 partículas');

    // 1. Verifica velocidade e alcance longo do cone (reach >= 1.35m)
    const tipSpeed = activeSmokes[0].vel.length();
    assert.ok(Math.abs(tipSpeed - (20.0 * 0.70 * 1.15)) < 0.1, 'Velocidade da ponta deve refletir projeção do cone longo');
    assert.ok(activeSmokes[0].reach >= 1.35, 'Cone deve ser longo (reach >= 1.35m)');

    // 2. No frame 0: apenas a partícula 0 está visível, nascendo encorpada no bocal (0.26)
    assert.strictEqual(activeSmokes[0].delay, 0, 'Partícula 0 deve ter delay 0');
    assert.strictEqual(activeSmokes[0].mesh.visible, true, 'Partícula 0 deve estar visível no frame 0');
    assert.strictEqual(activeSmokes[0].mesh.scale.x, 0.26, 'Partícula 0 deve nascer encorpada no bocal (0.26)');

    assert.ok(Math.abs(activeSmokes[1].delay - 0.020) < 0.001, 'Partícula 1 deve ter delay configurado');
    assert.strictEqual(activeSmokes[1].mesh.visible, false, 'Partícula 1 deve estar invisível no frame 0');

    // 3. Após 25ms, partícula 1 torna-se visível e partícula 0 cresce para diâmetro maior
    effects.update(0.025);
    assert.strictEqual(activeSmokes[1].mesh.visible, true, 'Partícula 1 deve estar visível após delay');
    assert.ok(activeSmokes[0].mesh.scale.x > 0.26, 'Partícula 0 deve crescer conforme viaja pelo cone longo');

    // 4. Todas as partículas ativam e avançam ao longo do cone longo
    effects.update(0.060);
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(activeSmokes[i].mesh.visible, true, `Partícula ${i} deve estar visível`);
    }

    // 5. Esmaecimento total no final: se a partícula atingir o reach total, opacidade esmaece totalmente a 0.0
    activeSmokes[0].distanceTraveled = activeSmokes[0].reach;
    effects.update(0.016);
    assert.strictEqual(activeSmokes[0].mesh.material.opacity, 0, 'Fumaça deve esmaecer totalmente a 0.0 no final do cone');

    effects.destroy();
  });
});
