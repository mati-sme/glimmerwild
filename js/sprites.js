// Procedural pixel art: creatures (from genes), tiles, player, orb, world map image.
import { hsl, clamp, mulberry32, hash2 } from './util.js';
import { T, NTILES, N } from './world.js';

const S = 24;
const cache = new Map();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const shade = (c, dl) => hsl(c[0], c[1], clamp(c[2] + dl, 6, 96));

function renderCreature(g) {
  const grid = new Array(S * S).fill(null);
  const put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < S && y < S) grid[y * S + x] = c; };
  const has = (x, y) => x >= 0 && y >= 0 && x < S && y < S && grid[y * S + x] !== null;
  const base = shade(g.c1, 0), lite = shade(g.c1, 13), dark = shade(g.c1, -14), deep = shade(g.c1, -26);
  const a2 = shade(g.c2, 0), a2l = shade(g.c2, 12), a2d = shade(g.c2, -14);
  const OUT = hsl(g.c1[0], Math.min(g.c1[1], 40), 12);
  const sz = g.size, sq = (v) => v * v;
  let test;
  switch (g.body) {
    case 1: test = (dx, dy) => sq(dx / (5.6 * sz)) + sq(dy / (8.2 * sz)) <= 1; break;
    case 2: test = (dx, dy) => sq(dx / (8.4 * sz)) + sq(dy / (5.2 * sz)) <= 1; break;
    case 3: test = (dx, dy) => sq(dx / (7.4 * sz)) + sq((dy - 2.2) / (6 * sz)) <= 1 || sq(dx / (4.8 * sz)) + sq((dy + 4.4) / (4.6 * sz)) <= 1; break;
    case 4: test = (dx, dy) => Math.pow(Math.abs(dx) / (7.2 * sz), 4) + Math.pow(Math.abs(dy) / (6.6 * sz), 4) <= 1; break;
    default: test = (dx, dy) => sq(dx / (7.4 * sz)) + sq(dy / (6.8 * sz)) <= 1;
  }
  const cells = [];
  let T0 = S, B0 = 0, L = S, R = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (test(x + 0.5 - 12, y + 0.5 - 12)) {
    cells.push([x, y]); T0 = Math.min(T0, y); B0 = Math.max(B0, y); L = Math.min(L, x); R = Math.max(R, x);
  }
  const shift = 20 - B0;
  const top = T0 + shift, bot = 20, w = R - L + 1, h = bot - top + 1, mx = 11.5, my = (top + bot) / 2;
  const topAt = (x) => { for (let y = 0; y < S; y++) if (has(x, y)) return y; return top; };
  const rng = mulberry32(g.sd);

  // --- behind-body features ---
  const wing = (dir) => {
    for (let i = 0; i < 6; i++) for (let y = Math.round(my - 3 - i * 0.8); y <= Math.round(my + 2 - i * 0.2); y++) {
      put(dir < 0 ? L - i : R + i, y, i === 5 || y === Math.round(my + 2 - i * 0.2) ? a2d : a2l);
    }
  };
  if (g.f1 === 4 || g.f2 === 4) { wing(-1); wing(1); }
  if (g.f1 === 6 || g.f2 === 6) {
    for (const d of [-1, 1]) for (let k = 0; k < 4; k++) for (let j = 0; j <= 3 - k; j++) put(d < 0 ? L - 1 - k : R + 1 + k, my + 1 + j + (k >> 1), a2);
  }
  if (g.f1 === 3 || g.f2 === 3) {
    const pts = [[0, -3], [1, -3], [2, -4], [3, -5], [3, -7], [4, -8]];
    pts.forEach(([ox, oy], i) => { const c = i > 3 ? a2l : dark; put(R - 1 + ox, bot + oy, c); put(R - 1 + ox, bot + oy + 1, c); });
  }
  // --- body fill with shading ---
  for (const [x, y] of cells) {
    const nx = (x - mx) / (w / 2), ny = (y + shift - my) / (h / 2), s = -(nx * 0.6 + ny * 0.8);
    put(x, y + shift, s > 0.45 ? lite : s < -0.5 ? dark : base);
  }
  // --- front features ---
  const feat = [g.f1, g.f2];
  if (feat.includes(1)) for (const sx of [-0.27, 0.27]) {
    const ex = Math.round(mx + w * sx), tp = topAt(ex);
    for (let k = 0; k < 5; k++) { const hw = k < 2 ? 2 : k < 4 ? 1 : 0; for (let dx = -hw; dx <= hw; dx++) put(ex + dx, tp - k + 1, k < 3 && dx === 0 ? a2 : base); }
  }
  if (feat.includes(2)) {
    const tp = topAt(Math.round(mx));
    for (let k = 0; k < 5; k++) { const hw = k < 3 ? 1 : 0; for (let dx = -hw; dx <= hw; dx++) put(11 + dx, tp - k + 1, dx > 0 ? '#c8b888' : '#f2e8c0'); }
  }
  if (feat.includes(5)) for (let x = Math.round(mx) - 6; x <= Math.round(mx) + 6; x += 3) {
    if (!has(x, topAt(x)) ) continue;
    const tp = topAt(x);
    put(x, tp - 2, a2l); put(x - 1, tp - 1, a2); put(x, tp - 1, a2l); put(x + 1, tp - 1, a2); put(x, tp, a2d);
  }
  if (feat.includes(6)) {
    const tp = topAt(12);
    for (let k = 0; k < 5; k++) for (let x = 11 - 1; x <= 12 + 2 - k; x++) put(x, tp - k, k === 4 ? a2l : a2);
  }
  if (feat.includes(7)) for (const sx of [-3, 3]) {
    const x0 = 12 + sx - (sx > 0 ? 1 : 0), tp = topAt(x0);
    for (let k = 0; k < 5; k++) put(x0 + Math.round(sx * 0.3 * k), tp - k, deep);
    const ex = x0 + Math.round(sx * 0.3 * 5), ey = tp - 5;
    put(ex, ey, a2l); put(ex + 1, ey, a2l); put(ex, ey - 1, a2l); put(ex + 1, ey - 1, a2);
  }
  if (feat.includes(8)) {
    const tp = topAt(11);
    put(11, tp - 1, '#2a6a30'); put(11, tp - 2, '#2a6a30'); put(12, tp - 1, '#2a6a30');
    [[9, tp - 3], [10, tp - 3], [10, tp - 2], [13, tp - 3], [14, tp - 3], [13, tp - 2], [11, tp - 4], [12, tp - 4]].forEach(([x, y], i) => put(x, y, i < 6 ? '#58b848' : '#8ade6a'));
  }
  if (feat.includes(9)) {
    const hs = [2, 4, 5, 4, 2];
    for (let i = 0; i < 5; i++) { const x = 9 + i, tp = topAt(x); for (let k = 0; k < hs[i]; k++) put(x, tp - k, k >= hs[i] - 1 ? '#ffe860' : a2); }
  }
  // --- patterns (only on body cells) ---
  const onBody = (x, y) => cells.some(([cx, cy]) => cx === x && cy + shift === y);
  if (g.pat === 1) {
    const cy = my + h * 0.22, rx = w * 0.28, ry = h * 0.26;
    for (const [x, y0] of cells) { const y = y0 + shift; if (sq((x - mx) / rx) + sq((y - cy) / ry) <= 1) put(x, y, a2l); }
  } else if (g.pat === 2) {
    for (const [x, y0] of cells) { const y = y0 + shift; if (y > top + 1 && (y - top) % 4 === 1 && y < bot - 3) put(x, y, a2d); }
  } else if (g.pat === 3) {
    for (let n = 0; n < 5; n++) {
      const [cx, cy] = cells[Math.floor(rng() * cells.length)], y = cy + shift;
      if (cy + shift < top + 3 || cy + shift > bot - 3) continue;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (onBody(cx + ox, y + oy)) put(cx + ox, y + oy, a2);
    }
  }
  // --- feet ---
  for (const sx of [-0.24, 0.24]) {
    const fx = Math.round(mx + w * sx);
    for (let dx = -1; dx <= 1; dx++) { put(fx + dx, bot + 1, dark); put(fx + dx, bot + 2, deep); }
  }
  // --- eyes & mouth ---
  const ey = Math.round(top + h * 0.38), ed = Math.max(2, Math.round(w * 0.2)), INK = '#101820', WH = '#ffffff';
  const eyeAt = (x, style, sgn) => {
    if (style === 0) { put(x, ey, INK); put(x, ey + 1, INK); }
    else if (style === 1) { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) put(x + a, ey + b, WH); put(x, ey, INK); put(x, ey + 1, INK); put(x + sgn, ey, INK); put(x + sgn, ey + 1, INK); }
    else if (style === 2) { put(x, ey, INK); put(x + 1, ey, INK); put(x, ey + 1, INK); put(x + 1, ey + 1, INK); put(x - (sgn > 0 ? 0 : 0), ey - 1, INK); put(x + sgn * -1, ey - 2 + 1, INK); put(x + sgn, ey - 1, INK); }
    else { put(x - 1, ey + 1, INK); put(x, ey + 1, INK); put(x + 1, ey + 1, INK); }
  };
  if (g.eye === 4) {
    for (let a = -2; a <= 2; a++) for (let b = -1; b <= 2; b++) put(12 + a - 1, ey + b, WH);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) put(11 + a - 1, ey + b, INK);
  } else { eyeAt(Math.round(mx - ed), g.eye, 1); eyeAt(Math.round(mx + ed + 1), g.eye, -1); }
  const my2 = ey + (g.eye === 1 ? 3 : 3);
  if (g.mouth === 1) { put(11, my2, INK); put(12, my2, INK); }
  else if (g.mouth === 2) { put(10, my2, INK); put(11, my2, INK); put(12, my2, INK); put(13, my2, INK); put(10, my2 + 1, WH); put(13, my2 + 1, WH); }
  // --- outline ---
  const snap = grid.slice();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (snap[y * S + x] !== null) continue;
    if ((x > 0 && snap[y * S + x - 1]) || (x < S - 1 && snap[y * S + x + 1]) || (y > 0 && snap[(y - 1) * S + x]) || (y < S - 1 && snap[(y + 1) * S + x])) grid[y * S + x] = OUT;
  }
  const cv = mk(S, S), cx = cv.getContext('2d');
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (grid[y * S + x]) { cx.fillStyle = grid[y * S + x]; cx.fillRect(x, y, 1, 1); }
  return cv;
}

