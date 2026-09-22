/**
 * WeaponDefs: Registro e compilador de armas e attachments.
 * Suporta injeção data-driven via weapons.json com fallback de segurança.
 */

export let MODS = {
  heavyBarrel: { id: 'heavyBarrel', recoilMul: 0.8, adsTimeMul: 1.2, spreadMul: 0.85 },
  lightGrip: { id: 'lightGrip', adsTimeMul: 0.8, sprintOutMul: 0.8, spreadMul: 1.1 },
  redDot: { id: 'redDot', adsFov: 50, adsSightDistance: 0.28 },
};

export let BASE_WEAPONS = {
  ar15: {
    id: 'ar15',
    name: 'HK416',
    auto: true,
    damageBody: 24,
    damageHead: 52,
    fireInterval: 0.09,
    magSize: 30,
    reloadTime: 1.65,
    spreadHip: 0.024,
    spreadAds: 0.003,
    recoilPitch: 0.011,
    recoilYaw: 0.005,
    adsFov: 55,
    adsSightDistance: 0.26,
    hipPos: [0.15, -0.16, -0.30],
    hipRot: [0.06, -0.16, 0.05],
    adsRot: [0, 0, 0],
    sprintPos: [0.22, -0.26, -0.32],
    sprintRot: [0.62, -0.45, 0.20],
    audioKey: 'shot_hk416',
    audioShot: { freqA: 180, freqB: 46, dur: 0.095, type: 'sawtooth', gain: 0.22 },
    model: 'ar15',
    sightLocal: [0, 0.076, -0.26],
    muzzleLocal: [0, 0.018, -0.51],
    mods: ['heavyBarrel']
  },
  p9: {
    id: 'p9',
    name: 'P-9',
    auto: false,
    damageBody: 40,
    damageHead: 75,
    fireInterval: 0.16,
    magSize: 12,
    reloadTime: 1.15,
    spreadHip: 0.018,
    spreadAds: 0.0025,
    recoilPitch: 0.017,
    recoilYaw: 0.006,
    adsFov: 58,
    adsSightDistance: 0.20,
    hipPos: [0.13, -0.14, -0.28],
    hipRot: [0.08, -0.17, 0.06],
    adsRot: [0, 0, 0],
    sprintPos: [0.18, -0.22, -0.28],
    sprintRot: [0.48, -0.36, 0.14],
    audioKey: 'shot_p9',
    audioShot: { freqA: 260, freqB: 90, dur: 0.07, type: 'square', gain: 0.16 },
    model: 'p9',
    sightLocal: [0, 0.036, -0.083],
    muzzleLocal: [0, 0.014, -0.11],
    mods: []
  },
};

export function compileWeapons(baseList = BASE_WEAPONS, modsList = MODS) {
  const compiled = {};
  for (const [key, base] of Object.entries(baseList)) {
    const finalWep = { ...base };
    if (finalWep.mods) {
      for (const modId of finalWep.mods) {
        const mod = modsList[modId];
        if (!mod) continue;
        if (mod.recoilMul) {
          finalWep.recoilPitch *= mod.recoilMul;
          finalWep.recoilYaw *= mod.recoilMul;
        }
        if (mod.spreadMul) {
          finalWep.spreadHip *= mod.spreadMul;
          finalWep.spreadAds *= mod.spreadMul;
        }
        if (mod.adsFov) finalWep.adsFov = mod.adsFov;
        if (mod.adsSightDistance) finalWep.adsSightDistance = mod.adsSightDistance;
      }
    }
    compiled[key] = finalWep;
  }
  return compiled;
}

export let WEAPONS = compileWeapons();

/**
 * Inicializa e sobrescreve as armas dinamicamente a partir dos dados lidos de weapons.json
 */
export function initWeaponsFromData(data) {
  if (!data) return WEAPONS;
  if (data.mods) {
    Object.assign(MODS, data.mods);
  }
  if (data.weapons) {
    Object.assign(BASE_WEAPONS, data.weapons);
  }
  const compiled = compileWeapons(BASE_WEAPONS, MODS);
  for (const k in WEAPONS) delete WEAPONS[k];
  Object.assign(WEAPONS, compiled);
  return WEAPONS;
}