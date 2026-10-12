// Menu screens: main menu, team, storage, detail, training, fusion, map.
import { G, SKILL_MAX, skillNeed, addCreature, toast } from './state.js';
import { input } from './input.js';
import { sfx } from './audio.js';
import { save, wipe } from './save.js';
import { C, PAL, text, wrap, panel, button, bar, fillR, chips, hit, creatureRow, bgPattern, screenTitle } from './ui.js';
import { drawCreature } from './sprites.js';
import { maxHp, stat, xpNeed, learnset, movesOf, gainXp, fuse } from './creature.js';
import { SPECIES, TRAITS, BOSSES, BIOME_NAMES, TYPE_COLORS } from './data.js';
import { N } from './world.js';

export function go(screen, ui = {}) { G.screen = screen; G.ui = { ...ui, page: 0 }; }
let confirmBox = null;
const ask = (msg, yes, yesLabel = 'YES') => { confirmBox = { msg, yes, yesLabel }; };

function frame(title, back, actions = []) {
  const { W, H, u, safe } = G;
  bgPattern(); screenTitle(title);
  const bh = 44 * u, by = H - safe.b - bh - 10 * u, bw = Math.min(150 * u, (W - safe.l - safe.r - 40 * u) / (actions.length + 1));
  const total = bw * (actions.length + 1) + 12 * u * actions.length, x0 = (W - total) / 2;
  if (button('◀ BACK', x0, by, bw, bh, { size: 14 }) || (!confirmBox && input.keyTaps.includes('escape'))) back();
  actions.forEach((a, i) => { if (button(a.label, x0 + (bw + 12 * u) * (i + 1), by, bw, bh, { size: 14, disabled: a.disabled, fill: a.fill })) a.fn(); });
  return { x: safe.l + 10 * u, y: safe.t + 48 * u, w: W - safe.l - safe.r - 20 * u, h: by - (safe.t + 48 * u) - 10 * u };
}

function pagedList(list, area, onPick, o = {}) {
  const { u } = G, cols = G.W > G.H * 1.1 ? 2 : 1, gap = 6 * u;
  const rh = Math.min(64 * u, 58 * u);
  const rowsFit = Math.max(1, Math.floor((area.h - 34 * u + gap) / (rh + gap))), per = rowsFit * cols;
  const pages = Math.max(1, Math.ceil(list.length / per));
  G.ui.page = Math.min(G.ui.page || 0, pages - 1);
  const cw = (area.w - (cols - 1) * gap) / cols;
  list.slice(G.ui.page * per, (G.ui.page + 1) * per).forEach((c, i) => {
    const x = area.x + (i % cols) * (cw + gap), y = area.y + Math.floor(i / cols) * (rh + gap);
    if (creatureRow(c, x, y, cw, rh, { sel: o.sel && o.sel(c), disabled: o.disabled && o.disabled(c) })) onPick(c);
  });
  if (!list.length) text(o.empty || 'Nothing here yet.', area.x + area.w / 2, area.y + 40 * u, { size: 14, align: 'center', color: PAL.mid });
  if (pages > 1) {
    const by = area.y + area.h - 30 * u;
    if (button('◀', area.x + area.w / 2 - 90 * u, by, 50 * u, 30 * u, { disabled: G.ui.page === 0 })) G.ui.page--;
    text(`${G.ui.page + 1}/${pages}`, area.x + area.w / 2, by + 15 * u, { size: 13, align: 'center' });
    if (button('▶', area.x + area.w / 2 + 40 * u, by, 50 * u, 30 * u, { disabled: G.ui.page >= pages - 1 })) G.ui.page++;
  }
}

