/**
 * SchemaValidator: Validador em JS puro executado no boot e em testes.
 * Garante que os dados de armas, munições e configurações atendam aos contratos da engine,
 * emitindo alertas descritivos caso propriedades obrigatórias estejam ausentes.
 */

export class SchemaValidator {
  /**
   * Valida as propriedades obrigatórias de cada arma (topo e balística).
   * @param {Object} weapons - Dicionário de armas { ar15: {...}, ... }
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validateWeapons(weapons) {
    const errors = [];
    if (!weapons || typeof weapons !== 'object') {
      const msg = '[SchemaValidator] Nenhuma definição de armas encontrada para validação.';
      console.error(msg);
      return { valid: false, errors: [msg] };
    }

    const mandatoryTopLevel = [
      'id', 'name', 'type', 'ammo', 'fireInterval', 'magSize', 'reloadTime', 'fireModes',
      'hipPos', 'hipRot', 'adsRot', 'adsSightDistance',
      'sprintPos', 'sprintRot', 'sightLocal', 'muzzleLocal', 'ejectLocal',
      'adsFov', 'spreadHip', 'spreadAds', 'ballistics'
    ];

    const mandatoryInternal = ['fireInterval', 'adsTime', 'reloadTime'];
    const mandatoryExternalRecoil = ['vertical', 'horizontal', 'recoveryTime'];
    const mandatoryExternalSway = ['base', 'speed'];
    const mandatoryExternalPrecision = ['baseSpread', 'recoveryTime'];
    const mandatoryTerminal = ['damageBody', 'damageHead', 'bulletDrop', 'bulletSpeed'];

    for (const [id, wep] of Object.entries(weapons)) {
      if (!wep || typeof wep !== 'object') {
        const msg = `[SchemaValidator] Erro na arma '${id}': definição inválida (não é objeto).`;
        console.error(msg);
        errors.push(msg);
        continue;
      }

      // 1. Atributos de topo
      for (const field of mandatoryTopLevel) {
        if (wep[field] === undefined) {
          const msg = `[SchemaValidator] Erro na arma '${id}': campo '${field}' ausente!`;
          console.error(msg);
          errors.push(msg);
        }
      }

      // 2. Balística
      const b = wep.ballistics;
      if (!b || typeof b !== 'object') {
        const msg = `[SchemaValidator] Erro na arma '${id}': bloco 'ballistics' ausente ou inválido!`;
        console.error(msg);
        errors.push(msg);
        continue;
      }

      // 2.1 internal
      if (!b.internal || typeof b.internal !== 'object') {
        const msg = `[SchemaValidator] Erro na arma '${id}': campo 'internal' ausente em ballistics!`;
        console.error(msg);
        errors.push(msg);
      } else {
        for (const f of mandatoryInternal) {
          if (b.internal[f] === undefined) {
            const msg = `[SchemaValidator] Erro na arma '${id}': campo 'internal.${f}' ausente!`;
            console.error(msg);
            errors.push(msg);
          }
        }
      }

      // 2.2 external
      if (!b.external || typeof b.external !== 'object') {
        const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external' ausente em ballistics!`;
        console.error(msg);
        errors.push(msg);
      } else {
        if (!b.external.recoil || typeof b.external.recoil !== 'object') {
          const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external.recoil' ausente!`;
          console.error(msg);
          errors.push(msg);
        } else {
          for (const f of mandatoryExternalRecoil) {
            if (b.external.recoil[f] === undefined) {
              const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external.recoil.${f}' ausente!`;
              console.error(msg);
              errors.push(msg);
            }
          }
        }

        if (!b.external.sway || typeof b.external.sway !== 'object') {
          const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external.sway' ausente!`;
          console.error(msg);
          errors.push(msg);
        } else {
          for (const f of mandatoryExternalSway) {
            if (b.external.sway[f] === undefined) {
              const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external.sway.${f}' ausente!`;
              console.error(msg);
              errors.push(msg);
            }
          }
        }

        if (!b.external.precision || typeof b.external.precision !== 'object') {
          const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external.precision' ausente!`;
          console.error(msg);
          errors.push(msg);
        } else {
          for (const f of mandatoryExternalPrecision) {
            if (b.external.precision[f] === undefined) {
              const msg = `[SchemaValidator] Erro na arma '${id}': campo 'external.precision.${f}' ausente!`;
              console.error(msg);
              errors.push(msg);
            }
          }
        }
      }

      // 2.3 terminal
      if (!b.terminal || typeof b.terminal !== 'object') {
        const msg = `[SchemaValidator] Erro na arma '${id}': campo 'terminal' ausente em ballistics!`;
        console.error(msg);
        errors.push(msg);
      } else {
        for (const f of mandatoryTerminal) {
          if (b.terminal[f] === undefined) {
            const msg = `[SchemaValidator] Erro na arma '${id}': campo 'terminal.${f}' ausente!`;
            console.error(msg);
            errors.push(msg);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Valida dicionário de munições.
   * @param {Object} ammoData - Dicionário de munições { "556_nato": {...}, ... }
   */
  static validateAmmo(ammoData) {
    const errors = [];
    if (!ammoData || typeof ammoData !== 'object') {
      const msg = '[SchemaValidator] Dados de ammo.json inválidos ou ausentes.';
      console.error(msg);
      return { valid: false, errors: [msg] };
    }

    const mandatoryAmmo = [
      'bulletSpeed', 'bulletDrop', 'penetrationPower',
      'maxPenetrations', 'ricochetChance', 'tracerColor', 'tracerProfile'
    ];

    for (const [ammoId, ammoDef] of Object.entries(ammoData)) {
      for (const field of mandatoryAmmo) {
        if (ammoDef[field] === undefined) {
          const msg = `[SchemaValidator] Erro na munição '${ammoId}': campo '${field}' ausente!`;
          console.error(msg);
          errors.push(msg);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Valida todos os schemas do jogo.
   */
  static validateAll({ weapons, ammo, gameplay } = {}) {
    const allErrors = [];
    if (weapons) {
      const res = this.validateWeapons(weapons);
      if (!res.valid) allErrors.push(...res.errors);
    }
    if (ammo) {
      const res = this.validateAmmo(ammo);
      if (!res.valid) allErrors.push(...res.errors);
    }
    return { valid: allErrors.length === 0, errors: allErrors };
  }
}
