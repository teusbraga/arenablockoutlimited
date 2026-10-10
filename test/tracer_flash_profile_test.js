import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initWeaponsFromData, WEAPONS } from '../src/weapons/WeaponDefs.js';

describe('Data-Driven Tracer & Muzzle Flash Profile Integrity', () => {
  const rootDir = process.cwd();
  const weaponsData = JSON.parse(readFileSync(join(rootDir, 'assets/weapons/weapons.json'), 'utf8'));
  const ammoData = JSON.parse(readFileSync(join(rootDir, 'assets/weapons/ammo.json'), 'utf8'));

  it('deve possuir flashProfile definido em todas as munições dentro de tracerProfile', () => {
    for (const [ammoKey, ammoDef] of Object.entries(ammoData)) {
      assert.ok(ammoDef.tracerProfile, `Munição ${ammoKey} deve conter tracerProfile`);
      const fp = ammoDef.tracerProfile.flashProfile;
      assert.ok(fp, `Munição ${ammoKey} deve conter flashProfile dentro de tracerProfile`);
      assert.ok(typeof fp.size === 'number' && fp.size > 0, `${ammoKey} deve ter fp.size positivo`);
      assert.ok(typeof fp.opacity === 'number' && fp.opacity > 0, `${ammoKey} deve ter fp.opacity`);
      assert.ok(typeof fp.lightIntensity === 'number' && fp.lightIntensity > 0, `${ammoKey} deve ter lightIntensity`);
      assert.ok(typeof fp.maskElasticOffset === 'number' && fp.maskElasticOffset >= 0, `${ammoKey} deve ter maskElasticOffset`);
    }
  });

  it('deve compilar flashProfile em todas as armas após initWeaponsFromData', () => {
    initWeaponsFromData({ weapons: weaponsData.weapons, mods: weaponsData.mods, ammo: ammoData });

    for (const [wepId, wep] of Object.entries(WEAPONS)) {
      assert.ok(wep.tracerProfile, `Arma ${wepId} deve possuir tracerProfile compilado`);
      assert.ok(wep.flashProfile, `Arma ${wepId} deve possuir flashProfile compilado no topo da struct`);
      assert.ok(wep.tracerProfile.flashProfile, `Arma ${wepId} deve manter flashProfile em tracerProfile`);
      assert.ok(wep.flashProfile.size > 0, `Arma ${wepId} deve ter tamanho de flash maior que zero`);
    }
  });

  it('regra de proporção: armas com bocal mais colado à câmera/corpo devem ter flashes maiores para mascarar o efeito elástico', () => {
    initWeaponsFromData({ weapons: weaponsData.weapons, mods: weaponsData.mods, ammo: ammoData });

    // P9 (muzzle z ~ -0.11m) e UZI (muzzle z ~ -0.22m) são as mais coladas
    // VSS (muzzle z ~ -0.69m, silenciada) e Rifle Proto / AR15 / M249 possuem canos mais longos
    const p9 = WEAPONS['p9'];
    const uzi = WEAPONS['uzi'];
    const ar15 = WEAPONS['ar15'];
    const proto = WEAPONS['rifle_proto'];
    const vss = WEAPONS['vss'];

    assert.ok(p9 && uzi && ar15 && proto && vss, 'Armas principais de teste devem estar compiladas');

    // Comprovação da regra do usuário:
    // "quanto mais colado no cano maior e mais visivel deve ser o flash na boca dele"
    assert.ok(p9.flashProfile.size > ar15.flashProfile.size, 'P9 (cano hiper-colado) deve ter flash maior que AR-15');
    assert.ok(uzi.flashProfile.size > ar15.flashProfile.size, 'UZI (cano colado) deve ter flash maior que AR-15');
    assert.ok(p9.flashProfile.maskElasticOffset > ar15.flashProfile.maskElasticOffset, 'P9 deve ter maior máscara de offset elástico');
    assert.ok(p9.flashProfile.size > proto.flashProfile.size, 'P9 deve ter flash maior que Rifle Prototype');
    assert.ok(vss.flashProfile.size < ar15.flashProfile.size, 'VSS (silenciador longo) deve ter flash significativamente menor');
    assert.ok(vss.flashProfile.opacity < ar15.flashProfile.opacity, 'VSS deve ter opacidade sutil por ser silenciada');
  });
});