function mainMenu() {
  const { W, u } = G;
  const r = frame('MENU', () => { save(); G.screen = 'world'; });
  const col = r.w > 520 * u ? 2 : 1, gap = 8 * u;
  const cw = (Math.min(r.w, 560 * u) - gap * (col - 1)) / col, x0 = r.x + (r.w - (cw * col + gap * (col - 1))) / 2;
  const bh = 44 * u;
  const items = [
    ['TEAM (' + G.team.length + '/6)', () => go('team')], ['STORAGE (' + G.storage.length + ')', () => go('storage')],
    ['FUSION LAB', () => go('fuse', { fuse: { a: null, b: null } })], ['WORLD MAP', () => go('map')],
    ['SOUND: ' + (G.settings.sound ? 'ON' : 'OFF'), () => { G.settings.sound = !G.settings.sound; }], ['SAVE GAME', () => { save(); toast('Game saved!'); G.screen = 'world'; }],
  ];
  items.forEach(([l, fn], i) => { if (button(l, x0 + (i % col) * (cw + gap), r.y + Math.floor(i / col) * (bh + gap), cw, bh, { size: 14 })) fn(); });
  const iy = r.y + Math.ceil(items.length / col) * (bh + gap) + 4 * u, ph = Math.min(r.h - (iy - r.y) - 52 * u, 150 * u);
  if (ph > 70 * u) {
    panel(x0, iy, cw * col + gap * (col - 1), ph);
    const need = skillNeed(G.skill.lvl), ix = x0 + 12 * u;
    text(`Orbs ${G.orbs}   Berries ${G.berries}`, ix, iy + 18 * u, { size: 13 });
    text(`Catching skill Lv ${G.skill.lvl}${G.skill.lvl >= SKILL_MAX ? ' (MAX)' : ''}`, ix, iy + 38 * u, { size: 12 });
    bar(ix, iy + 48 * u, 150 * u, 8 * u, G.skill.xp / need, '#4890e0');
    const seen = Object.keys(G.dex.seen).length, caught = Object.keys(G.dex.caught).length, bd = Object.keys(G.bosses).length;
    text(`Glimdex: seen ${seen}/${SPECIES.length}  caught ${caught}/${SPECIES.length}`, ix, iy + 72 * u, { size: 12 });
    text(`Bosses beaten ${bd}/${BOSSES.length}   Time ${Math.floor(G.playtime / 60)}m`, ix, iy + 90 * u, { size: 12 });
  }
  if (button('NEW GAME (erase)', r.x + r.w / 2 - 90 * u, r.y + r.h - 34 * u, 180 * u, 34 * u, { size: 11, fill: '#d8a090' })) ask('Erase your save and start over?', () => { wipe(); location.reload(); }, 'ERASE');
}

function teamScreen() {
  const r = frame('TEAM', () => go('menu'));
  text('Tap a creature for details. First = leads battles.', G.W / 2, r.y + 8 * G.u, { size: 11, align: 'center', color: PAL.mid });
  pagedList(G.team, { ...r, y: r.y + 20 * G.u, h: r.h - 20 * G.u }, (c) => go('detail', { c, from: 'team' }));
}
function storageScreen() {
  const r = frame('STORAGE', () => go('menu'));
  pagedList(G.storage, r, (c) => go('detail', { c, from: 'storage' }), { empty: 'Storage is empty. Caught extras land here.' });
}

function removeFrom(c) { G.team = G.team.filter((x) => x !== c); G.storage = G.storage.filter((x) => x !== c); }

