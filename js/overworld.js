// Overworld session: world update/draw, HUD (icon-first), touch controls for Attack / Catch / Use, goal arrow.
import { G, toast } from './state.js';
import { input, getMove, keyTapped } from './input.js';
import { sfx } from './audio.js';
import { save, load } from './save.js';
import { C, PAL, text, panel, bar, fillR, hit, wrap, iconButton } from './ui.js';
import { drawCreature, getAtlas, drawPlayer, buildMapImage } from './sprites.js';
import { drawIcon } from './icons.js';
import { generate, tileAt, biomeAt, speedAt, moveEntity, CAMP } from './world.js';
import { makeCreature, maxHp } from './creature.js';
import { go } from './menus.js';
import { BIOME_NAMES } from './data.js';
import { clamp } from './util.js';
import { K, initCombat, updateCombat, playerAttack, throwOrb, aimAssist, nearestMob, clampLanding, playerAlive, activePet, maxThrowRange } from './combat.js';
import { drawUnder, drawOver, mobEntities, petEntity } from './combatdraw.js';
import { updateBase, baseEntities, nearStation, STATION_NAMES } from './base.js';
import { playerMaxHp, MATS, MAT_KEYS } from './gear.js';
import { activeQuests, progressOf } from './quests.js';

let cv = null;
export const initOverworld = (canvas) => { cv = canvas; };
const tsCss = () => Math.max(34, Math.round(Math.min(G.W, G.H) / 9));

// ---------- session ----------
export function beginWorld() {
  G.world = generate(G.seed);
  G.mapImg = buildMapImage(G.world);
  G.autosaveT = 0; G.lastBiome = -1; G.banner = null; G.near = null; G.baseMode = false;
  const p = G.player, t = tileAt(G.world, Math.floor(p.x), Math.floor(p.y));
  if (!p || p.x == null || t === 0 || [5, 7, 9, 12, 14, 15, 16, 19, 21, 22].includes(t)) { p.x = G.world.spawn.x; p.y = G.world.spawn.y; }
  initCombat();
  G.screen = 'world';
}
export function newGame(starterId) {
  G.seed = 1 + Math.floor(Math.random() * 1e9);
  const c = makeCreature(starterId, 5);
  c.traits = []; c.hp = maxHp(c);
  Object.assign(G, {
    team: [c], storage: [], orbs: 12, berries: 3, skill: { lvl: 1, xp: 0 }, bosses: {}, dex: { seen: { [starterId]: 1 }, caught: { [starterId]: 1 } }, playtime: 0,
    gear: { w: 0, a: 0 }, mats: { hide: 0, fang: 0, gem: 0, core: 0 }, vials: {}, quests: { done: {}, prog: {} }, stats: {}, hp: null,
  });
  const w = generate(G.seed);
  G.player = { x: w.spawn.x, y: w.spawn.y, dir: 0 };
  beginWorld(); save();
  toast('Stick = move. Red button = hit. Blue button = catch!', 4.5);
}
export function continueGame() {
  if (!load()) return false;
  beginWorld(); toast('Welcome back!');
  return true;
}

// ---------- goal arrow (next thing to do) ----------
function goal() {
  const w = G.world, p = G.player;
  const sh = { x: w.shrine.x + 0.5, y: w.shrine.y + 0.5, icon: 'heart', col: '#58e068' };
  const hurt = G.hp / playerMaxHp() < 0.4 || !activePet() || K.ko > 0;
  if (hurt) return sh;
  const q = activeQuests()[0];
  const st = (id) => { const s = CAMP.stations.find((x) => x.id === id); return s && { x: s.x + 0.5, y: s.y + 1, icon: s.icon, col: s.col }; };
  const boss = () => {
    let b = null, bd = 1e9;
    for (const m of G.mobs) if (m.boss) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; b = m; } }
    return b && { x: b.x, y: b.y, icon: 'crown', col: '#e8483c' };
  };
  const mob = () => { const m = nearestMob(30); return m && { x: m.x, y: m.y, icon: 'sword', col: '#e8483c' }; };
  if (q) {
    if (q.goal === 'forge' || q.goal === 'lab') return st(q.goal);
    if (q.goal === 'boss') return boss();
    if (q.goal === 'mob') { const m = mob(); if (m) return m; }
  }
  return boss();
}