function whiteOf(cv) {
  const w = mk(S, S), x = w.getContext('2d');
  x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
  return w;
}
export function creatureCanvas(g, flash = false) {
  const k = JSON.stringify(g);
  let e = cache.get(k);
  if (!e) { const cv = renderCreature(g); e = { cv, white: null }; cache.set(k, e); if (cache.size > 400) cache.delete(cache.keys().next().value); }
  if (flash) return e.white || (e.white = whiteOf(e.cv));
  return e.cv;
}
// Draw creature centred at (cx, cy) with given size in px. Feet sit near the bottom of the box.
export function drawCreature(ctx, g, cx, cy, size, o = {}) {
  const cv = creatureCanvas(g, !!o.flash);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (o.flip) ctx.scale(-1, 1);
  const sc = o.scaleY === undefined ? 1 : o.scaleY;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, -size / 2, -size / 2 + size * (1 - sc) / 2, size, size * sc);
  ctx.restore();
}

// ---------------- tiles ----------------
let atlas = null;
const rect = (x, c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };
function speck(x, rng, cols, n) { for (let i = 0; i < n; i++) rect(x, cols[(rng() * cols.length) | 0], (rng() * 16) | 0, (rng() * 16) | 0, 1, 1); }
const GROUND = {
  [T.GRASS]: ['#5cae4a', ['#4c9a3c', '#6cbc58', '#4c9a3c'], 16],
  [T.FOREST]: ['#3f8040', ['#336b34', '#4f9650', '#7a5a30'], 18],
  [T.SAND]: ['#ead598', ['#d8c07a', '#f4e4b0'], 14],
  [T.DESERT]: ['#e2b45e', ['#cc9a48', '#f0c878'], 14],
  [T.SNOW]: ['#eef4fa', ['#cfe0f0', '#ffffff'], 14],
  [T.SWAMP]: ['#4c6a3c', ['#3a5630', '#627f48', '#38503a'], 18],
  [T.ASH]: ['#4a3c3c', ['#352a2a', '#5c4c4c', '#e8702c'], 18],
};
function ground(x, t, rng) { const [f, sp, n] = GROUND[t]; rect(x, f, 0, 0, 16, 16); speck(x, rng, sp, n); }
const disc = (x, cx, cy, r, c) => { for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 <= r * r) rect(x, c, i, j, 1, 1); };
const TILE_DRAW = {
  [T.WATER]: (x, v, rng) => {
    rect(x, '#2f6fd0', 0, 0, 16, 16); speck(x, rng, ['#2458b0'], 6);
    for (let i = 0; i < 3; i++) { const a = ((rng() * 12) | 0), b = ((rng() * 14) | 0); rect(x, '#5a96e8', (a + v * 3) % 13, b, 3, 1); }
  },
  [T.TALL]: (x, v, rng) => { ground(x, T.GRASS, rng); for (let i = 0; i < 4; i++) { const a = 1 + ((rng() * 12) | 0), b = 6 + ((rng() * 8) | 0); rect(x, '#2e7a2e', a, b, 1, 4); rect(x, '#2e7a2e', a + 2, b + 1, 1, 3); rect(x, '#7ad060', a + 1, b - 1, 1, 3); } },
  [T.FLOWER]: (x, v, rng) => { ground(x, T.GRASS, rng); for (let i = 0; i < 2; i++) { const a = 2 + ((rng() * 11) | 0), b = 2 + ((rng() * 11) | 0), c = ['#f8e048', '#f070a8', '#ffffff', '#c080f0'][(rng() * 4) | 0]; rect(x, c, a, b - 1, 1, 3); rect(x, c, a - 1, b, 3, 1); rect(x, '#e07020', a, b, 1, 1); } },
  [T.TREE]: (x, v, rng) => { ground(x, T.FOREST, rng); rect(x, '#5a3a1c', 7, 10, 3, 6); disc(x, 8, 6.5, 6.2, '#1c4a24'); disc(x, 8, 6.5, 5.2, '#2a6a30'); disc(x, 6.2, 4.8, 2.6, '#3c8c40'); rect(x, '#6cc068', 5, 3, 2, 1); },
  [T.PINE]: (x, v, rng) => { ground(x, T.SNOW, rng); rect(x, '#5a3a1c', 7, 12, 2, 4); for (let i = 0; i < 3; i++) { const y0 = 1 + i * 4, hw = 2 + i; for (let r = 0; r < 5; r++) { const w = Math.min(hw, 1 + r * (hw / 4)); rect(x, r < 2 ? '#e8f4f8' : '#2a6a48', Math.round(8 - w), y0 + r, Math.round(w * 2), 1); } } },
  [T.CACTUS]: (x, v, rng) => { ground(x, T.DESERT, rng); rect(x, '#1c6a2c', 6, 3, 4, 12); rect(x, '#3cae4c', 7, 3, 2, 12); rect(x, '#1c6a2c', 2, 6, 4, 2); rect(x, '#1c6a2c', 2, 4, 2, 4); rect(x, '#1c6a2c', 10, 8, 4, 2); rect(x, '#1c6a2c', 12, 6, 2, 4); rect(x, '#f070a8', 7, 2, 2, 1); },
  [T.DEADTREE]: (x, v, rng) => { ground(x, T.SWAMP, rng); rect(x, '#3a2c22', 7, 5, 2, 11); rect(x, '#3a2c22', 4, 4, 3, 1); rect(x, '#3a2c22', 4, 2, 1, 3); rect(x, '#3a2c22', 9, 7, 4, 1); rect(x, '#3a2c22', 12, 5, 1, 3); rect(x, '#6a5a48', 8, 5, 1, 9); rect(x, '#788a50', 5, 8, 2, 2); },
  [T.ROCK]: (x, v, rng) => { ground(x, T.ASH, rng); disc(x, 8, 9, 6, '#34343c'); disc(x, 8, 9, 5, '#6c6c78'); disc(x, 6.5, 7.5, 2.4, '#9c9ca8'); },
  [T.BOULDER]: (x, v, rng) => { ground(x, T.DESERT, rng); disc(x, 8, 9.5, 5.5, '#6a4824'); disc(x, 8, 9.5, 4.5, '#a07840'); disc(x, 6.5, 8, 2, '#c8a060'); },
  [T.LAVA]: (x, v, rng) => { rect(x, '#d83c18', 0, 0, 16, 16); for (let i = 0; i < 5; i++) { const a = (rng() * 12) | 0, b = (rng() * 13) | 0; rect(x, '#f8a030', (a + v * 2) % 13, b, 3, 2); rect(x, '#ffe070', (a + v * 2) % 13 + 1, b, 1, 1); } speck(x, rng, ['#a02808'], 8); },
  [T.BOG]: (x, v, rng) => { rect(x, '#3b5e58', 0, 0, 16, 16); speck(x, rng, ['#2c4a46'], 8); for (let i = 0; i < 3; i++) rect(x, '#5b8c80', (rng() * 12) | 0, (rng() * 15) | 0, 3, 1); if (v === 1) { disc(x, 5, 9, 2.4, '#58a048'); rect(x, '#3b5e58', 5, 8, 3, 1); } },
  [T.ICE]: (x, v, rng) => { rect(x, '#aee4f4', 0, 0, 16, 16); speck(x, rng, ['#8cd0e8'], 10); for (let i = 0; i < 2; i++) rect(x, '#e8fbff', (rng() * 10) | 0, (rng() * 15) | 0, 4 + ((rng() * 3) | 0), 1); },
  [T.SHRINE]: (x, v, rng) => { ground(x, T.GRASS, rng); rect(x, '#50505c', 2, 11, 12, 4); rect(x, '#8a8a96', 2, 10, 12, 3); rect(x, '#8a8a96', 5, 4, 6, 7); rect(x, '#b0b0bc', 5, 4, 2, 7); const c = v % 2 ? '#a0f4ff' : '#60e0ff'; rect(x, c, 7, 0, 2, 2); rect(x, c, 6, 2, 4, 3); rect(x, c, 7, 5, 2, 1); rect(x, '#ffffff', 7, 2, 1, 2); },
};
for (const t of Object.keys(GROUND)) TILE_DRAW[t] = (x, v, rng) => ground(x, +t, rng);

