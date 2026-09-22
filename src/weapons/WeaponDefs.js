/**
 * WeaponDefs: Registro e compilador de armas e attachments.
 * Fonte única de verdade: weapons.json — sem fallback hardcoded.
 */

export let MODS = {};

// BASE_WEAPONS inicia vazio; populado exclusivamente por initWeaponsFromData via weapons.json
export let BASE_WEAPONS = {};

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
          finalWep.recoilYaw   *= mod.recoilMul;
        }
        if (mod.spreadMul) {
          finalWep.spreadHip *= mod.spreadMul;
          finalWep.spreadAds *= mod.spreadMul;
        }
        if (mod.adsTimeMul && finalWep.reloadTime) {
          // adsTimeMul escala o tempo de ADS (reloadTime usado como proxy até adsTime ser campo próprio)
          finalWep.adsTimeMul = (finalWep.adsTimeMul ?? 1) * mod.adsTimeMul;
        }
        if (mod.adsFov)            finalWep.adsFov            = mod.adsFov;
        if (mod.adsSightDistance)  finalWep.adsSightDistance  = mod.adsSightDistance;
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