function detailScreen() {
  const { W, u } = G, c = G.ui.c, from = G.ui.from;
  if (!c) return go('team');
  const inTeam = G.team.includes(c);
  const r = frame(c.name.toUpperCase(), () => go(from === 'storage' ? 'storage' : 'team'));
  const land = W > G.H * 1.1, lw = land ? r.w * 0.38 : r.w;
  // left block: sprite + header
  const ss = Math.min(lw * 0.55, land ? r.h * 0.5 : 130 * u);
  panel(r.x, r.y, lw, ss + 62 * u);
  fillR(r.x + 10 * u, r.y + 10 * u, lw - 20 * u, ss, 'rgba(48,98,48,.3)');
  drawCreature(C(), c.g, r.x + lw / 2, r.y + 10 * u + ss / 2, ss * 1.05);
  text(`Lv ${c.lv}${c.gen ? '  Gen ' + c.gen : ''}`, r.x + 14 * u, r.y + ss + 24 * u, { size: 14 });
  chips(c.types, r.x + 14 * u, r.y + ss + 34 * u, 14);
  bar(r.x + 14 * u, r.y + ss + 54 * u, lw - 28 * u, 5 * u, c.xp / xpNeed(c.lv), '#4890e0');
  // right/lower block
  const rx = land ? r.x + lw + 10 * u : r.x, ry = land ? r.y : r.y + ss + 72 * u, rw = land ? r.w - lw - 10 * u : r.w;
  const hh = 78 * u + (c.traits.length ? 18 * u * c.traits.length : 14 * u);
  panel(rx, ry, rw, hh);
  const sx = rx + 12 * u, mh = maxHp(c);
  [['HP', `${c.hp}/${mh}`, c.base[0]], ['ATK', stat(c, 'atk'), c.base[1]], ['DEF', stat(c, 'def'), c.base[2]], ['SPD', stat(c, 'spd'), c.base[3]]].forEach(([l, v, b], i) => {
    const y = ry + 14 * u + i * 15 * u;
    text(l, sx, y, { size: 11 }); text(String(v), sx + 100 * u, y, { size: 11, align: 'right' });
    bar(sx + 108 * u, y - 4 * u, Math.max(40 * u, rw - 140 * u), 8 * u, b / 100, '#4890e0');
  });
  if (c.traits.length) c.traits.forEach((t, i) => text(`★ ${t}: ${TRAITS[t].desc}`, sx, ry + 80 * u + i * 16 * u, { size: 11, color: PAL.mid }));
  else text('No special traits', sx, ry + 80 * u, { size: 11, color: PAL.mid });
  const my = ry + hh + 8 * u, ls = learnset(c), known = movesOf(c);
  const mhh = Math.min(ls.length * 14 * u + 14 * u, G.H);
  panel(rx, my, rw, mhh);
  ls.forEach((x, i) => {
    const ok = x.lv <= c.lv, y = my + 13 * u + i * 14 * u;
    fillR(rx + 10 * u, y - 4 * u, 8 * u, 8 * u, ok ? (x.m.type === 'plain' ? '#a0a0a0' : TYPE_COLORS[x.m.type]) : '#b0b8a0');
    text(`${x.m.name}  pw${x.m.power}`, rx + 24 * u, y, { size: 10, color: ok ? PAL.ink : '#8a9a7a', maxW: rw - 90 * u });
    text(ok ? (known.includes(x.m) ? 'ready' : '') : `Lv${x.lv}`, rx + rw - 10 * u, y, { size: 10, align: 'right', color: PAL.mid });
  });
  // action buttons
  const by = my + mhh + 8 * u, bw = (rw - 8 * u) / 2, bh = 36 * u;
  const cd = Math.max(0, Math.ceil((c.trainAt - Date.now()) / 1000));
  const btns = [
    [cd ? `TRAIN (${cd}s)` : 'TRAIN', cd > 0, () => go('train', { c, from, st: 'ready', taps: 0, t: 0 })],
    [`BERRY (${G.berries})`, G.berries <= 0 || c.hp >= mh, () => { G.berries--; c.hp = Math.min(mh, c.hp + 35); sfx.heal(); save(); }],
    inTeam ? ['SET AS LEAD', G.team[0] === c, () => { G.team = [c, ...G.team.filter((x) => x !== c)]; save(); toast(c.name + ' leads!'); }]
      : ['TO TEAM', G.team.length >= 6, () => { G.storage = G.storage.filter((x) => x !== c); G.team.push(c); save(); go('storage'); }],
    inTeam ? ['STORE', G.team.length <= 1, () => { G.team = G.team.filter((x) => x !== c); G.storage.push(c); save(); go('team'); }]
      : ['RELEASE', false, () => ask(`Release ${c.name}? This is permanent.`, () => { removeFrom(c); save(); go('storage'); }, 'RELEASE')],
  ];
  btns.forEach(([l, dis, fn], i) => { if (button(l, rx + (i % 2) * (bw + 8 * u), by + Math.floor(i / 2) * (bh + 6 * u), bw, bh, { size: 12, disabled: dis })) fn(); });
  if (inTeam && G.team.length > 1 && button('RELEASE', rx, by + 2 * (bh + 6 * u), rw, 30 * u, { size: 11, fill: '#d8a090' })) ask(`Release ${c.name}? This is permanent.`, () => { removeFrom(c); save(); go('team'); }, 'RELEASE');
}

