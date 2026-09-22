const listeners = new Map();

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => off(type, fn);
}
export function off(type, fn) {
  listeners.get(type)?.delete(fn);
}
export function emit(type, detail) {
  const set = listeners.get(type);
  if (!set) return;
  for (const fn of set) {
    try { fn(detail); } catch (err) { console.error(`[bus:${type}]`, err); }
  }
}