// ---------- update ----------
function useStation(st) {
  if (!st) return;
  input.stick.on = false; input.stick.x = input.stick.y = 0; sfx.tap();
  G.baseMode = true;
  if (st.id === 'chest') go('storage', { tab: 'team' });
  else if (st.id === 'lab') go('fuse', { fuse: { a: null, b: null } });
  else if (st.id === 'forge') go('forge');
  else go('trainpick');
}

export function updateWorld(dt) {
  const w = G.world, p = G.player;
  G.playtime += dt;
  const alive = playerAlive();
  const m = alive ? getMove() : { x: 0, y: 0, len: 0 };
  if (m.len > 0) {
    const sp = 4.3 * speedAt(w, p.x, p.y) * dt * m.len;
    moveEntity(w, p, (m.x / m.len) * sp, (m.y / m.len) * sp);
  }
  p.moving = m.len > 0;
  updateCombat(dt, m);
  updateBase(dt);
  const b = biomeAt(w, Math.floor(p.x), Math.floor(p.y));
  if (b !== G.lastBiome) { G.lastBiome = b; G.banner = { text: BIOME_NAMES[b], t: 2.4 }; }
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (G.questFx) { G.questFx.t -= dt; if (G.questFx.t <= 0) G.questFx = null; }
  G.autosaveT += dt;
  if (G.autosaveT > 20) { G.autosaveT = 0; G.hp = Math.max(1, G.hp); save(); }
  G.near = alive ? nearStation(p) : null;
  if (keyTapped('e', 'enter') && G.near) useStation(G.near);
  if (keyTapped('k', 'c')) { const n = nearestMob(maxThrowRange()); const f = K.face; throwOrb(n ? n.x : p.x + f.x * 4, n ? n.y : p.y + f.y * 4, n); }
  if (keyTapped('m', 'escape')) go('menu');
}

// ---------- draw ----------
function drawWorldTiles(ts, camX, camY, hx, hy, tsD) {
  const { dpr } = G, w = G.world, atlas = getAtlas();
  const x0 = Math.floor((camX - hx) / tsD), x1 = Math.ceil((camX + hx) / tsD), y0 = Math.floor((camY - hy) / tsD), y1 = Math.ceil((camY + hy) / tsD);
  const ctx = C();
  ctx.fillStyle = '#2f6fd0'; ctx.fillRect(0, 0, cv.width, cv.height);
  const wave = Math.floor(G.time * 2) % 4;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(w, tx, ty);
    let v = (tx * 7 + ty * 13 + (tx ^ ty)) & 3;
    if (t === 0 || t === 14 || t === 11) v = (v + wave) & 3;
    ctx.drawImage(atlas, v * 16, t * 16, 16, 16, tx * tsD - camX + hx, ty * tsD - camY + hy, tsD, tsD);
  }
}

function playerEntity(S) {
  const p = G.player;
  return {
    y: p.y, fn: (ctx) => {
      const { sx, sy, ts } = S, x = sx(p.x), y = sy(p.y);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y, ts * 0.35, ts * 0.14, 0, 0, 7); ctx.fill();
      if (!playerAlive()) {
        ctx.save(); ctx.globalAlpha = 0.6; ctx.translate(x, y - ts * 0.2); ctx.rotate(Math.PI / 2); drawPlayer(ctx, 0, 0, ts, p.dir, 0, false); ctx.restore();
        drawIcon(ctx, 'skull', x, y - ts * 1.1 + Math.sin(G.time * 4) * 3, ts * 0.6);
        return;
      }
      if (K.inv > 0 && Math.floor(G.time * 20) % 2) ctx.globalAlpha = 0.45;
      drawPlayer(ctx, x, y, ts, p.dir, Math.floor(G.time * 8), p.moving);
      ctx.globalAlpha = 1;
    },
  };
}

