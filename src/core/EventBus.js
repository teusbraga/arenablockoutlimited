const listeners = new Map();

/**
 * Catálogo canônico de tópicos do EventBus (padrão dominio:acao).
 */
export const CANONICAL_EVENTS = Object.freeze([
  // input:*
  'input:lock',
  'input:zoom-toggle',

  // weapon:*
  'weapon:fired',
  'weapon:empty',
  'weapon:pump',
  'weapon:reload:start',
  'weapon:reload:end',
  'weapon:qte:start',
  'weapon:qte:update',
  'weapon:qte:result',
  'weapon:qte:stop',
  'weapon:ammo',
  'weapon:equipped',
  'weapon:firemode',
  'weapon:slots',
  'weapon:select_slot',
  'weapon:cycle',
  'weapon:magazine_dropped',
  'weapon:smoke:residual',
  'weapon:manual_eject_fx',

  // projectile:* / tracer:* / shot:*
  'projectile:spawned',
  'tracer:fire',
  'shot:world',
  'shot:bot',
  'shot:ricochet',
  'shot:penetration',

  // player:*
  'player:hp',
  'player:damaged',
  'player:suppression',
  'player:died',
  'player:respawn',
  'player:respawn_tick',
  'player:footstep',
  'player:ads',
  'player:skinChanged',
  'player:perspective_changed',
  'player:heal',

  // bot:*
  'bot:alerted',
  'bot:damaged',
  'bot:died',
  'bot:fired',
  'bot:suppressed',

  // game:* / round:* / kill:*
  'game:reset',
  'round:timer',
  'round:over',
  'kill:combo',

  // hud:* / notification / interact:*
  'notification',
  'hud:popup',
  'interact:target',

  // inventory:*
  'inventory:opened',
  'inventory:closed',
  'inventory:changed',
  'inventory:toggle',
  'inventory:use_item',
  'inventory:item_dropped',

  // crosshair:* / cheat:* / door:* / smoke:*
  'crosshair:change',
  'crosshair:reset',
  'crosshair:updated',
  'cheat:activated',
  'door:toggle',
  'smoke:detonate',
  'smoke:stop',
  'smoke:bounce',
  'smoke:thrown'
]);

const canonicalSet = new Set(CANONICAL_EVENTS);

let _devMode = false;

/**
 * Ativa ou desativa o modo de diagnóstico do EventBus.
 * @param {boolean} enabled
 */
export function setDevMode(enabled) {
  _devMode = !!enabled;
}

/**
 * Retorna se o modo Dev está ativo (via setDevMode ou CONFIG.DEV_MODE).
 * @returns {boolean}
 */
export function isDevMode() {
  return _devMode || !!(globalThis.CONFIG?.DEV_MODE);
}

export function isCanonicalEvent(type) {
  return canonicalSet.has(type);
}

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => off(type, fn);
}

export function off(type, fn) {
  listeners.get(type)?.delete(fn);
}

// Removido clearBus para evitar apocalipse global de eventos. Use unsub() e destroy() no lugar.
export function emit(type, detail = {}) {
  const isDev = isDevMode();
  if (isDev && !canonicalSet.has(type)) {
    console.warn(`[EventBus] Tópico desconhecido / não canônico: '${type}'`);
  }

  // Regra de Ouro: todo evento transporta um objeto
  const payload = (typeof detail === 'object' && detail !== null) ? detail : { value: detail };
  const set = listeners.get(type);
  if (!set || set.size === 0) {
    if (isDev) {
      console.warn(`[EventBus] Disparado no vácuo (0 listeners): ${type}`);
    }
    return;
  }
  for (const fn of set) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[bus:${type}]`, err);
    }
  }
}
