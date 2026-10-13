import { G } from './state.js';
// v3 lives under its own key; the v2 / v1 keys are only ever read (migrated), never overwritten.
const KEY = 'glimmerwild.save.v3', OLDER = ['glimmerwild.save.v2', 'glimmerwild.save.v1'];
const raw = () => { try { for (const k of [KEY, ...OLDER]) { const v = localStorage.getItem(k); if (v) return v; } } catch (e) { /* blocked */ } return null; };
export const hasSave = () => !!raw();
export function save() {
  if (!G.team.length) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 3, seed: G.seed, p: { x: G.player.x, y: G.player.y, dir: G.player.dir }, team: G.team, storage: G.storage, orbs: G.orbs, berries: G.berries,
      skill: G.skill, bosses: G.bosses, dex: G.dex, settings: G.settings, playtime: G.playtime,
      gear: G.gear, mats: G.mats, vials: G.vials, quests: G.quests, hp: G.hp, stats: G.stats, essence: G.essence, fuseSlots: G.fuseSlots,
    }));
  } catch (e) { /* storage full or blocked */ }
}
export function load() {
  try {
    const s = JSON.parse(raw());
    if (!s || !(s.v === 1 || s.v === 2 || s.v === 3) || !s.team || !s.team.length) return false;
    G.seed = s.seed; G.player = s.p; G.team = s.team; G.storage = s.storage || []; G.orbs = s.orbs; G.berries = s.berries;
    G.skill = s.skill; G.bosses = s.bosses || {}; G.dex = s.dex || { seen: {}, caught: {} }; G.settings = { sound: true, petAuto: true, ...(s.settings || {}) };
    G.playtime = s.playtime || 0;
    // fields added in v2 get safe defaults for old saves
    G.gear = { w: 0, a: 0, ...(s.gear || {}) };
    G.mats = { hide: 0, fang: 0, gem: 0, core: 0, ...(s.mats || {}) };
    G.vials = s.vials || {};
    G.quests = { done: {}, prog: {}, ...(s.quests || {}) };
    G.stats = s.stats || {};
    // fields added in v3
    G.essence = typeof s.essence === 'number' ? s.essence : 0;
    G.fuseSlots = Array.isArray(s.fuseSlots) && s.fuseSlots.length === 2 ? s.fuseSlots.map((t) => +t || 0) : [0, 0];
    G.hp = typeof s.hp === 'number' ? s.hp : null;
    for (const c of G.team.concat(G.storage)) { if (!c.traits) c.traits = []; if (c.gen === undefined) c.gen = 0; if (c.trainAt === undefined) c.trainAt = 0; }
    return true;
  } catch (e) { return false; }
}
export const wipe = () => { try { for (const k of [KEY, ...OLDER]) localStorage.removeItem(k); } catch (e) { /* ignore */ } };
