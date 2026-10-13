// Fusion rules: level gate, compatible types, essence cost, and limited fusion slots with a cooldown. DOM-free.
import { G } from './state.js';

export const FUSE_CD_MS = 5 * 60 * 1000; // each slot rests this long after a fusion
export const FUSE_SLOTS = 2;
// type pairs that may fuse even when the parents share no type
export const RECIPES = [['leaf', 'tide'], ['flame', 'terra'], ['frost', 'tide'], ['volt', 'murk'], ['volt', 'leaf'], ['flame', 'volt'], ['frost', 'leaf'], ['murk', 'terra']];

export const needLevel = (c) => Math.min(45, 10 + 5 * (c.gen || 0)); // fresh creatures Lv10, each fusion generation +5
export function compatible(a, b) {
  if (a.types.some((t) => b.types.includes(t))) return true;
  return a.types.some((x) => b.types.some((y) => RECIPES.some(([p, q]) => (p === x && q === y) || (p === y && q === x))));
}
export const fuseCost = (a, b) => 6 + 5 * Math.max(a.gen || 0, b.gen || 0) + Math.floor((a.lv + b.lv) / 10);

// index of a free slot (or -1) and ms until the soonest slot frees up
export function slotState(now = Date.now()) {
  const slots = G.fuseSlots || [0, 0];
  const free = slots.findIndex((t) => t <= now);
  return { free, wait: free >= 0 ? 0 : Math.min(...slots) - now, slots };
}
export const slotFrac = (i, now = Date.now()) => Math.max(0, Math.min(1, ((G.fuseSlots || [0, 0])[i] - now) / FUSE_CD_MS));

// Everything the lab needs to show and gate on. a/b may be null.
export function fuseReq(a, b, now = Date.now()) {
  const na = a ? needLevel(a) : 10, nb = b ? needLevel(b) : 10;
  const lvA = !a || a.lv >= na, lvB = !b || b.lv >= nb;
  const typeOk = !a || !b || compatible(a, b);
  const cost = a && b ? fuseCost(a, b) : 0, have = G.essence || 0, ess = have >= cost;
  const s = slotState(now);
  const ready = !!(a && b) && lvA && lvB && typeOk && ess && s.free >= 0;
  return { needA: na, needB: nb, lvA, lvB, typeOk, cost, have, ess, slot: s.free, wait: s.wait, ready };
}
// Pays the cost and starts the cooldown. Returns false when requirements are not met.
export function payFusion(a, b, now = Date.now()) {
  const r = fuseReq(a, b, now); if (!r.ready) return false;
  G.essence -= r.cost; G.fuseSlots[r.slot] = now + FUSE_CD_MS;
  return true;
}
