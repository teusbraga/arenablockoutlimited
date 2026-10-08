/**
 * WeaponDefs: Registro e compilador de armas e attachments.
 * Fonte única de verdade: weapons.json — sem fallback hardcoded.
 */

export let MODS = {};

// BASE_WEAPONS inicia vazio; populado exclusivamente por initWeaponsFromData via weapons.json
export let BASE_WEAPONS = {};

export function normalizeBallistics(wep) {
  const b = wep.ballistics || {};
  const internal = b.internal || {};
  const external = b.external || {};
  const recoil = external.recoil || {};
  const sway = external.sway || {};
  const precision = external.precision || {};
  const dynamicLoss = precision.dynamicLoss || {};
  const terminal = b.terminal || {};
  const damageFalloff = terminal.damageFalloff || {};

  return {
    internal: {
      fireInterval: internal.fireInterval ?? wep.fireInterval ?? 0.1,
      adsTime: internal.adsTime ?? 0.22,
      reloadTime: internal.reloadTime ?? wep.reloadTime ?? 2.0,
    },
    external: {
      recoil: {
        vertical: recoil.vertical ?? wep.recoilPitch ?? 0.01,
        horizontal: recoil.horizontal ?? wep.recoilYaw ?? 0.003,
        yawBias: recoil.yawBias ?? wep.recoilYawBias ?? 0,
        pattern: recoil.pattern ?? 'standard',
        recoveryTime: recoil.recoveryTime ?? 0.3,
      },
      sway: {
        base: sway.base ?? 0.0025,
        multiplierAds: sway.multiplierAds ?? 0.25,
        speed: sway.speed ?? 1.5,
      },
      precision: {
        baseSpread: precision.baseSpread ?? wep.spreadAds ?? 0.0015,
        swaySpreadImpact: precision.swaySpreadImpact ?? 0.5,
        dynamicLoss: {
          strafe: dynamicLoss.strafe ?? 0.02,
          walk: dynamicLoss.walk ?? 0.015,
          run: dynamicLoss.run ?? 0.04,
        },
        recoveryTime: precision.recoveryTime ?? 0.35,
      },
    },
    terminal: {
      damageBody: terminal.damageBody ?? wep.damageBody ?? 25,
      damageHead: terminal.damageHead ?? wep.damageHead ?? 50,
      damageFalloff: {
        startDistance: damageFalloff.startDistance ?? 30,
        endDistance: damageFalloff.endDistance ?? 80,
        minMultiplier: damageFalloff.minMultiplier ?? 0.5,
      },
      bulletDrop: terminal.bulletDrop ?? 9.8,
      bulletSpeed: terminal.bulletSpeed ?? 700,
    },
  };
}

export function compileWeapons(baseList = BASE_WEAPONS, modsList = MODS) {
  const compiled = {};
  for (const [key, base] of Object.entries(baseList)) {
    const finalWep = { ...base };
    finalWep.ballistics = normalizeBallistics(finalWep);

    if (finalWep.mods) {
      for (const modId of finalWep.mods) {
        const mod = modsList[modId];
        if (!mod) continue;
        if (mod.recoilMul) {
          finalWep.recoilPitch *= mod.recoilMul;
          finalWep.recoilYaw   *= mod.recoilMul;
          finalWep.ballistics.external.recoil.vertical *= mod.recoilMul;
          finalWep.ballistics.external.recoil.horizontal *= mod.recoilMul;
        }
        if (mod.spreadMul) {
          finalWep.spreadHip *= mod.spreadMul;
          finalWep.spreadAds *= mod.spreadMul;
          finalWep.ballistics.external.precision.baseSpread *= mod.spreadMul;
        }
        if (mod.adsTimeMul) {
          finalWep.adsTimeMul = (finalWep.adsTimeMul ?? 1) * mod.adsTimeMul;
          finalWep.ballistics.internal.adsTime *= mod.adsTimeMul;
        }
        if (mod.adsFov)            finalWep.adsFov            = mod.adsFov;
        if (mod.adsSightDistance)  finalWep.adsSightDistance  = mod.adsSightDistance;
        if (mod.tracerProfile) {
          finalWep.tracerProfile = { ...(finalWep.tracerProfile || {}), ...mod.tracerProfile };
        }
      }
    }
    compiled[key] = finalWep;
  }
  return compiled;
}

// Singleton — começa vazio, preenchido no boot via initWeaponsFromData
export let WEAPONS = {};

/**
 * Inicializa WEAPONS a partir dos dados lidos de weapons.json.
 * Deve ser chamado uma vez durante o boot, antes de qualquer uso de WEAPONS.
 */
export function initWeaponsFromData(data) {
  if (!data) return WEAPONS;
  if (data.mods)    Object.assign(MODS,         data.mods);
  if (data.weapons) Object.assign(BASE_WEAPONS, data.weapons);
  const compiled = compileWeapons(BASE_WEAPONS, MODS);
  for (const k in WEAPONS) delete WEAPONS[k];
  Object.assign(WEAPONS, compiled);
  return WEAPONS;
}