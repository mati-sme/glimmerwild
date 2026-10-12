// Glimmerwild entry: canvas setup, main loop, title/starter screens, overworld.
import { G, toast } from './state.js';
import { input, initInput, getMove, keyTapped, endFrame } from './input.js';
import { initAudio, sfx } from './audio.js';
import { save, load, hasSave } from './save.js';
import { setCtx, PAL, text, panel, button, bar, fillR, chips, bgPattern, hit, wrap } from './ui.js';
import { drawCreature, getAtlas, drawPlayer, buildMapImage } from './sprites.js';
import { generate, tileAt, biomeAt, speedAt, moveEntity, trySpawnWild } from './world.js';
import { makeCreature, maxHp } from './creature.js';
import { updateBattle, drawBattle, startBattle } from './battle.js';
import { drawMenus, isMenuScreen, go } from './menus.js';
import { SPECIES_BY_ID, STARTERS, BIOME_NAMES, SPECIES } from './data.js';
import { mulberry32, clamp } from './util.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d', { alpha: false });
setCtx(ctx);
const probe = document.getElementById('safe');

function resize() {
  const vv = window.visualViewport;
  const W = Math.round(vv ? vv.width : window.innerWidth), H = Math.round(vv ? vv.height : window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  G.W = W; G.H = H; G.dpr = dpr;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  G.u = clamp(Math.min(W, H) / 380, 0.85, 2.4);
  const cs = getComputedStyle(probe), n = (v) => parseFloat(v) || 0;
  G.safe = { t: n(cs.paddingTop), r: n(cs.paddingRight), b: n(cs.paddingBottom), l: n(cs.paddingLeft) };
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
initInput(cv, initAudio);

// ---------- game session ----------
function beginWorld() {
  G.world = generate(G.seed);
  G.mapImg = buildMapImage(G.world);
  G.wilds = []; G.spawnT = 0; G.autosaveT = 0; G.lastBiome = -1; G.banner = null; G.target = null;
  G.screen = 'world';
}
function newGame(starterId) {
  G.seed = 1 + Math.floor(Math.random() * 1e9);
  const c = makeCreature(starterId, 5);
  c.traits = [];
  c.hp = maxHp(c);
  Object.assign(G, { team: [c], storage: [], orbs: 12, berries: 3, skill: { lvl: 1, xp: 0 }, bosses: {}, dex: { seen: { [starterId]: 1 }, caught: { [starterId]: 1 } }, playtime: 0 });
  const w = generate(G.seed);
  G.player = { x: w.spawn.x, y: w.spawn.y, dir: 0 };
  beginWorld(); save();
  toast('Stick = walk. Press A next to a creature!', 4);
}
function continueGame() {
  if (!load()) return false;
  beginWorld(); toast('Welcome back!');
  return true;
}

// ---------- title / starter ----------
let starterSel = -1;
const demo = SPECIES.map((s, i) => makeCreature(s.id, 5, mulberry32(i + 3)));
function drawTitle() {
  const { W, H, u, safe } = G, t = G.time;
  bgPattern();
  const cy = H * 0.36, ts = Math.min(40, W / 9 / u * 1.05);
  for (let i = 0; i < 5; i++) {
    const c = demo[(i * 4 + Math.floor(t / 2.5)) % demo.length], x = W * (0.12 + i * 0.19), s = Math.min(W * 0.2, 90 * u);
    drawCreature(ctx, c.g, x, cy + s * 0.9 + Math.sin(t * 3 + i) * 4 * u, s);
  }
  text('GLIMMERWILD', W / 2 + 2 * u, cy - 40 * u + 2 * u, { size: ts, align: 'center', color: PAL.mid });
  text('GLIMMERWILD', W / 2, cy - 40 * u, { size: ts, align: 'center', color: PAL.dark });
  text('catch  train  fuse  explore', W / 2, cy - 8 * u, { size: 14, align: 'center', color: PAL.mid });
  const bw = Math.min(260 * u, W - 40 * u), bh = 52 * u, x = (W - bw) / 2;
  let y = H * 0.62;
  if (hasSave()) {
    if (button('CONTINUE', x, y, bw, bh, { size: 18, fill: PAL.gold })) { sfx.start(); if (!continueGame()) G.screen = 'starter'; }
    y += bh + 12 * u;
  }
  if (button('NEW GAME', x, y, bw, bh, { size: 18 })) { starterSel = -1; G.screen = 'starter'; }
  text('Tap to play  •  works offline', W / 2, H - safe.b - 16 * u, { size: 11, align: 'center', color: PAL.mid });
}
function drawStarter() {
  const { W, H, u, safe } = G;
  bgPattern();
  text('Choose your partner', W / 2, safe.t + 34 * u, { size: 20, align: 'center' });
  const gap = 8 * u, cw = Math.min((W - safe.l - safe.r - 24 * u - 2 * gap) / 3, 180 * u), ch = Math.min(H * 0.5, 260 * u);
  const x0 = (W - (cw * 3 + gap * 2)) / 2, y0 = safe.t + 60 * u;
  STARTERS.forEach((id, i) => {
    const sp = SPECIES_BY_ID[id], x = x0 + i * (cw + gap), sel = starterSel === i;
    panel(x, y0, cw, ch, { fill: sel ? '#f4f0a8' : PAL.pale });
    const ss = Math.min(cw * 0.9, ch * 0.4);
    drawCreature(ctx, demo[SPECIES.indexOf(sp)].g, x + cw / 2, y0 + 12 * u + ss / 2 + (sel ? Math.sin(G.time * 6) * 3 * u : 0), ss);
    text(sp.name, x + cw / 2, y0 + ss + 30 * u, { size: 14, align: 'center', maxW: cw - 8 * u });
    chips(sp.types, x + cw / 2 - 17 * u, y0 + ss + 44 * u, 13);
    const lines = wrap(['Gentle sprout. Balanced.', 'Fiery. Fast and bold.', 'Splashy. Tough hide.'][i], cw - 12 * u, 11);
    lines.forEach((l, j) => text(l, x + cw / 2, y0 + ss + 78 * u + j * 13 * u, { size: 11, align: 'center', color: PAL.mid }));
    if (hit(x, y0, cw, ch)) { starterSel = i; sfx.tap(); }
  });
  const bw = Math.min(280 * u, W - 40 * u), by = Math.min(H - safe.b - 120 * u, y0 + ch + 16 * u);
  if (button('START ADVENTURE', (W - bw) / 2, by, bw, 54 * u, { size: 16, disabled: starterSel < 0, fill: PAL.gold })) { sfx.start(); newGame(STARTERS[starterSel]); }
  if (button('◀ BACK', (W - bw) / 2, by + 62 * u, bw, 40 * u, { size: 13 })) G.screen = 'title';
}

// ---------- overworld ----------
const tsCss = () => Math.max(34, Math.round(Math.min(G.W, G.H) / 9));

function nearestTarget() {
  const p = G.player, w = G.world;
  let best = null, bd = 99;
  for (const wd of G.wilds) {
    const d = Math.hypot(wd.x - p.x, wd.y - p.y);
    if (d < 1.9 && d < bd) { bd = d; best = { kind: 'wild', wd, label: 'CATCH' }; }
  }
  for (const b of w.bosses) {
    if (G.bosses[b.id]) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < 2.6 && d < bd) { bd = d; best = { kind: 'boss', b, label: 'BOSS!' }; }
  }
  const sh = w.shrine, d = Math.hypot(sh.x + 0.5 - p.x, sh.y + 0.5 - p.y);
  if (d < 2.4 && d < bd) best = { kind: 'shrine', label: 'HEAL' };
  return best;
}

function afterBattle(r, wd) {
  G.screen = 'world';
  if (wd) G.wilds = G.wilds.filter((x) => x !== wd);
  if (r.result === 'lose') {
    const w = G.world;
    G.player.x = w.spawn.x; G.player.y = w.spawn.y;
    for (const c of G.team) c.hp = maxHp(c);
    toast('You blacked out and woke at the start. Team healed.', 3.5);
  }
  save();
}
function interact(t) {
  if (!t || G.screen !== 'world') return;
  if (t.kind === 'shrine') {
    for (const c of G.team) c.hp = maxHp(c);
    G.orbs = Math.max(G.orbs, 5);
    sfx.heal(); toast('The shrine restores your team!'); save(); return;
  }
  input.stick.on = false; input.stick.x = input.stick.y = 0;
  G.screen = 'battle'; sfx.start();
  if (t.kind === 'boss') startBattle({ enemy: t.b.c, boss: t.b, biome: t.b.biome }).then((r) => afterBattle(r, null));
  else startBattle({ enemy: t.wd.c, boss: null, biome: t.wd.biome }).then((r) => afterBattle(r, t.wd));
}

function updateWorld(dt) {
  const w = G.world, p = G.player;
  G.playtime += dt;
  const m = getMove();
  if (m.len > 0) {
    const sp = 4.3 * speedAt(w, p.x, p.y) * dt * m.len;
    moveEntity(w, p, (m.x / m.len) * sp, (m.y / m.len) * sp);
    p.dir = Math.abs(m.x) > Math.abs(m.y) ? (m.x < 0 ? 2 : 3) : (m.y < 0 ? 1 : 0);
  }
  p.moving = m.len > 0;
  G.spawnT -= dt;
  if (G.spawnT <= 0) {
    G.spawnT = 0.5;
    if (G.wilds.length < 14) { const s = trySpawnWild(w, p.x, p.y); if (s) G.wilds.push(s); }
  }
  for (let i = G.wilds.length - 1; i >= 0; i--) {
    const e = G.wilds[i];
    if (Math.hypot(e.x - p.x, e.y - p.y) > 26) { G.wilds.splice(i, 1); continue; }
    e.wait -= dt;
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
    if (d > 0.06) {
      const s = Math.min(d, 1.2 * dt);
      if (!moveEntity(w, e, (dx / d) * s, (dy / d) * s, 0.22)) { e.tx = e.x; e.ty = e.y; }
      if (Math.abs(dx) > 0.02) e.dir = dx < 0 ? -1 : 1;
    } else if (e.wait <= 0) {
      e.wait = 1 + Math.random() * 3;
      e.tx = e.x + (Math.random() * 6 - 3); e.ty = e.y + (Math.random() * 6 - 3);
    }
  }
  const b = biomeAt(w, Math.floor(p.x), Math.floor(p.y));
  if (b !== G.lastBiome) { G.lastBiome = b; G.banner = { text: BIOME_NAMES[b], t: 2.4 }; }
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  G.autosaveT += dt;
  if (G.autosaveT > 20) { G.autosaveT = 0; save(); }
  G.target = nearestTarget();
  if (keyTapped('e', ' ', 'enter')) interact(G.target);
  if (keyTapped('m', 'escape')) go('menu');
}

function shadow(x, y, r) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, 7); ctx.fill(); }