export function getAtlas() {
  if (atlas) return atlas;
  atlas = mk(16 * 4, 16 * NTILES);
  const x = atlas.getContext('2d');
  for (let t = 0; t < NTILES; t++) for (let v = 0; v < 4; v++) {
    const c = mk(16, 16), cx = c.getContext('2d');
    TILE_DRAW[t](cx, v, mulberry32(t * 97 + v * 13 + 5));
    x.drawImage(c, v * 16, t * 16);
  }
  return atlas;
}

// ---------------- player ----------------
let playerSheet = null;
export function getPlayer() {
  if (playerSheet) return playerSheet;
  playerSheet = [];
  for (let dir = 0; dir < 3; dir++) { // 0 down, 1 up, 2 side(left)
    playerSheet[dir] = [];
    for (let f = 0; f < 3; f++) {
      const c = mk(12, 16), x = c.getContext('2d');
      const K = '#1c1c28', SK = '#f4c898', CAP = '#d83c3c', SH = '#3c78d8', PN = '#3c3c5c', HR = '#5a3a1c';
      const step = f === 1 ? 1 : f === 2 ? -1 : 0;
      rect(x, K, 3, 12 + (step > 0 ? 0 : 0), 2, 3); rect(x, K, 7, 12, 2, 3);
      rect(x, PN, 3, 12, 2, 2 + (step > 0 ? 1 : 0)); rect(x, PN, 7, 12, 2, 2 + (step < 0 ? 1 : 0));
      rect(x, K, 2, 6, 8, 7); rect(x, SH, 3, 7, 6, 5); rect(x, '#fff', 5, 7, 2, 1);
      rect(x, SK, 1, 8, 1, 3); rect(x, SK, 10, 8, 1, 3);
      rect(x, K, 2, 0, 8, 7); rect(x, dir === 1 ? HR : SK, 3, 1, 6, 5);
      if (dir === 0) { rect(x, CAP, 3, 1, 6, 2); rect(x, '#a02828', 3, 3, 6, 1); rect(x, K, 4, 4, 1, 2); rect(x, K, 7, 4, 1, 2); }
      else if (dir === 1) { rect(x, CAP, 3, 1, 6, 3); rect(x, HR, 3, 4, 6, 2); }
      else { rect(x, CAP, 3, 1, 6, 2); rect(x, '#a02828', 1, 3, 6, 1); rect(x, K, 4, 4, 1, 2); rect(x, HR, 7, 3, 2, 3); }
      playerSheet[dir][f] = c;
    }
  }
  return playerSheet;
}
export function drawPlayer(ctx, px, py, ts, dir, frame, moving) {
  const sh = getPlayer(), d = dir === 0 ? 0 : dir === 1 ? 1 : 2, f = moving ? (frame % 2) + 1 : 0;
  const w = Math.round(ts * 0.8), h = Math.round(ts * 1.067);
  ctx.save(); ctx.translate(Math.round(px), Math.round(py));
  if (dir === 3) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sh[d][f], -w / 2, -h + Math.round(ts * 0.15), w, h);
  ctx.restore();
}

