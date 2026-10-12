// Seeded tile world generation, collision, wild spawning. DOM-free.
import { fbm, valueNoise, hash2, mulberry32, hashStr, clamp, pick } from './util.js';
import { BIOME, BIOME_KEYS, BOSSES, SPECIES } from './data.js';
import { makeCreature } from './creature.js';

export const N = 240;
export const T = { WATER: 0, SAND: 1, GRASS: 2, TALL: 3, FOREST: 4, TREE: 5, DESERT: 6, CACTUS: 7, SNOW: 8, PINE: 9, SWAMP: 10, BOG: 11, DEADTREE: 12, ASH: 13, LAVA: 14, ROCK: 15, SHRINE: 16, FLOWER: 17, ICE: 18, BOULDER: 19 };
export const NTILES = 20;
const SOLID = new Uint8Array(NTILES);
[T.WATER, T.TREE, T.CACTUS, T.PINE, T.DEADTREE, T.LAVA, T.ROCK, T.SHRINE, T.BOULDER].forEach((t) => (SOLID[t] = 1));
const SLOW = { [T.SAND]: 0.9, [T.BOG]: 0.7, [T.SNOW]: 0.88, [T.SWAMP]: 0.9 };
export const isSolidTile = (t) => SOLID[t] === 1;
export const FLOOR = [T.WATER, T.SAND, T.GRASS, T.FOREST, T.DESERT, T.SNOW, T.SWAMP, T.ASH];

export function generate(seed) {
  const tiles = new Uint8Array(N * N), biome = new Uint8Array(N * N);
  const c = N / 2;
  const E = new Float32Array(N * N), TT = new Float32Array(N * N), MM = new Float32Array(N * N);
  const landT = [], landM = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - c, y - c) / c;
    let e = (fbm(x / 38, y / 38, seed, 4) - 0.5) * 1.9 + 0.5;
    e = e - Math.pow(d, 2.6) * 0.62 + 0.14;
    if (d < 0.14) e = Math.max(e, 0.5);
    const i = y * N + x;
    E[i] = e;
    TT[i] = fbm(x / 70 + 100, y / 70, seed + 7, 3) * 0.55 + (y / N) * 0.45;
    MM[i] = fbm(x / 45 - 70, y / 45 + 30, seed + 13, 3);
    if (e >= 0.35) { landT.push(TT[i]); landM.push(MM[i]); }
  }
  const q = (arr, p) => { const s = Float32Array.from(arr).sort(); return s[Math.floor(s.length * p)]; };
  const tCold = q(landT, 0.17), tHot = q(landT, 0.66), tLava = q(landT, 0.9);
  const mDry = q(landM, 0.5), mWet = q(landM, 0.74), mFor = q(landM, 0.56);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - c, y - c) / c;
    const i = y * N + x, e = E[i], t = TT[i], m = MM[i];
    let b;
    if (e < 0.3) b = BIOME.WATER;
    else if (e < 0.35) b = BIOME.SHORE;
    else if (t > tLava && e > 0.42) b = BIOME.VOLCANO;
    else if (t > tHot && m < mDry) b = BIOME.DESERT;
    else if (t < tCold) b = BIOME.SNOW;
    else if (m > mWet && t < tHot) b = BIOME.SWAMP;
    else if (m > mFor) b = BIOME.FOREST;
    else b = BIOME.MEADOW;
    if (d < 0.09) b = BIOME.MEADOW;
    biome[i] = b;
    const h = hash2(x, y, seed + 3);
    const n5 = valueNoise(x / 4, y / 4, seed + 5);
    let tl;
    switch (b) {
      case BIOME.WATER: tl = T.WATER; break;
      case BIOME.SHORE: tl = T.SAND; break;
      case BIOME.MEADOW: tl = h > 0.975 ? T.TREE : n5 > 0.62 ? T.TALL : h < 0.04 ? T.FLOWER : T.GRASS; break;
      case BIOME.FOREST: tl = h < 0.22 ? T.TREE : T.FOREST; break;
      case BIOME.DESERT: tl = h < 0.05 ? T.CACTUS : h < 0.08 ? T.BOULDER : T.DESERT; break;
      case BIOME.SNOW: tl = h < 0.13 ? T.PINE : n5 > 0.7 ? T.ICE : T.SNOW; break;
      case BIOME.SWAMP: tl = h < 0.07 ? T.DEADTREE : n5 > 0.56 ? T.BOG : T.SWAMP; break;
      default: tl = valueNoise(x / 5, y / 5, seed + 9) > 0.7 ? T.LAVA : h < 0.08 ? T.ROCK : T.ASH;
    }
    tiles[i] = tl;
  }
  const spawn = { x: c + 0.5, y: c + 0.5 };
  const shrine = { x: c + 3, y: c - 2 };
  tiles[shrine.y * N + shrine.x] = T.SHRINE;
  const w = { seed, tiles, biome, spawn, shrine, bosses: [] };

  // reachability from spawn (4-neighbour flood fill)
  const reach = new Uint8Array(N * N);
  const fq = [Math.floor(spawn.y) * N + Math.floor(spawn.x)];
  reach[fq[0]] = 1;
  for (let qi = 0; qi < fq.length; qi++) {
    const i = fq[qi], x = i % N, y = (i / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const j = ny * N + nx;
      if (!reach[j] && !SOLID[tiles[j]]) { reach[j] = 1; fq.push(j); }
    }
  }
  w.reach = reach;

  const rng = mulberry32(seed ^ 0x9e3779b9);
  const floorFor = [T.SAND, T.SAND, T.GRASS, T.FOREST, T.DESERT, T.SNOW, T.SWAMP, T.ASH];
  for (const cfg of BOSSES) {
    const bi = BIOME_KEYS.indexOf(cfg.biome);
    const cand = [];
    let far = null, farD = -1;
    for (let y = 3; y < N - 3; y++) for (let x = 3; x < N - 3; x++) {
      const i = y * N + x;
      if (!reach[i] || biome[i] !== bi) continue;
      const d = Math.hypot(x - c, y - c);
      let ok = true;
      for (let oy = -1; oy <= 1 && ok; oy++) for (let ox = -1; ox <= 1; ox++) if (SOLID[tiles[(y + oy) * N + x + ox]]) { ok = false; break; }
      if (d > farD) { farD = d; far = { x, y }; }
      if (ok && d >= cfg.minDist && d < 105) cand.push({ x, y });
    }
    const p = cand.length ? pick(rng, cand) : far;
    if (!p) continue;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { tiles[(p.y + oy) * N + p.x + ox] = floorFor[bi]; reach[(p.y + oy) * N + p.x + ox] = 1; }
    w.bosses.push({ ...cfg, x: p.x + 0.5, y: p.y + 0.5, c: makeCreature(cfg.sp, cfg.lv, mulberry32(hashStr(cfg.id) ^ seed), { boss: true, name: cfg.name }) });
  }
  return w;
}