function drawWorld() {
  const { W, H, u, dpr, safe } = G, w = G.world, p = G.player;
  const ts = tsCss(), tsD = Math.round(ts * dpr), atlas = getAtlas();
  const camX = Math.round(p.x * tsD), camY = Math.round((p.y - 0.4) * tsD);
  const hx = Math.round(W * dpr / 2), hy = Math.round(H * dpr / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const x0 = Math.floor((camX - hx) / tsD), x1 = Math.ceil((camX + hx) / tsD), y0 = Math.floor((camY - hy) / tsD), y1 = Math.ceil((camY + hy) / tsD);
  ctx.fillStyle = '#2f6fd0'; ctx.fillRect(0, 0, cv.width, cv.height);
  const wave = Math.floor(G.time * 2) % 4;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = tileAt(w, tx, ty);
    let v = (tx * 7 + ty * 13 + (tx ^ ty)) & 3;
    if (t === 0 || t === 14 || t === 11) v = (v + wave) & 3;
    ctx.drawImage(atlas, v * 16, t * 16, 16, 16, tx * tsD - camX + hx, ty * tsD - camY + hy, tsD, tsD);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = (x) => (x * tsD - camX + hx) / dpr, sy = (y) => (y * tsD - camY + hy) / dpr;
  const ents = [{ y: p.y, k: 'p' }];
  for (const e of G.wilds) ents.push({ y: e.y, k: 'w', e });
  for (const b of w.bosses) if (!G.bosses[b.id]) ents.push({ y: b.y, k: 'b', e: b });
  ents.sort((a, b) => a.y - b.y);
  const tgt = G.target;
  for (const o of ents) {
    if (o.k === 'p') {
      shadow(sx(p.x), sy(p.y), ts * 0.35);
      drawPlayer(ctx, sx(p.x), sy(p.y), ts, p.dir, Math.floor(G.time * 8), p.moving);
    } else if (o.k === 'w') {
      const e = o.e, s = ts * 1.05, bob = Math.abs(Math.sin(G.time * 4 + e.bob)) * ts * 0.06;
      const x = sx(e.x), y = sy(e.y);
      if (x < -s || x > W + s || y < -s || y > H + s) continue;
      shadow(x, y, s * 0.32);
      drawCreature(ctx, e.c.g, x, y - s * 0.38 - bob, s, { flip: e.dir < 0 });
      if (tgt && tgt.wd === e) text('!', x, y - s * 0.95 - bob, { size: 18, align: 'center', color: PAL.red, shadow: '#fff' });
    } else {
      const b = o.e, s = ts * 2.1, x = sx(b.x), y = sy(b.y);
      if (x < -s || x > W + s || y < -s || y > H + s) continue;
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 4);
      ctx.fillStyle = `rgba(216,72,60,${0.25 + pulse * 0.2})`;
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.2, 0, 0, 7); ctx.fill();
      drawCreature(ctx, b.c.g, x, y - s * 0.4 - pulse * 3 * u, s);
      text(b.name, x, y - s * 0.95, { size: 11, align: 'center', color: '#fff', shadow: PAL.red });
    }
  }
  // off-screen boss markers
  for (const b of w.bosses) {
    if (G.bosses[b.id] || Math.hypot(b.x - p.x, b.y - p.y) > 60) continue;
    const x = sx(b.x), y = sy(b.y);
    if (x > 0 && x < W && y > 0 && y < H) continue;
    const mx = clamp(x, safe.l + 16 * u, W - safe.r - 16 * u), my = clamp(y, safe.t + 70 * u, H - safe.b - 16 * u);
    fillR(mx - 9 * u, my - 9 * u, 18 * u, 18 * u, PAL.dark); fillR(mx - 7 * u, my - 7 * u, 14 * u, 14 * u, PAL.red);
    text('B', mx, my + u, { size: 11, align: 'center', color: '#fff' });
  }
  drawHud(tgt);
}