// ---------------- orb ----------------
let orbCv = null;
export function drawOrb(ctx, x, y, size, rot = 0, open = 0) {
  if (!orbCv) {
    orbCv = mk(12, 12); const c = orbCv.getContext('2d');
    for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
      const d = Math.hypot(i + 0.5 - 6, j + 0.5 - 6);
      if (d > 5.8) continue;
      let col = d > 4.9 ? '#1c1c28' : j < 5 ? (i < 5 && j < 4 ? '#ff8a7a' : '#e83c3c') : j < 7 ? '#1c1c28' : '#f4f4f4';
      if (j >= 7 && d <= 4.9 && i > 6) col = '#c8c8d0';
      if (d < 2.2 && j >= 4 && j <= 8) col = d < 1.4 ? '#ffffff' : '#1c1c28';
      c.fillStyle = col; c.fillRect(i, j, 1, 1);
    }
  }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1 - open * 0.7; const s = size * (1 + open * 0.6);
  ctx.drawImage(orbCv, -s / 2, -s / 2, s, s); ctx.restore();
}

// ---------------- world map image (1px per tile) ----------------
const MAPCOL = [[47, 111, 208], [234, 213, 152], [92, 174, 74], [63, 128, 64], [226, 180, 94], [238, 244, 250], [76, 106, 60], [90, 60, 60]];
export function buildMapImage(w) {
  const cv = mk(N, N), x = cv.getContext('2d'), im = x.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    let c = MAPCOL[w.biome[i]];
    if (w.tiles[i] === T.LAVA) c = [232, 80, 28];
    im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255;
  }
  x.putImageData(im, 0, 0);
  return cv;
}