export function drawWorld() {
  const { W, H, u, dpr, safe } = G, w = G.world, p = G.player, ctx = C();
  const ts = tsCss(), tsD = Math.round(ts * dpr);
  const shk = K.shake * dpr * 0.5;
  const camX = Math.round(p.x * tsD + (Math.random() - 0.5) * shk * 2), camY = Math.round((p.y - 0.4) * tsD + (Math.random() - 0.5) * shk * 2);
  const hx = Math.round(W * dpr / 2), hy = Math.round(H * dpr / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawWorldTiles(ts, camX, camY, hx, hy, tsD);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const S = { sx: (x) => (x * tsD - camX + hx) / dpr, sy: (y) => (y * tsD - camY + hy) / dpr, ts, u, W, H };
  const aim = G.aimView;
  drawUnder(ctx, S, aim);
  const ents = [playerEntity(S), ...mobEntities(S), ...baseEntities(S, G.near)];
  const pe = petEntity(S); if (pe) ents.push(pe);
  const sh = w.shrine;
  ents.push({ y: sh.y + 1, fn: (c) => { const x = S.sx(sh.x + 0.5), y = S.sy(sh.y + 1), b = Math.sin(G.time * 3) * 3 * u; c.fillStyle = 'rgba(20,40,20,.7)'; c.beginPath(); c.arc(x, y - ts * 1.3 + b, ts * 0.38, 0, 7); c.fill(); drawIcon(c, 'heart', x, y - ts * 1.3 + b, ts * 0.55); } });
  ents.push({ y: CAMP.cy - 1, fn: (c) => { const x = S.sx(CAMP.x1 + 0.5), y = S.sy(CAMP.cy - 1.3), b = Math.sin(G.time * 3) * 3 * u; c.fillStyle = 'rgba(20,40,20,.7)'; c.beginPath(); c.arc(x, y - ts * 0.9 + b, ts * 0.4, 0, 7); c.fill(); drawIcon(c, 'home', x, y - ts * 0.9 + b, ts * 0.58); } });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.fn(ctx);
  drawOver(ctx, S);
  drawGoalArrow(ctx, S);
  // off-screen boss markers
  for (const m of G.mobs) {
    if (!m.boss || Math.hypot(m.x - p.x, m.y - p.y) > 60) continue;
    const x = S.sx(m.x), y = S.sy(m.y);
    if (x > 0 && x < W && y > 0 && y < H) continue;
    const mx = clamp(x, safe.l + 16 * u, W - safe.r - 16 * u), my = clamp(y, safe.t + 90 * u, H - safe.b - 16 * u);
    ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(mx, my, 13 * u, 0, 7); ctx.fill(); ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.arc(mx, my, 11 * u, 0, 7); ctx.fill();
    drawIcon(ctx, 'crown', mx, my, 14 * u);
  }
  drawHud(S);
}

function drawGoalArrow(ctx, S) {
  const g = goal(), p = G.player; if (!g) return;
  const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy); if (d < (g.icon === 'sword' || g.icon === 'crown' ? 5 : 3.2)) return;
  const { ts, u } = S, a = Math.atan2(dy, dx), R = ts * 1.9 + Math.sin(G.time * 6) * ts * 0.07;
  const x = S.sx(p.x) + Math.cos(a) * R, y = S.sy(p.y) - ts * 0.4 + Math.sin(a) * R * 0.8;
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = 0.95;
  drawIcon(ctx, 'arrow', 0, 0, ts * 0.85, g.col === '#e8483c' ? '#ff8a5c' : '#ffe040'); ctx.restore();
  const bx = x + Math.cos(a) * ts * 0.85, by = y + Math.sin(a) * ts * 0.85;
  ctx.fillStyle = 'rgba(20,40,20,.8)'; ctx.beginPath(); ctx.arc(bx, by, ts * 0.34, 0, 7); ctx.fill(); ctx.strokeStyle = g.col; ctx.lineWidth = 2.5; ctx.stroke();
  drawIcon(ctx, g.icon, bx, by, ts * 0.46);
}