function drawHud(tgt) {
  const { W, H, u, safe } = G, lead = G.team.find((c) => c.hp > 0) || G.team[0];
  const px = safe.l + 8 * u, py = safe.t + 8 * u, pw = Math.min(190 * u, W * 0.52);
  panel(px, py, pw, 50 * u);
  drawCreature(ctx, lead.g, px + 22 * u, py + 25 * u, 40 * u);
  text(lead.name + ' Lv' + lead.lv, px + 44 * u, py + 13 * u, { size: 11, maxW: pw - 52 * u });
  bar(px + 44 * u, py + 21 * u, pw - 54 * u, 7 * u, lead.hp / maxHp(lead));
  text(`Orb ${G.orbs}  Berry ${G.berries}  Skill ${G.skill.lvl}`, px + 44 * u, py + 40 * u, { size: 10, color: PAL.mid, maxW: pw - 52 * u });
  const btnM = [W - safe.r - 84 * u, safe.t + 8 * u, 76 * u, 44 * u];
  if (button('MENU', ...btnM, { size: 14 })) go('menu');
  if (G.banner) {
    ctx.globalAlpha = Math.min(1, G.banner.t * 2);
    panel(W / 2 - 90 * u, safe.t + 62 * u, 180 * u, 26 * u);
    text(G.banner.text, W / 2, safe.t + 75 * u, { size: 13, align: 'center', maxW: 170 * u });
    ctx.globalAlpha = 1;
  }
  // floating joystick (ghost shown at default spot while idle)
  const s = input.stick, R = 55 * u;
  const bx = s.on ? s.ox : safe.l + R + 38 * u, by = s.on ? s.oy : H - safe.b - R - 30 * u;
  const kx = bx + s.x * R * 0.7, ky = by + s.y * R * 0.7;
  ctx.globalAlpha = s.on ? 0.8 : 0.4;
  ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(bx, by, R, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.light; ctx.beginPath(); ctx.arc(bx, by, R - 4 * u, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(kx, ky, R * 0.42, 0, 7); ctx.fill();
  ctx.fillStyle = PAL.pale; ctx.beginPath(); ctx.arc(kx, ky, R * 0.42 - 3 * u, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  // action button
  const ar = 40 * u, ax = W - safe.r - ar - 22 * u, ay = H - safe.b - ar - 30 * u;
  const btnA = [ax - ar, ay - ar, ar * 2, ar * 2];
  const act = !!tgt, pulse = act ? 1 + Math.sin(G.time * 8) * 0.06 : 1;
  ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(ax, ay, ar * pulse, 0, 7); ctx.fill();
  ctx.fillStyle = act ? (tgt.kind === 'boss' ? PAL.red : PAL.gold) : '#9aa88a'; ctx.beginPath(); ctx.arc(ax, ay, (ar - 4 * u) * pulse, 0, 7); ctx.fill();
  text(act ? tgt.label : 'A', ax, ay, { size: act ? 14 : 24, align: 'center', color: act && tgt.kind === 'boss' ? '#fff' : PAL.dark });
  input.block = [btnA, btnM];
  input.zone = [0, H * (W > H ? 0.2 : 0.3), W * 0.6, H];
  if (hit(...btnA)) interact(G.target);
}

function drawToast() {
  if (!G.toast) return;
  const { W, H, u } = G, w = Math.min(W - 30 * u, 360 * u), lines = wrap(G.toast.text, w - 20 * u, 12), h = 12 * u + lines.length * 16 * u;
  const y = G.screen === 'world' ? H * 0.2 : H * 0.84;
  panel((W - w) / 2, y, w, h);
  lines.forEach((l, i) => text(l, W / 2, y + 14 * u + i * 16 * u, { size: 12, align: 'center' }));
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
  G.dt = dt; G.time += dt;
  ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  input.zone = null; input.block = [];
  const sc = G.screen;
  try {
    if (sc === 'title') drawTitle();
    else if (sc === 'starter') drawStarter();
    else if (sc === 'world') { updateWorld(dt); if (G.screen === 'world') drawWorld(); }
    else if (sc === 'battle') { updateBattle(dt); drawBattle(); }
    else if (isMenuScreen(sc)) drawMenus();
    drawToast();
  } catch (err) { console.error(err); }
  if (G.toast) { G.toast.t -= dt; if (G.toast.t <= 0) G.toast = null; }
  if (G.screen !== 'world' && input.stick.on) { input.stick.on = false; input.stick.x = input.stick.y = 0; }
  endFrame();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
G.screen = 'title';
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