function trainScreen() {
  const { W, H, u, safe } = G, t = G.ui, c = t.c, dt = G.dt || 0.016;
  const r = frame('TRAINING', () => { if (t.st !== 'run') go('detail', { c, from: t.from }); });
  const cy = r.y + r.h * 0.3, ss = Math.min(r.w * 0.5, r.h * 0.4, 170 * u);
  const hop = t.st === 'run' ? Math.abs(Math.sin(t.t * 9)) * 10 * u : Math.sin(G.time * 3) * 2 * u;
  drawCreature(C(), c.g, W / 2, cy - hop, ss);
  text(`${c.name}  Lv ${c.lv}`, W / 2, cy + ss * 0.55 + 4 * u, { size: 15, align: 'center' });
  const by = r.y + r.h * 0.62, bs = Math.min(r.w * 0.8, 230 * u);
  if (t.st === 'ready') {
    text('Tap the big button as fast as you can', W / 2, by - 4 * u, { size: 12, align: 'center' });
    text('for 6 seconds to earn XP!', W / 2, by + 12 * u, { size: 12, align: 'center' });
    if (button('START', W / 2 - 80 * u, by + 30 * u, 160 * u, 54 * u, { size: 18 })) { t.st = 'run'; t.t = 0; t.taps = 0; }
  } else if (t.st === 'run') {
    t.t += dt;
    const bx = W / 2 - bs / 2, bh = Math.min(100 * u, r.y + r.h - by - 20 * u);
    const pr = input.pointers.size > 0;
    fillR(bx, by, bs, bh, PAL.dark); fillR(bx + 3 * u, by + 3 * u, bs - 6 * u, bh - 6 * u, pr ? PAL.mid : '#d8683c');
    text('TAP!!', W / 2, by + bh / 2, { size: 26, align: 'center', color: '#fff', shadow: PAL.dark });
    let n = 0;
    for (let i = 0; i < input.taps.length; i++) { const k = input.taps[i]; if (k.x >= bx && k.x <= bx + bs && k.y >= by && k.y <= by + bh) { n++; input.taps.splice(i--, 1); } }
    if (n) { t.taps += n; sfx.tap(); }
    text(`Taps: ${t.taps}`, W / 2, by - 16 * u, { size: 16, align: 'center' });
    bar(W / 2 - 100 * u, by - 40 * u, 200 * u, 10 * u, 1 - t.t / 6, '#f0c830');
    if (t.t >= 6) {
      const gain = Math.round(Math.min(t.taps, 80) * (1 + c.lv * 0.25));
      t.gain = gain; t.ev = gainXp(c, gain); t.st = 'done'; c.trainAt = Date.now() + 90000; save();
      if (t.ev.length) sfx.levelup(); else sfx.caught();
    }
  } else {
    text(`+${t.gain} XP!`, W / 2, by, { size: 22, align: 'center', color: PAL.mid });
    t.ev.forEach((e, i) => text(`Reached Lv ${e.lv}!${e.learned.length ? ' Learned ' + e.learned.join(', ') : ''}`, W / 2, by + 26 * u + i * 16 * u, { size: 12, align: 'center', maxW: r.w - 10 * u }));
    if (button('DONE', W / 2 - 70 * u, by + 34 * u + t.ev.length * 16 * u, 140 * u, 44 * u, { size: 16 })) go('detail', { c, from: t.from });
  }
}

function mapScreen() {
  const { W, u } = G, w = G.world;
  const r = frame('WORLD MAP', () => go('menu'));
  const s = Math.min(r.w, r.h - 46 * u), x0 = r.x + (r.w - s) / 2, y0 = r.y + 2;
  const ctx = C();
  fillR(x0 - 3 * u, y0 - 3 * u, s + 6 * u, s + 6 * u, PAL.dark);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(G.mapImg, x0, y0, s, s);
  const k = s / N, blink = Math.sin(G.time * 6) > 0;
  const sh = w.shrine; fillR(x0 + sh.x * k - 3 * u, y0 + sh.y * k - 1 * u, 7 * u, 3 * u, PAL.gold); fillR(x0 + sh.x * k - 1 * u, y0 + sh.y * k - 3 * u, 3 * u, 7 * u, PAL.gold);
  for (const b of w.bosses) {
    const done = G.bosses[b.id], bx = x0 + b.x * k, by = y0 + b.y * k, rr = (6 + (done ? 0 : Math.sin(G.time * 4) * 1.5)) * u;
    fillR(bx - rr, by - rr, rr * 2, rr * 2, PAL.dark); fillR(bx - rr + u, by - rr + u, rr * 2 - 2 * u, rr * 2 - 2 * u, done ? '#9a9a9a' : PAL.red);
    text(done ? '✓' : 'B', bx, by + u, { size: 9, align: 'center', color: '#fff' });
  }
  const px = x0 + G.player.x * k, py = y0 + G.player.y * k;
  fillR(px - 4 * u, py - 4 * u, 8 * u, 8 * u, PAL.dark); if (blink) fillR(px - 2.5 * u, py - 2.5 * u, 5 * u, 5 * u, '#fff');
  text('White = you   Red B = boss   Gold + = healing shrine', W / 2, y0 + s + 16 * u, { size: 11, align: 'center', color: PAL.ink, maxW: r.w });
  text(`Bosses: ${w.bosses.map((b) => (G.bosses[b.id] ? '✓' : '•')).join(' ')}`, W / 2, y0 + s + 32 * u, { size: 11, align: 'center', color: PAL.mid });
}

