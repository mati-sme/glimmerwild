import { G } from './state.js';
// v2 lives under a new key; the v1 key is only ever read (migrated), never overwritten.
const KEY = 'glimmerwild.save.v2', OLD = 'glimmerwild.save.v1';
const raw = () => { try { return localStorage.getItem(KEY) || localStorage.getItem(OLD); } catch (e) { return null; } };
export const hasSave = () => !!raw();
export function save() {
  if (!G.team.length) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 2, seed: G.seed, p: { x: G.player.x, y: G.player.y, dir: G.player.dir }, team: G.team, storage: G.storage, orbs: G.orbs, berries: G.berries,
      skill: G.skill, bosses: G.bosses, dex: G.dex, settings: G.settings, playtime: G.playtime,
      gear: G.gear, mats: G.mats, vials: G.vials, quests: G.quests, hp: G.hp, stats: G.stats,
    }));
  } catch (e) { /* storage full or blocked */ }
}
export function load() {
  try {
    const s = JSON.parse(raw());
    if (!s || !(s.v === 1 || s.v === 2) || !s.team || !s.team.length) return false;
    G.seed = s.seed; G.player = s.p; G.team = s.team; G.storage = s.storage || []; G.orbs = s.orbs; G.berries = s.berries;
    G.skill = s.skill; G.bosses = s.bosses || {}; G.dex = s.dex || { seen: {}, caught: {} }; G.settings = { sound: true, ...(s.settings || {}) };
    G.playtime = s.playtime || 0;
    // fields added in v2 get safe defaults for old saves
    G.gear = { w: 0, a: 0, ...(s.gear || {}) };
    G.mats = { hide: 0, fang: 0, gem: 0, core: 0, ...(s.mats || {}) };
    G.vials = s.vials || {};
    G.quests = { done: {}, prog: {}, ...(s.quests || {}) };
    G.stats = s.stats || {};
    G.hp = typeof s.hp === 'number' ? s.hp : null;
    for (const c of G.team.concat(G.storage)) { if (!c.traits) c.traits = []; if (c.gen === undefined) c.gen = 0; if (c.trainAt === undefined) c.trainAt = 0; }
    return true;
  } catch (e) { return false; }
}
export const wipe = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(OLD); } catch (e) { /* ignore */ } };
