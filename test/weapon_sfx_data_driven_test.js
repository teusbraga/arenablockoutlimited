import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import * as THREE from 'three';
import { initWeaponsFromData, WEAPONS, compileWeapons, DEFAULT_SFX } from '../src/weapons/WeaponDefs.js';
import { Viewmodel } from '../src/weapons/Viewmodel.js';
import { Effects } from '../src/fx/Effects.js';
import { calculateSmokeCooldownDuration, WeaponSystem } from '../src/weapons/WeaponSystem.js';

describe('Weapon SFX Data-Driven Architecture (<gun_name>_sfx.json)', () => {
  const rootDir = process.cwd();
  const sfxDir = join(rootDir, 'assets/weapons/sfx');
  const weaponsData = JSON.parse(readFileSync(join(rootDir, 'assets/weapons/weapons.json'), 'utf8')).weapons;
  const ammoData = JSON.parse(readFileSync(join(rootDir, 'assets/weapons/ammo.json'), 'utf8')).ammo;

  it('deve possuir default_sfx.json e perfis individuais para todas as 10 armas', () => {
    assert.ok(existsSync(join(sfxDir, 'default_sfx.json')), 'default_sfx.json deve existir');

    const expectedWeapons = ['ar15', 'ak47', 'scar_h', 'rifle_proto', 'uzi', 'sw500', 'm249', 'vss', 'p9', 'm12'];
    for (const wepId of expectedWeapons) {
      const filePath = join(sfxDir, `${wepId}_sfx.json`);
      assert.ok(existsSync(filePath), `Arquivo SFX para ${wepId} deve existir (${wepId}_sfx.json)`);

      const content = JSON.parse(readFileSync(filePath, 'utf8'));
      assert.strictEqual(content.weaponId, wepId, `weaponId deve ser ${wepId}`);
      assert.ok(content.flash, 'Deve possuir seção flash');
      assert.ok(content.smoke, 'Deve possuir seção smoke');
      assert.ok(content.barrelHeat, 'Deve possuir seção barrelHeat');
      assert.ok(content.impactDustOverride, 'Deve possuir seção impactDustOverride');
    }
  });

  it('deve ter speed muito alto em todas as armas e reach proporcional ao porte/cano', () => {
    const sfxFiles = readdirSync(sfxDir).filter(f => f.endsWith('_sfx.json') && f !== 'default_sfx.json');

    for (const file of sfxFiles) {
      const data = JSON.parse(readFileSync(join(sfxDir, file), 'utf8'));
      const smoke = data.smoke;

      // Velocidade do estouro de gás violentamente alta em todas as armas (>= 15 m/s)
      assert.ok(smoke.speed >= 15.0, `Arma ${data.weaponId} deve ter smoke.speed violento >= 15 (atual: ${smoke.speed})`);
      assert.ok(smoke.reach > 0, `Arma ${data.weaponId} deve ter alcance de fumaça positivo (atual: ${smoke.reach})`);
    }

    // Validação comparativa de alcance (reach)
    const p9 = JSON.parse(readFileSync(join(sfxDir, 'p9_sfx.json'), 'utf8')).smoke;
    const uzi = JSON.parse(readFileSync(join(sfxDir, 'uzi_sfx.json'), 'utf8')).smoke;
    const ar15 = JSON.parse(readFileSync(join(sfxDir, 'ar15_sfx.json'), 'utf8')).smoke;
    const m249 = JSON.parse(readFileSync(join(sfxDir, 'm249_sfx.json'), 'utf8')).smoke;
    const m12 = JSON.parse(readFileSync(join(sfxDir, 'm12_sfx.json'), 'utf8')).smoke;

    assert.ok(p9.reach <= 0.25, 'Pistola P9 deve ter alcance de fumaça curto (<= 0.25m)');
    assert.ok(uzi.reach <= 0.30, 'UZI deve ter alcance de fumaça curto (<= 0.30m)');
    assert.ok(ar15.reach > uzi.reach, 'Fuzil AR15 deve ter alcance de fumaça maior que SMG UZI');
    assert.ok(m249.reach >= 0.80, 'Metralhadora M249 deve ter alcance de fumaça longo (>= 0.80m)');
    assert.ok(m12.reach >= 0.80, 'Shotgun M12 de cano grosso deve ter alcance longo (>= 0.80m)');
  });

  it('deve compilar WEAPONS[id].sfx perfeitamente via initWeaponsFromData', () => {
    // Carrega todos os perfis SFX em memória
    const sfxMap = {};
    const sfxFiles = readdirSync(sfxDir).filter(f => f.endsWith('_sfx.json') || f === 'default_sfx.json');
    for (const file of sfxFiles) {
      const id = file.replace('_sfx.json', '').replace('.json', '');
      sfxMap[id] = JSON.parse(readFileSync(join(sfxDir, file), 'utf8'));
    }

    initWeaponsFromData({
      weapons: weaponsData,
      ammo: ammoData,
      sfx: sfxMap
    });

    for (const [id, wep] of Object.entries(WEAPONS)) {
      assert.ok(wep.sfx, `Arma ${id} deve possuir objeto sfx compilado`);
      assert.ok(wep.sfx.flash, `Arma ${id} deve possuir sfx.flash`);
      assert.ok(wep.sfx.smoke, `Arma ${id} deve possuir sfx.smoke`);
      assert.ok(wep.sfx.barrelHeat, `Arma ${id} deve possuir sfx.barrelHeat`);
      assert.ok(wep.sfx.impactDustOverride, `Arma ${id} deve possuir sfx.impactDustOverride`);
    }

    // Regras de Flash herdadas dos JSONs individuais
    assert.strictEqual(WEAPONS.vss.sfx.flash.enabled, false, 'VSS deve ter flash desativado');
    assert.strictEqual(WEAPONS.p9.sfx.flash.enabled, false, 'P9 deve ter flash desativado');
    assert.strictEqual(WEAPONS.m12.sfx.flash.enabled, false, 'M12 Shotgun deve ter flash desativado');

    assert.strictEqual(WEAPONS.ar15.sfx.flash.size, 0.25, 'HK416 deve ter flash 0.25');
    assert.strictEqual(WEAPONS.ak47.sfx.flash.size, 0.25, 'AK-47 deve ter flash 0.25');
    assert.ok(WEAPONS.m249.sfx.flash.size >= 0.50, 'M249 deve ter flash muito grande');
  });

  it('deve acionar Viewmodel.flash(def) consumindo dados de def.sfx.flash', () => {
    const fakeCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const vm = new Viewmodel(fakeCamera);

    // 1. Arma com flash ativo (HK416)
    vm.flash(WEAPONS.ar15);
    assert.strictEqual(vm.flashGroup.visible, true, 'HK416 deve exibir flash');
    assert.ok(Math.abs(vm.flashMesh1.scale.x - 0.25) < 0.15, 'Escala deve respeitar 0.25');

    // 2. Arma com flash inativo (VSS)
    vm.flash(WEAPONS.vss);
    assert.strictEqual(vm.flashGroup.visible, false, 'VSS não deve exibir flash');
    assert.strictEqual(vm.flashLight.intensity, 0, 'Luz deve estar apagada');

    // 3. Arma com flash inativo (M12)
    vm.flash(WEAPONS.m12);
    assert.strictEqual(vm.flashGroup.visible, false, 'M12 não deve exibir flash');
  });

  it('deve disparar fumaça respeitando sfx.smoke e freando ao atingir o reach', () => {
    const scene = new THREE.Scene();
    const effects = new Effects(scene);

    const muzzle = new THREE.Vector3(0, 1.5, 0);
    const forward = new THREE.Vector3(0, 0, -1);

    // Dispara com M249 (speed 19.5, reach 0.85)
    effects._spawnMuzzleSmoke(muzzle, forward, WEAPONS.m249.sfx.smoke, WEAPONS.m249);

    const activeSmokes = effects.smokes.filter(s => s.active);
    assert.ok(activeSmokes.length >= 3, 'Deve gerar partículas ativas');
    assert.ok(activeSmokes[0].reach >= 0.70, 'Deve registrar o reach configurado');

    // Simula 0.05s de update
    effects.update(0.05);
    assert.ok(activeSmokes[0].distanceTraveled > 0, 'Deve ter percorrido distância inicial');

    effects.destroy();
  });

  it('deve carregar surface_impacts.json e pulverizar materiais com paletas e propriedades exclusivas', () => {
    const surfaceImpactsPath = join(rootDir, 'assets/weapons/sfx/surface_impacts.json');
    assert.ok(existsSync(surfaceImpactsPath), 'surface_impacts.json deve existir');

    const impactsData = JSON.parse(readFileSync(surfaceImpactsPath, 'utf8'));
    assert.ok(impactsData.materials, 'Deve conter nó materials');

    const expectedMaterials = ['concrete', 'stone', 'wood', 'dirt', 'sand', 'grass', 'metal', 'glass', 'default'];
    for (const mat of expectedMaterials) {
      assert.ok(impactsData.materials[mat], `Material ${mat} deve estar definido em surface_impacts.json`);
      assert.ok(Array.isArray(impactsData.materials[mat].colors) && impactsData.materials[mat].colors.length > 0, `${mat} deve possuir array de cores`);
      assert.ok(impactsData.materials[mat].scale > 0, `${mat} deve ter escala positiva`);
      assert.ok(impactsData.materials[mat].speed > 0, `${mat} deve ter speed positivo`);
    }

    const scene = new THREE.Scene();
    const effects = new Effects(scene);
    effects.setSurfaceImpacts(impactsData);

    const hitPoint = new THREE.Vector3(0, 1, 0);
    const hitNormal = new THREE.Vector3(0, 0, 1);

    // 1. Impacto em Madeira
    effects._spawnSurfaceImpactDust(hitPoint, hitNormal, 'crate_wood_heavy', WEAPONS.ar15);
    const woodSmokes = effects.smokes.filter(s => s.active);
    assert.ok(woodSmokes.length > 0, 'Deve gerar partículas de impacto em madeira');

    const woodColorsHex = impactsData.materials.wood.colors.map(c => parseInt(c.replace('#', '0x')));
    const activeColor = woodSmokes[0].mesh.material.color.getHex();
    assert.ok(woodColorsHex.includes(activeColor), `Cor da poeira de madeira (0x${activeColor.toString(16)}) deve estar na paleta`);

    // Limpa partículas ativas
    effects.smokes.forEach(s => { s.active = false; });

    // 2. Impacto em Concreto com override de arma (ex: M12 shotgun que tem scaleMultiplier 1.45)
    effects._spawnSurfaceImpactDust(hitPoint, hitNormal, 'concrete_pillar', WEAPONS.m12);
    const m12Smokes = effects.smokes.filter(s => s.active);
    assert.ok(m12Smokes.length >= 4, 'Shotgun M12 deve gerar pelo menos 4 partículas de pulverização devido ao override');
    assert.ok(m12Smokes[0].startScale > 0.8, 'Shotgun deve gerar pulverização maior que padrão');

    effects.destroy();
  });

  it('deve calcular a duração de fumaça de cooldown de forma exponencial (1s->0.3s, 2s->0.6s, 3s->1.2s)', () => {
    // 1 segundo de spray sustentado = 0.3s de fumaça
    const d1 = calculateSmokeCooldownDuration(1.0);
    assert.ok(Math.abs(d1 - 0.3) < 0.001, `1s de spray deve resultar em 0.3s de fumaça (obteve: ${d1})`);

    // 2 segundos de spray sustentado = 0.6s de fumaça
    const d2 = calculateSmokeCooldownDuration(2.0);
    assert.ok(Math.abs(d2 - 0.6) < 0.001, `2s de spray deve resultar em 0.6s de fumaça (obteve: ${d2})`);

    // 3 segundos de spray sustentado = 1.2s de fumaça
    const d3 = calculateSmokeCooldownDuration(3.0);
    assert.ok(Math.abs(d3 - 1.2) < 0.001, `3s de spray deve resultar em 1.2s de fumaça (obteve: ${d3})`);

    // Rajada curta (< 1s, ex: 0.5s) = 0.15s
    const dShort = calculateSmokeCooldownDuration(0.5);
    assert.ok(Math.abs(dShort - 0.15) < 0.001, `0.5s de spray deve resultar em 0.15s de fumaça (obteve: ${dShort})`);

    // Disparo pontual ínfimo (<0.05s) = 0
    assert.strictEqual(calculateSmokeCooldownDuration(0.02), 0, 'Disparo quase instantâneo não gera cooldown residual excessivo');
  });
});


