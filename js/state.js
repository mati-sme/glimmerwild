export const G = {
  screen: 'title', seed: 1, W: 0, H: 0, u: 1, dpr: 1, safe: { t: 0, r: 0, b: 0, l: 0 },
  player: { x: 0, y: 0, dir: 0 }, team: [], storage: [], orbs: 12, berries: 3,
  skill: { lvl: 1, xp: 0 }, bosses: {}, dex: { seen: {}, caught: {} }, settings: { sound: true }, playtime: 0,
  world: null, wilds: [], ui: {}, toast: null, time: 0,
};
export const skillNeed = (lvl) => Math.floor(25 * Math.pow(lvl, 1.5));
export const SKILL_MAX = 25;
export function gainSkill(xp) {
  G.skill.xp += xp; let up = 0;
  while (G.skill.lvl < SKILL_MAX && G.skill.xp >= skillNeed(G.skill.lvl)) { G.skill.xp -= skillNeed(G.skill.lvl); G.skill.lvl++; up++; }
  return up;
}
export const toast = (text, sec = 2.4) => { G.toast = { text, t: sec }; };
export function addCreature(c) {
  G.dex.seen[c.sp] = 1; G.dex.caught[c.sp] = 1;
  if (G.team.length < 6) { G.team.push(c); return 'team'; }
  G.storage.push(c); return 'storage';
}