// ---------- HUD ----------
const tapIn = (cx, cy, r) => {
  for (let i = 0; i < input.taps.length; i++) { const t = input.taps[i]; if (Math.hypot(t.sx - cx, t.sy - cy) <= r) { input.taps.splice(i, 1); return t; } }
  return null;
};
const heldIn = (cx, cy, r) => { for (const q of input.pointers.values()) if (!q.stick && Math.hypot(q.sx - cx, q.sy - cy) <= r) return q; return null; };
function circleBtn(cx, cy, r, fill, icon, o = {}) {
  const ctx = C(), pr = o.pressed ? 0.93 : 1, pulse = o.pulse ? 1 + Math.sin(G.time * 8) * 0.05 : 1, R = r * pr * pulse;
  ctx.globalAlpha = o.dim ? 0.55 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.arc(cx + 2 * G.u, cy + 4 * G.u, R, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.fillStyle = o.pressed ? o.fillDn || fill : fill; ctx.beginPath(); ctx.arc(cx, cy, R - 4 * G.u, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.45, R * 0.6, R * 0.28, 0, 0, 7); ctx.fill();
  drawIcon(ctx, icon, cx, cy + (o.pressed ? 2 * G.u : 0), R * (o.iscale || 1.15));
  ctx.globalAlpha = 1;
}

function drawHud(S) {
  const { W, H, u, safe } = G, ctx = C(), ts = S.ts, p = G.player;
  const mhp = playerMaxHp();
  // hurt / low-HP vignette
  const low = G.hp / mhp < 0.3 ? 0.25 + 0.15 * Math.sin(G.time * 6) : 0, va = Math.max(low, K.hurt > 0 ? K.hurt * 1.1 : 0);
  if (va > 0.01) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,20,20,${Math.min(0.7, va)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (!playerAlive()) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.55, (2.4 - K.ko) * 0.5)})`; ctx.fillRect(0, 0, W, H); }
  // --- top-left: player + partner ---
  const px = safe.l + 8 * u, py = safe.t + 8 * u, pw = Math.min(176 * u, W * 0.46);
  panel(px, py, pw, 30 * u);
  drawIcon(ctx, 'heart', px + 16 * u, py + 15 * u, 20 * u);
  bar(px + 32 * u, py + 8 * u, pw - 42 * u, 14 * u, G.hp / mhp, '#e8483c');
  text(`${Math.ceil(G.hp)}`, px + pw - 14 * u, py + 15.5 * u, { size: 10, align: 'right', color: '#fff', shadow: PAL.dark });
  const pet = activePet(), lead = pet || G.team[0];
  panel(px, py + 34 * u, pw, 30 * u);
  drawCreature(ctx, lead.g, px + 17 * u, py + 34 * u + 16 * u, 26 * u, { alpha: pet ? 1 : 0.4 });
  bar(px + 32 * u, py + 34 * u + 8 * u, pw - 42 * u, 10 * u, lead.hp / maxHp(lead), '#58b0ff');
  if (!pet) drawIcon(ctx, 'skull', px + 17 * u, py + 34 * u + 16 * u, 18 * u);
  // quest chips
  let qy = py + 70 * u;
  activeQuests().forEach((q, i) => {
    const cw = Math.min(i ? 78 * u : 96 * u, pw), prog = progressOf(q);
    panel(px, qy, cw, 22 * u, { fill: i ? '#cdd8a8' : '#f4f0a8' });
    drawIcon(ctx, q.icon, px + 13 * u, qy + 11 * u, 14 * u);
    bar(px + 25 * u, qy + 6 * u, cw - 31 * u, 10 * u, prog / q.n, '#58b0ff');
    text(`${prog}/${q.n}`, px + 25 * u + (cw - 31 * u) / 2, qy + 11.5 * u, { size: 8.5, align: 'center', color: PAL.ink, shadow: i ? false : '#fff' });
    qy += 25 * u;
  });
  // --- top-right: menu + materials ---
  const mb = 44 * u, mx = W - safe.r - mb - 8 * u, my = safe.t + 8 * u;
  if (iconButton('menu', '', mx, my, mb, mb, { fill: PAL.light })) go('menu');
  let ry = my + mb + 6 * u;
  panel(mx - 38 * u, ry, mb + 38 * u, 26 * u);
  const cell = (mb + 38 * u) / 4;
  MAT_KEYS.forEach((k, i) => { drawIcon(ctx, k, mx - 38 * u + cell * i + 8 * u, ry + 9 * u, 11 * u); text(String(G.mats[k] || 0), mx - 38 * u + cell * i + cell / 2 + 3 * u, ry + 19 * u, { size: 8.5, align: 'center' }); });
  // --- boss bar ---
  const bb = K.bossBar;
  if (bb) {
    const port = W < H * 0.9, bw = port ? W - safe.l - safe.r - 100 * u : Math.min(W * 0.34, 280 * u), bx = port ? safe.l + 40 * u : W / 2 - bw / 2, by = port ? qy + 8 * u : safe.t + 10 * u;
    panel(bx - 32 * u, by - 4 * u, bw + 70 * u, 30 * u, { fill: '#f0d0c8' });
    drawIcon(ctx, 'crown', bx - 12 * u, by + 11 * u, 20 * u);
    bar(bx, by + 2 * u, bw, 16 * u, bb.hp / bb.maxHp, '#e04838');
    fillR(bx + bw * 0.25 - u, by - u, 2 * u, 20 * u, '#60c8ff');
    if (bb.hp <= bb.maxHp * 0.25) drawIcon(ctx, 'orb', bx + bw + 13 * u, by + 11 * u, (18 + Math.sin(G.time * 8) * 2) * u);
  }
  if (G.banner) {
    ctx.globalAlpha = Math.min(1, G.banner.t * 2);
    const by = safe.t + (bb && W >= H * 0.9 ? 44 : 10) * u; panel(W / 2 - 90 * u, by, 180 * u, 26 * u);
    text(G.banner.text, W / 2, by + 13 * u, { size: 13, align: 'center', maxW: 170 * u });
    ctx.globalAlpha = 1;
  }
  // --- quest complete banner ---
  if (G.questFx) {
    const q = G.questFx.q, k = Math.min(1, (2.6 - G.questFx.t) * 4), bw = Math.min(W - 30 * u, 260 * u), by = H * 0.27;
    ctx.globalAlpha = Math.min(1, G.questFx.t * 2);
    panel(W / 2 - bw / 2, by, bw, 64 * u, { fill: '#f4f0a8' });
    drawIcon(ctx, 'star', W / 2 - bw / 2 + 32 * u, by + 32 * u, (34 + Math.sin(G.time * 10) * 3) * u * k);
    drawIcon(ctx, q.icon, W / 2 - 4 * u, by + 32 * u, 30 * u);
    drawIcon(ctx, 'check', W / 2 + 32 * u, by + 32 * u, 24 * u);
    drawIcon(ctx, 'gift', W / 2 + bw / 2 - 34 * u, by + 32 * u, 30 * u);
    ctx.globalAlpha = 1;
  }
  // --- controls ---
  const s = input.stick, R = 55 * u;
  const bx = s.on ? s.ox : safe.l + R + 38 * u, byy = s.on ? s.oy : H - safe.b - R - 30 * u;
  const kx = bx + s.x * R * 0.7, ky = byy + s.y * R * 0.7;
  ctx.globalAlpha = s.on ? 0.8 : 0.4;
  ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(bx, byy, R, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.light; ctx.beginPath(); ctx.arc(bx, byy, R - 4 * u, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(kx, ky, R * 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.pale; ctx.beginPath(); ctx.arc(kx, ky, R * 0.42 - 3 * u, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;

  const ar = 50 * u, ax = W - safe.r - ar - 16 * u, ay = H - safe.b - ar - 20 * u;
  const cr = 36 * u, cx = ax - (ar + cr) * 0.92 - 6 * u, cy = ay + ar * 0.15 - (ar + cr) * 0.1;
  const ur = 30 * u, ux = ax + ar * 0.1, uy = ay - ar - ur - 12 * u;
  const st = G.near, alive = playerAlive();
  // attack (tap or hold)
  const atkTap = tapIn(ax, ay, ar * 1.1), atkHold = heldIn(ax, ay, ar * 1.1);
  const wantAtk = !!(atkTap || atkHold || input.keys.has('j') || input.keys.has(' '));
  if (wantAtk && alive) { if (playerAttack() && (atkTap || atkHold)) { /* sfx in playerAttack */ } }
  circleBtn(ax, ay, ar, '#e8483c', 'sword', { pressed: !!atkHold || K.atkCd > 0.2, fillDn: '#b02820', iscale: 1.25 });
  // catch: hold + drag to aim, release to throw; a quick tap auto-aims at the nearest creature
  const ts2 = ts;
  const aimFrom = (x, y) => {
    const vx = x - cx, vy = y - cy, d = Math.hypot(vx, vy);
    let tx, ty, lock = null;
    if (d < 16 * u) { const n = nearestMob(maxThrowRange()); if (n) { tx = n.x; ty = n.y; lock = n; } else { tx = p.x + K.face.x * 4; ty = p.y + K.face.y * 4; } }
    else { const tl = Math.min(maxThrowRange(), d / (ts2 * 0.45)); tx = p.x + (vx / d) * tl; ty = p.y + (vy / d) * tl; lock = aimAssist(tx, ty); if (lock) { tx = lock.x; ty = lock.y; } }
    const l = clampLanding(tx, ty);
    return { tx: l.x, ty: l.y, lock };
  };
  const catchHold = heldIn(cx, cy, cr * 1.2);
  G.aimView = alive && catchHold ? aimFrom(catchHold.x, catchHold.y) : null;
  const ct = tapIn(cx, cy, cr * 1.2);
  if (ct && alive) { const a = aimFrom(ct.x, ct.y); throwOrb(a.tx, a.ty, a.lock); }
  circleBtn(cx, cy, cr, G.orbs > 0 ? '#2c9cd8' : '#8a8a96', 'orb', { pressed: !!catchHold, fillDn: '#1c78a8', dim: G.orbs <= 0, pulse: !!K.bossBar && K.bossBar.hp <= K.bossBar.maxHp * 0.25 });
  text(String(G.orbs), cx + cr * 0.72, cy + cr * 0.78, { size: 15, align: 'center', color: '#fff', shadow: PAL.dark });
  // use (only near a base station)
  let useRect = null;
  if (st) {
    const ut = tapIn(ux, uy, ur * 1.15);
    circleBtn(ux, uy, ur, '#f0c830', st.icon, { pulse: true, iscale: 1.2 });
    useRect = [ux - ur, uy - ur, ur * 2, ur * 2];
    if (ut) useStation(st);
  }
  input.block = [[ax - ar, ay - ar, ar * 2, ar * 2], [cx - cr, cy - cr, cr * 2, cr * 2], [mx, my, mb, mb]];
  if (useRect) input.block.push(useRect);
  input.zone = [0, H * (W > H ? 0.2 : 0.3), W * 0.6, H];
  G.hud = { attack: { x: ax, y: ay, r: ar }, catch: { x: cx, y: cy, r: cr }, use: st ? { x: ux, y: uy, r: ur } : null, menu: { x: mx + mb / 2, y: my + mb / 2 }, ts };
}

export function drawToast() {
  if (!G.toast) return;
  const { W, H, u } = G, w = Math.min(W - 30 * u, 360 * u), lines = wrap(G.toast.text, w - 20 * u, 12), h = 12 * u + lines.length * 16 * u;
  const y = G.screen === 'world' ? H * 0.38 : H * 0.84;
  panel((W - w) / 2, y, w, h);
  lines.forEach((l, i) => text(l, W / 2, y + 14 * u + i * 16 * u, { size: 12, align: 'center' }));
}
export { STATION_NAMES, MATS, hit };