export const tileAt = (w, x, y) => (x < 0 || y < 0 || x >= N || y >= N ? T.WATER : w.tiles[y * N + x]);
export const biomeAt = (w, x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : w.biome[y * N + x]);
export const speedAt = (w, x, y) => SLOW[tileAt(w, Math.floor(x), Math.floor(y))] || 1;
const blocked = (w, x, y) => SOLID[tileAt(w, Math.floor(x), Math.floor(y))] === 1;
const blockedBox = (w, x, y, r) => blocked(w, x - r, y - r * 0.4) || blocked(w, x + r, y - r * 0.4) || blocked(w, x - r, y + r * 0.4) || blocked(w, x + r, y + r * 0.4);

export function moveEntity(w, e, dx, dy, r = 0.28) {
  if (!blockedBox(w, e.x + dx, e.y, r)) e.x += dx; else dx = 0;
  if (!blockedBox(w, e.x, e.y + dy, r)) e.y += dy; else dy = 0;
  return dx !== 0 || dy !== 0;
}

// --- wild spawning ---
const SPECIES_BY_BIOME = {};
for (const s of SPECIES) for (const b of s.biomes) (SPECIES_BY_BIOME[b] = SPECIES_BY_BIOME[b] || []).push(s);

export function wildLevel(w, x, y, rng) {
  const d = Math.hypot(x - N / 2, y - N / 2);
  return clamp(Math.round(2 + d / 6 + (rng() * 4 - 2)), 2, 48);
}

export function trySpawnWild(w, px, py, rng = Math.random) {
  const a = rng() * Math.PI * 2, dist = 8 + rng() * 9;
  const x = Math.floor(px + Math.cos(a) * dist), y = Math.floor(py + Math.sin(a) * dist);
  if (x < 2 || y < 2 || x >= N - 2 || y >= N - 2) return null;
  const i = y * N + x;
  if (!w.reach[i] || SOLID[w.tiles[i]]) return null;
  const list = SPECIES_BY_BIOME[BIOME_KEYS[w.biome[i]]];
  if (!list) return null;
  const sp = pick(rng, list);
  const c = makeCreature(sp.id, wildLevel(w, x, y, rng), rng);
  return { c, x: x + 0.5, y: y + 0.5, tx: x + 0.5, ty: y + 0.5, wait: rng() * 2, dir: 1, biome: BIOME_KEYS[w.biome[i]], bob: rng() * 6 };
}
