import { buildHK416 } from './models/HK416.js';
import { buildAK47 } from './models/AK47.js';
import { buildP9 } from './models/P9.js';
import { buildSW500 } from './models/SW500.js';
import { buildWinchester1912 as buildM12 } from './models/Winchester1912.js';
import { buildUZI } from './models/UZI.js';
import { buildM249 } from './models/M249.js';
import { buildRiflePrototype } from './models/RiflePrototype.js';
import { buildVSS } from './models/VSS.js';
import { buildSCARH } from './models/SCARH.js';

/**
 * WeaponRegistry: Manifesto e Registro Central das Armas (Registry Pattern)
 * Centraliza o vínculo entre ID, builders 3D de viewmodel e world drops,
 * e configurações de ótica/luneta telescópica.
 */
export class WeaponRegistry {
  static #entries = new Map();

  /**
   * Registra uma arma no ecossistema
   * @param {string} id ID canônico da arma (ex: 'ar15', 'ak47')
   * @param {Object} config Metadados e builders
   */
  static register(id, config = {}) {
    if (!id || typeof id !== 'string') return;
    this.#entries.set(id, {
      id,
      builder: config.builder,
      hasScope: Boolean(config.hasScope),
      category: config.category || 'rifle',
      ...config
    });
  }

  static get(id) {
    return this.#entries.get(id);
  }

  static has(id) {
    return this.#entries.has(id);
  }

  static getBuilder(id) {
    return this.#entries.get(id)?.builder || null;
  }

  static getAllBuilders() {
    const obj = {};
    for (const [id, entry] of this.#entries.entries()) {
      if (entry.builder) obj[id] = entry.builder;
    }
    return obj;
  }

  static getScopeWeaponIds() {
    const list = [];
    for (const [id, entry] of this.#entries.entries()) {
      if (entry.hasScope) list.push(id);
    }
    return list;
  }

  /**
   * Registra todos os modelos no Viewmodel de primeira pessoa
   */
  static populateViewmodel(viewmodel) {
    if (!viewmodel || typeof viewmodel.registerModel !== 'function') return;
    for (const [id, entry] of this.#entries.entries()) {
      if (entry.builder) {
        viewmodel.registerModel(id, entry.builder);
      }
    }
  }

  /**
   * Registra todos os construtores para drops físicos no chão
   */
  static populateItemDrops(ItemDrop) {
    if (!ItemDrop || typeof ItemDrop.setBuilders !== 'function') return;
    ItemDrop.setBuilders(this.getAllBuilders());
  }

  /**
   * Vincula as lentes telescópicas ao ScopeSystem
   */
  static attachScopes(scopeSystem, viewmodel) {
    if (!scopeSystem || !viewmodel?.models) return;
    for (const [id, entry] of this.#entries.entries()) {
      if (entry.hasScope && viewmodel.models[id]?.details) {
        scopeSystem.attachWeaponModel(id, viewmodel.models[id].details);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRO CANÔNICO DAS 10 ARMAS DO JOGO
// ═══════════════════════════════════════════════════════════════════════════
WeaponRegistry.register('ar15', { builder: buildHK416, category: 'rifle' });
WeaponRegistry.register('ak47', { builder: buildAK47, category: 'rifle' });
WeaponRegistry.register('p9', { builder: buildP9, category: 'pistol' });
WeaponRegistry.register('sw500', { builder: buildSW500, category: 'pistol' });
WeaponRegistry.register('m12', { builder: buildM12, category: 'shotgun' });
WeaponRegistry.register('uzi', { builder: buildUZI, category: 'smg' });
WeaponRegistry.register('m249', { builder: buildM249, category: 'heavy' });
WeaponRegistry.register('rifle_proto', { builder: buildRiflePrototype, category: 'rifle', hasScope: true });
WeaponRegistry.register('vss', { builder: buildVSS, category: 'sniper', hasScope: true });
WeaponRegistry.register('scar_h', { builder: buildSCARH, category: 'rifle', hasScope: true });

// Re-export dos builders para compatibilidade total
export {
  buildHK416,
  buildAK47,
  buildP9,
  buildSW500,
  buildM12,
  buildUZI,
  buildM249,
  buildRiflePrototype,
  buildVSS,
  buildSCARH
};