// ---------- fusion ----------
function fuseScreen() {
  const { W, H, u } = G, f = G.ui.fuse;
  if (f.done) return fuseResult(f);
  const key = f.a && f.b ? f.a.id + f.b.id : '';
  if (key && f.key !== key) { f.key = key; f.pre = fuse(f.a, f.b); }
  if (!key) f.pre = null;
  const can = !!f.pre;
  const r = frame('FUSION LAB', () => go('menu'), [{ label: 'FUSE!', disabled: !can, fill: '#f0c830', fn: () => ask(`Fuse ${f.a.name} + ${f.b.name}? Both parents will be consumed.`, () => doFuse(f), 'FUSE') }]);
  const gap = 6 * u, cw = (r.w - 2 * gap) / 3;
  const ss = Math.min(cw * 0.95, Math.max(50 * u, r.h - 190 * u), 110 * u);
  const cols = [['PARENT A', f.a, 0], ['RESULT', f.pre, 1], ['PARENT B', f.b, 2]];
  const compare = (v, parents, k) => parents.every((p) => p && stat(p, k) <= v) ? '#2a8a2a' : PAL.ink;
  cols.forEach(([label, c, i]) => {
    const x = r.x + i * (cw + gap), h = Math.min(r.h, ss + 156 * u), mid = i === 1;
    panel(x, r.y, cw, h, { fill: mid ? '#f4f0a8' : PAL.pale });
    text(label, x + cw / 2, r.y + 14 * u, { size: 11, align: 'center', color: PAL.mid });
    if (!mid && !c) { text('tap to', x + cw / 2, r.y + 30 * u + ss / 2 - 8 * u, { size: 12, align: 'center', color: PAL.mid }); text('choose', x + cw / 2, r.y + 30 * u + ss / 2 + 8 * u, { size: 12, align: 'center', color: PAL.mid }); }
    else if (mid && !c) text('?', x + cw / 2, r.y + 30 * u + ss / 2, { size: 30, align: 'center', color: PAL.mid });
    else {
      drawCreature(C(), c.g, x + cw / 2, r.y + 26 * u + ss / 2, ss);
      const ty = r.y + 30 * u + ss;
      text(c.name, x + cw / 2, ty, { size: 13, align: 'center', maxW: cw - 8 * u });
      text(`Lv ${c.lv}${c.gen ? ' G' + c.gen : ''}`, x + cw / 2, ty + 14 * u, { size: 11, align: 'center', color: PAL.mid });
      chips(c.types, x + cw / 2 - (c.types.length > 1 ? 36 : 17) * u, ty + 22 * u, 12);
      const pars = mid ? [f.a, f.b] : [];
      [['HP', maxHp(c), 'hp'], ['ATK', stat(c, 'atk'), 'atk'], ['DEF', stat(c, 'def'), 'def'], ['SPD', stat(c, 'spd'), 'spd']].forEach(([l, v, k], j) => {
        const y = ty + 46 * u + j * 13 * u;
        text(l, x + 8 * u, y, { size: 10, color: PAL.mid });
        const better = mid && pars.every((p) => (k === 'hp' ? maxHp(p) : stat(p, k)) <= v);
        text(String(v), x + cw - 8 * u, y, { size: 11, align: 'right', color: better ? '#2a8a2a' : PAL.ink });
      });
      text(c.traits.length ? c.traits.join(' ') : 'no traits', x + cw / 2, ty + 102 * u, { size: 10, align: 'center', color: PAL.mid, maxW: cw - 6 * u });
    }
    if (!mid && hit(x, r.y, cw, h)) go('pick', { fuse: f, slot: i === 0 ? 'a' : 'b', page: 0 });
  });
  const hint = G.team.length + G.storage.length < 2 ? 'You need at least 2 creatures to fuse.' : 'Tap a parent to choose. The child inherits genes, type & traits.';
  text(hint, W / 2, r.y + Math.min(r.h, ss + 156 * u) + 16 * u, { size: 11, align: 'center', color: PAL.mid, maxW: r.w });
}
function doFuse(f) {
  const child = fuse(f.a, f.b);
  removeFrom(f.a); removeFrom(f.b);
  const where = addCreature(child);
  f.done = { child, where, a: f.a, b: f.b }; f.a = f.b = null; f.key = '';
  sfx.levelup(); save();
}
function fuseResult(f) {
  const { W, u } = G, d = f.done, c = d.child;
  const r = frame('FUSION COMPLETE', () => { f.done = null; });
  const ss = Math.min(r.w * 0.6, r.h * 0.45, 190 * u);
  drawCreature(C(), c.g, W / 2, r.y + ss / 2 + 10 * u + Math.sin(G.time * 3) * 3 * u, ss);
  const y = r.y + ss + 34 * u;
  text(`${c.name} was born!`, W / 2, y, { size: 18, align: 'center' });
  text(`Lv ${c.lv}  Gen ${c.gen}  (${d.where === 'team' ? 'joined your team' : 'sent to storage'})`, W / 2, y + 22 * u, { size: 12, align: 'center', color: PAL.mid });
  chips(c.types, W / 2 - (c.types.length > 1 ? 36 : 17) * u, y + 34 * u, 14);
  text(`HP ${maxHp(c)}  ATK ${stat(c, 'atk')}  DEF ${stat(c, 'def')}  SPD ${stat(c, 'spd')}`, W / 2, y + 66 * u, { size: 12, align: 'center' });
  text(c.traits.length ? 'Traits: ' + c.traits.join(', ') : 'No traits', W / 2, y + 84 * u, { size: 12, align: 'center', color: PAL.mid });
}
function pickScreen() {
  const f = G.ui.fuse, slot = G.ui.slot, other = slot === 'a' ? f.b : f.a;
  const r = frame('CHOOSE PARENT', () => go('fuse', { fuse: f }));
  const list = [...G.team, ...G.storage].filter((c) => c !== other);
  pagedList(list, r, (c) => { f[slot] = c; go('fuse', { fuse: f }); }, { sel: (c) => c === f[slot] });
}

