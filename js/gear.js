// Player gear tiers, materials and crafting costs. DOM-free.
import { G, toast, stat1 } from './state.js';

export const MATS = {
  hide: { name: 'Hide', color: '#b8803c' },
  fang: { name: 'Fang', color: '#f4f0d8' },
  gem: { name: 'Gem', color: '#58c8f0' },
  core: { name: 'Core', color: '#f0508c' },
};
export const MAT_KEYS = Object.keys(MATS);

export const WEAPONS = [
  { name: 'Twig Stick', dmg: 9, reach: 1.5, cost: null },
  { name: 'Bone Blade', dmg: 15, reach: 1.6, cost: { hide: 6 } },
  { name: 'Fang Sword', dmg: 24, reach: 1.7, cost: { hide: 12, fang: 6 } },
  { name: 'Gem Saber', dmg: 36, reach: 1.8, cost: { hide: 16, fang: 10, gem: 4 } },
  { name: 'Core Cleaver', dmg: 52, reach: 1.9, cost: { fang: 20, gem: 10, core: 2 } },
  { name: 'Glimmerblade', dmg: 75, reach: 2.1, cost: { gem: 24, core: 4 } },
];
export const ARMORS = [
  { name: 'Cloth Tunic', def: 0, hp: 60, cost: null },
  { name: 'Hide Vest', def: 10, hp: 80, cost: { hide: 8 } },
  { name: 'Fang Mail', def: 22, hp: 105, cost: { hide: 14, fang: 8 } },
  { name: 'Gem Plate', def: 38, hp: 135, cost: { hide: 18, fang: 10, gem: 6 } },
  { name: 'Core Armor', def: 58, hp: 170, cost: { fang: 20, gem: 12, core: 2 } },
  { name: 'Glimmer Aegis', def: 85, hp: 210, cost: { gem: 26, core: 4 } },
];
export const weapon = () => WEAPONS[G.gear.w];
export const armor = () => ARMORS[G.gear.a];
export const playerMaxHp = () => armor().hp;

export const canAfford = (cost) => !!cost && Object.entries(cost).every(([k, n]) => (G.mats[k] || 0) >= n);
// kind: 'w' | 'a'. Returns true when upgraded.
export function upgrade(kind) {
  const list = kind === 'w' ? WEAPONS : ARMORS, next = list[G.gear[kind] + 1];
  if (!next || !canAfford(next.cost)) return false;
  for (const [k, n] of Object.entries(next.cost)) G.mats[k] -= n;
  G.gear[kind]++;
  if (kind === 'a') G.hp = playerMaxHp();
  stat1('crafts');
  return true;
}

// Materials a defeated mob drops: [{k, n}]. `essence` is a separate counter (G.essence) used for fusion; it shows up here as k:'essence'.
// opts: { boss, elite }
export function rollDrops(lv, o = false, rng = Math.random) {
  const boss = o === true || !!(o && o.boss), elite = !!(o && o.elite);
  const d = [{ k: 'hide', n: 1 + (rng() < 0.5 ? 1 : 0) + (elite ? 2 : 0) }];
  if (rng() < 0.35 + Math.min(0.3, lv * 0.01) || elite) d.push({ k: 'fang', n: elite ? 2 : 1 });
  if (rng() < 0.08 + Math.min(0.25, lv * 0.006) + (elite ? 0.4 : 0)) d.push({ k: 'gem', n: elite ? 2 : 1 });
  if (elite && rng() < 0.12) d.push({ k: 'core', n: 1 });
  if (boss) d.push({ k: 'gem', n: 6 }, { k: 'core', n: 2 }, { k: 'fang', n: 6 });
  const ess = boss ? 12 : elite ? 3 + (rng() < 0.5 ? 1 : 0) : rng() < 0.22 ? 1 : 0;
  if (ess) d.push({ k: 'essence', n: ess });
  return d;
}
export function addMats(drops) {
  for (const { k, n } of drops) { if (k === 'essence') { G.essence = (G.essence || 0) + n; stat1('essence', n); } else G.mats[k] = (G.mats[k] || 0) + n; }
}
export const matText = (drops) => drops.map((d) => `${d.k === 'essence' ? 'Essence' : MATS[d.k].name} x${d.n}`).join(' ');
export { toast };
