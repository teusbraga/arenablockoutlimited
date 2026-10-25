/**
 * TacticalInventorySystem.js
 * 
 * Mecânica de Inventário Tático, Mochila e Gestão de Equipamentos (Estilo Tarkov / Arena Breakout):
 * 
 * Funcionalidades:
 * 1. Slots de Equipamento (Gear Slots):
 *    - Primária (Arma principal)
 *    - Secundária (Pistola / Saque rápido)
 *    - Colete Balístico (Body Armor com nível de blindagem e durabilidade)
 *    - Capacete (Helmet com proteção balística de cabeça)
 *    - Mochila (Backpack com capacidade em slots de grade)
 * 2. Grid de Mochila / Bolsos (Storage Slots):
 *    - Gestão de itens coletados (munições sobressalentes, kits médicos, granadas, loot de valor).
 * 3. Abertura/Fechamento com pausa do mouse e liberação de cursor (`Tab` ou `I`).
 * 4. Métodos desacoplados e orientados a eventos para interação com a UI e com os sistemas existentes.
 * 
 * Mapeamento e Pontos de Integração no Projeto:
 * - EventBus: src/core/EventBus.js (emite `inventory:opened`, `inventory:closed`, `inventory:changed`)
 * - Armas: src/weapons/WeaponSystem.js (sincronização de slots de arma e munição)
 * - Input: src/core/Input.js (tecla `Tab` / `I` e desbloqueio de cursor)
 * - HUD: src/ui/HUD.js (renderização da interface modal de inventário)
 * 
 * Godot 4.x Porting Reference:
 * - Resource base: `class_name ItemData extends Resource` com id, icon, weight, stackable.
 * - Inventory Controller: `Node` com array de slots ou dicionário de equipamentos.
 * - UI Control: `Control` com `GridContainer` e sinais `item_moved`, `item_used`, `item_dropped`.
 */

import { emit, on } from '../core/EventBus.js';

export class TacticalInventorySystem {
  constructor(options = {}) {
    this.maxWeightKg = options.maxWeightKg || 40.0;
    this.isOpen = false;

    // Equipamento corporal ativo (Equipped Gear)
    this.gear = {
      primary: options.primary || null,    // ID da arma no slot 1 (ex: 'hk416')
      secondary: options.secondary || null,  // ID da arma no slot 2 (ex: 'p9')
      armor: {
        id: 'light_vest',
        name: 'Colete Balístico Leve',
        class: 3,
        durability: 50,
        maxDurability: 50
      },
      helmet: {
        id: 'tactical_helmet',
        name: 'Capacete Tático',
        class: 2,
        durability: 30,
        maxDurability: 30
      },
      backpack: {
        id: 'scout_pack',
        name: 'Mochila de Patrulha',
        rows: 4,
        cols: 4
      }
    };

    // Itens na mochila (Grid Storage de 16 slots por padrão)
    this.storage = [
      { id: 'ammo_556', name: '5.56x45mm NATO', type: 'ammo', count: 60, maxStack: 60, icon: 'bullet' },
      { id: 'ammo_9mm', name: '9x19mm Parabellum', type: 'ammo', count: 30, maxStack: 60, icon: 'bullet' },
      { id: 'medkit', name: 'Kit Primeiros Socorros', type: 'medical', count: 1, healAmount: 50, icon: 'med' },
      { id: 'smoke_grenade', name: 'Granada de Fumaça M18', type: 'grenade', count: 2, maxStack: 2, icon: 'smoke' },
      null, null, null, null,
      null, null, null, null,
      null, null, null, null
    ];

    this._bindEvents();
  }

  _bindEvents() {
    this._unsubs = [
      on('weapon:slots', ({ slots, currentSlot }) => {
        if (slots) {
          this.gear.primary = slots[0] || null;
          this.gear.secondary = slots[1] || null;
        }
      }),
      on('inventory:toggle', () => {
        this.toggle();
      }),
      on('inventory:use_item', e => {
        const idx = typeof e === 'object' && e !== null ? (e.slotIdx ?? e.idx ?? e.slot) : e;
        this.useItem(idx);
      })
    ];
  }

  destroy() {
    if (this._unsubs) {
      for (const unsub of this._unsubs) unsub();
      this._unsubs = [];
    }
  }

  /**
   * Abre ou fecha o menu tático de inventário
   */
  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      emit('inventory:opened', { gear: this.gear, storage: this.storage });
    } else {
      emit('inventory:closed', {});
    }
    return this.isOpen;
  }

  /**
   * Adiciona um item recolhido do chão para o primeiro slot livre da mochila
   * @param {Object} item 
   * @returns {boolean} sucesso
   */
  addItem(item) {
    if (!item) return false;

    // Tenta agrupar (stack) com item existente do mesmo tipo
    if (item.maxStack && item.maxStack > 1) {
      for (const slot of this.storage) {
        if (slot && slot.id === item.id && slot.count < slot.maxStack) {
          const space = slot.maxStack - slot.count;
          const toAdd = Math.min(space, item.count);
          slot.count += toAdd;
          item.count -= toAdd;
          if (item.count <= 0) {
            emit('inventory:changed', { gear: this.gear, storage: this.storage });
            return true;
          }
        }
      }
    }

    // Procura primeiro slot vazio
    const emptyIdx = this.storage.findIndex(s => s === null);
    if (emptyIdx !== -1) {
      this.storage[emptyIdx] = { ...item };
      emit('inventory:changed', { gear: this.gear, storage: this.storage });
      return true;
    }

    emit('notification', { message: 'Mochila cheia! Descarte itens para coletar.' });
    return false;
  }

  /**
   * Remove item de um slot da mochila (descarta no chão)
   * @param {number} slotIdx 
   */
  dropItem(slotIdx) {
    if (slotIdx < 0 || slotIdx >= this.storage.length) return null;
    const item = this.storage[slotIdx];
    if (item) {
      this.storage[slotIdx] = null;
      emit('inventory:changed', { gear: this.gear, storage: this.storage });
      emit('inventory:item_dropped', { item, slotIdx });
    }
    return item;
  }

  /**
   * Usa um item da mochila (ex: kit médico)
   * @param {number} slotIdx 
   */
  useItem(slotIdx) {
    if (slotIdx < 0 || slotIdx >= this.storage.length) return false;
    const item = this.storage[slotIdx];
    if (!item) return false;

    if (item.type === 'medical') {
      emit('player:heal', { amount: item.healAmount || 40 });
      item.count--;
      if (item.count <= 0) this.storage[slotIdx] = null;
      emit('inventory:changed', { gear: this.gear, storage: this.storage });
      emit('notification', { message: `Usou ${item.name} (+${item.healAmount || 40} HP)` });
      return true;
    }

    return false;
  }

  /**
   * Calcula o peso total atual carregado pelo operador
   * @returns {number} peso em kg
   */
  getTotalWeightKg() {
    let weight = 0;
    // Peso base das armas
    if (this.gear.primary) weight += 3.5;
    if (this.gear.secondary) weight += 1.1;
    // Peso dos equipamentos
    if (this.gear.armor) weight += 5.0;
    if (this.gear.helmet) weight += 1.5;
    // Peso dos itens na mochila
    for (const item of this.storage) {
      if (item) weight += (item.weight || 0.4) * (item.count || 1);
    }
    return Number(weight.toFixed(2));
  }
}