function drawConfirm() {
  const { W, H, u } = G, b = confirmBox;
  fillR(0, 0, W, H, 'rgba(15,56,15,.7)');
  const w = Math.min(W - 30 * u, 340 * u), lines = wrap(b.msg, w - 30 * u, 14), h = 90 * u + lines.length * 18 * u, x = (W - w) / 2, y = (H - h) / 2;
  panel(x, y, w, h);
  lines.forEach((l, i) => text(l, W / 2, y + 28 * u + i * 18 * u, { size: 14, align: 'center' }));
  const by = y + h - 50 * u;
  if (button('CANCEL', x + 14 * u, by, (w - 38 * u) / 2, 38 * u)) confirmBox = null;
  else if (button(b.yesLabel, x + w / 2 + 5 * u, by, (w - 38 * u) / 2, 38 * u, { fill: '#f0c830' })) { const fn = b.yes; confirmBox = null; fn(); }
}

const SCREENS = { menu: mainMenu, team: teamScreen, storage: storageScreen, detail: detailScreen, train: trainScreen, map: mapScreen, fuse: fuseScreen, pick: pickScreen };
export const isMenuScreen = (s) => !!SCREENS[s];
export function drawMenus() {
  const fn = SCREENS[G.screen]; if (!fn) return;
  if (confirmBox) { input.freeze = true; fn(); input.freeze = false; drawConfirm(); } else fn();
}
