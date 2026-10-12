import { G } from './state.js';
const KEY = 'glimmerwild.save.v1';
export const hasSave = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
export function save() {
  if (!G.team.length) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1, seed: G.seed, p: G.player, team: G.team, storage: G.storage, orbs: G.orbs, berries: G.berries,
      skill: G.skill, bosses: G.bosses, dex: G.dex, settings: G.settings, playtime: G.playtime,
    }));
  } catch (e) { /* storage full or blocked */ }
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (!s || s.v !== 1 || !s.team || !s.team.length) return false;
    G.seed = s.seed; G.player = s.p; G.team = s.team; G.storage = s.storage || []; G.orbs = s.orbs; G.berries = s.berries;
    G.skill = s.skill; G.bosses = s.bosses || {}; G.dex = s.dex || { seen: {}, caught: {} }; G.settings = { sound: true, ...(s.settings || {}) };
    G.playtime = s.playtime || 0;
    return true;
  } catch (e) { return false; }
}
export const wipe = () => { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };
