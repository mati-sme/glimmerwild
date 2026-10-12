// Creature instances: genes, stats, XP, moves, damage, fusion. DOM-free.
import { SPECIES_BY_ID, MOVES, TRAITS, TRAIT_LIST, TYPE_STRONG } from './data.js';
import { mulberry32, hashStr, clamp, pick, lerpHue } from './util.js';

export const MAXLV = 60;
let uidc = 0;
export const uid = () => Date.now().toString(36) + (uidc++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
const r = (n) => Math.round(n);

export function makeCreature(spId, lv, rng = Math.random, o = {}) {
  const sp = SPECIES_BY_ID[spId];
  const g = sp.g;
  const jit = (c, a, b, d) => [r((c[0] + rng() * a * 2 - a + 360) % 360), r(clamp(c[1] + rng() * b * 2 - b, 15, 100)), r(clamp(c[2] + rng() * d * 2 - d, 22, 90))];
  const genes = {
    body: g.body, f1: g.f1, f2: g.f2, eye: g.eye, pat: g.pat, mouth: g.mouth,
    c1: jit(g.c1, 12, 6, 6), c2: jit(g.c2, 12, 6, 6),
    size: +(0.92 + rng() * 0.18).toFixed(2), sd: Math.floor(rng() * 1e6),
  };
  const base = sp.base.map((b) => r(b * (0.88 + rng() * 0.24)));
  let traits = [];
  if (o.boss) traits = ['Titan'];
  else if (rng() < 0.3) { traits = [pick(rng, TRAIT_LIST)]; if (rng() < 0.08) { const t = pick(rng, TRAIT_LIST); if (!traits.includes(t)) traits.push(t); } }
  const c = { id: uid(), sp: spId, name: o.name || sp.name, lv, xp: 0, g: genes, types: [...sp.types], base, traits, hp: 0, gen: 0, trainAt: 0 };
  c.hp = maxHp(c);
  return c;
}

export function traitMult(c, k) {
  let m = 1;
  for (const t of c.traits) m *= (TRAITS[t] && TRAITS[t].mult[k]) || 1;
  return m;
}
export const maxHp = (c) => Math.floor((Math.floor((c.base[0] * c.lv) / 18) + c.lv + 14) * traitMult(c, 'hp'));
export function stat(c, k) {
  const i = { atk: 1, def: 2, spd: 3 }[k];
  return Math.floor((Math.floor((c.base[i] * c.lv) / 22) + 6) * traitMult(c, k));
}
export const xpNeed = (lv) => Math.floor(12 + lv * lv * 1.5);

export function learnset(c) {
  const [a, b] = c.types;
  const L = [['plain', 1], [a + '1', 2]];
  if (b) L.push([b + '1', 5]);
  L.push([a + '2', 9]);
  if (b) L.push([b + '2', 13]);
  L.push([a + '3', 17]);
  if (b) L.push([b + '3', 23]);
  return L.map(([id, lv]) => ({ m: MOVES[id], lv }));
}
export const movesOf = (c) => learnset(c).filter((x) => x.lv <= c.lv).map((x) => x.m).slice(-4);

export function gainXp(c, amt) {
  const ev = [];
  if (c.lv >= MAXLV) return ev;
  c.xp += Math.round(amt * (c.traits.includes('Bright') ? 1.25 : 1));
  while (c.lv < MAXLV && c.xp >= xpNeed(c.lv)) {
    c.xp -= xpNeed(c.lv);
    const before = maxHp(c);
    c.lv++;
    if (c.hp > 0) c.hp = Math.min(maxHp(c), c.hp + (maxHp(c) - before));
    ev.push({ lv: c.lv, learned: learnset(c).filter((x) => x.lv === c.lv).map((x) => x.m.name) });
  }
  return ev;
}

export function effect(mt, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    if (TYPE_STRONG[mt] && TYPE_STRONG[mt].includes(d)) m *= 2;
    else if (TYPE_STRONG[d] && TYPE_STRONG[d].includes(mt)) m *= 0.5;
  }
  return m;
}

export function calcDamage(a, d, mv, rng = Math.random) {
  let dmg = (((2 * a.lv) / 5 + 2) * mv.power * stat(a, 'atk') / stat(d, 'def')) / 30 + 2;
  if (a.types.includes(mv.type)) dmg *= 1.3;
  const eff = effect(mv.type, d.types);
  dmg *= eff;
  const crit = rng() < (a.traits.includes('Lucky') ? 0.12 : 0.04);
  if (crit) dmg *= 1.5;
  dmg *= 0.85 + rng() * 0.15;
  return { dmg: Math.max(1, Math.floor(dmg)), eff, crit };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
function fusedName(a, b) {
  const A = a.name, B = b.name;
  const n = cap(A.slice(0, Math.ceil(A.length / 2)) + B.slice(Math.floor(B.length / 2)).toLowerCase());
  return n.length > 11 ? n.slice(0, 11) : n;
}

// Deterministic from the two parents, so the preview equals the result.
export function fuse(a, b) {
  const rng = mulberry32(hashStr([a.id, b.id].sort().join('|')));
  const of = (x, y) => (rng() < 0.5 ? x : y);
  const base = [0, 1, 2, 3].map((i) => {
    const hi = Math.max(a.base[i], b.base[i]), avg = (a.base[i] + b.base[i]) / 2;
    return r((rng() < 0.5 ? hi : avg) * (1.04 + rng() * 0.1));
  });
  const lv = Math.max(1, r(((a.lv + b.lv) / 2) * 0.7));
  const t1 = of(a.types[0], b.types[0]);
  const others = [...new Set([a.types[0], b.types[0], a.types[1], b.types[1]].filter((t) => t && t !== t1))];
  const types = [t1];
  if (others.length && rng() < 0.7) types.push(others[Math.floor(rng() * others.length)]);
  const ga = a.g, gb = b.g;
  const w = 0.5 + (rng() - 0.5) * 0.4;
  const mixC = (x, y) => [r(lerpHue(x[0], y[0], w)), r(x[1] + (y[1] - x[1]) * w), r(x[2] + (y[2] - x[2]) * w)];
  const mut = (v, max) => (rng() < 0.06 ? Math.floor(rng() * max) : v);
  const f1 = mut(of(ga.f1, gb.f1), 10);
  let f2 = mut(of(ga.f2, gb.f2), 10);
  if (f2 === f1) f2 = 0;
  const genes = {
    body: mut(of(ga.body, gb.body), 5), f1, f2, eye: mut(of(ga.eye, gb.eye), 5), pat: of(ga.pat, gb.pat), mouth: of(ga.mouth, gb.mouth),
    c1: mixC(ga.c1, gb.c1), c2: mixC(of(ga.c2, gb.c2), of(ga.c1, gb.c1)),
    size: +clamp((ga.size + gb.size) / 2 + (rng() - 0.5) * 0.08, 0.88, 1.12).toFixed(2), sd: Math.floor(rng() * 1e6),
  };
  const traits = [];
  for (const t of [...a.traits, ...b.traits]) if (t !== 'Titan' && !traits.includes(t) && rng() < 0.65) traits.push(t);
  if (traits.length < 2 && rng() < 0.2) { const t = pick(rng, TRAIT_LIST); if (!traits.includes(t)) traits.push(t); }
  const c = {
    id: uid(), sp: of(a.sp, b.sp), name: fusedName(a, b), lv, xp: 0, g: genes, types, base,
    traits: traits.slice(0, 2), hp: 0, gen: Math.max(a.gen, b.gen) + 1, trainAt: 0,
  };
  c.hp = maxHp(c);
  return c;
}
