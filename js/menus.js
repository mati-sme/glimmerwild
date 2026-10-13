// Menu screens: main menu, team, storage, detail, training, fusion, map.
import { G, SKILL_MAX, skillNeed, addCreature, toast, stat1 } from './state.js';
import { input } from './input.js';
import { sfx } from './audio.js';
import { save, wipe } from './save.js';
import { C, PAL, text, wrap, panel, button, iconButton, bar, fillR, chips, hit, creatureRow, bgPattern, screenTitle } from './ui.js';
import { drawIcon } from './icons.js';
import { drawCreature } from './sprites.js';
import { maxHp, stat, xpNeed, learnset, movesOf, gainXp, fuse, rarity, RARITY } from './creature.js';
import { SPECIES, TRAITS, BOSSES, BIOME_NAMES, TYPE_COLORS } from './data.js';
import { N, CAMP } from './world.js';
import { WEAPONS, ARMORS, MATS, MAT_KEYS, canAfford, upgrade, playerMaxHp } from './gear.js';
import { QUESTS, questText, activeQuests, progressOf, questEvent, questState, rewardBits, questCheck } from './quests.js';
import { atBase } from './base.js';
import { fuseReq, payFusion, needLevel, compatible, slotFrac, FUSE_SLOTS } from './fusion.js';

export function go(screen, ui = {}) { G.screen = screen; G.ui = { ...ui, page: 0 }; }
let confirmBox = null;
// screens opened from a base station return to the world; the menu's screens return to the menu
const up = () => { if (G.baseMode) { G.baseMode = false; G.screen = 'world'; save(); } else go('menu'); };
const ask = (msg, yes, yesLabel = 'YES') => { confirmBox = { msg, yes, yesLabel }; };

function frame(title, back, actions = [], dark = false) {
  const { W, H, u, safe } = G;
  if (dark) fillR(0, 0, W, H, '#1a0f2a'); else bgPattern();
  screenTitle(title);
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
    if (creatureRow(c, x, y, cw, rh, { sel: o.sel && o.sel(c), disabled: o.disabled && o.disabled(c), need: o.need && o.need(c), bad: o.bad && o.bad(c) })) onPick(c);
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
  const r = frame('MENU', () => { save(); G.baseMode = false; G.screen = 'world'; });
  const col = r.w > 520 * u ? 3 : 2, gap = 8 * u;
  const cw = (Math.min(r.w, 600 * u) - gap * (col - 1)) / col, x0 = r.x + (r.w - (cw * col + gap * (col - 1))) / 2;
  const bh = Math.min(84 * u, Math.max(58 * u, r.h * 0.16));
  const items = [
    ['paw', 'TEAM ' + G.team.length + '/6', () => go('team'), PAL.light], ['scroll', 'QUESTS', () => go('quests'), '#f4e08c'], ['shield', 'GEAR', () => go('forge', { view: true }), '#a8c8f0'],
    ['map', 'MAP', () => go('map'), '#b8e0a0'], [G.settings.sound ? 'sound' : 'mute', G.settings.sound ? 'SOUND ON' : 'SOUND OFF', () => { G.settings.sound = !G.settings.sound; }, PAL.light], ['save', 'SAVE', () => { save(); toast('Game saved!'); G.baseMode = false; G.screen = 'world'; }, PAL.light],
  ];
  items.forEach(([ic, l, fn, fill], i) => { if (iconButton(ic, l, x0 + (i % col) * (cw + gap), r.y + Math.floor(i / col) * (bh + gap), cw, bh, { size: 13, fill })) fn(); });
  const iy = r.y + Math.ceil(items.length / col) * (bh + gap) + 4 * u, ph = Math.min(r.h - (iy - r.y) - 44 * u, 170 * u);
  if (ph > 70 * u) {
    const pw = cw * col + gap * (col - 1);
    panel(x0, iy, pw, ph);
    const need = skillNeed(G.skill.lvl), ix = x0 + 12 * u;
    drawIcon(C(), 'orb', ix + 8 * u, iy + 18 * u, 16 * u); text(`${G.orbs}`, ix + 22 * u, iy + 18 * u, { size: 13 });
    drawIcon(C(), 'heart', ix + 64 * u, iy + 18 * u, 16 * u); text(`${Math.ceil(G.hp)}/${playerMaxHp()}`, ix + 78 * u, iy + 18 * u, { size: 13 });
    MAT_KEYS.forEach((k, i) => { drawIcon(C(), k, ix + 8 * u + i * 52 * u, iy + 40 * u, 15 * u); text(String(G.mats[k] || 0), ix + 20 * u + i * 52 * u, iy + 40 * u, { size: 12 }); });
    drawIcon(C(), 'essence', ix + 8 * u + MAT_KEYS.length * 52 * u, iy + 40 * u, 15 * u); text(String(G.essence || 0), ix + 20 * u + MAT_KEYS.length * 52 * u, iy + 40 * u, { size: 12 });
    text(`Catching skill Lv ${G.skill.lvl}${G.skill.lvl >= SKILL_MAX ? ' (MAX)' : ''}`, ix, iy + 60 * u, { size: 11 });
    bar(ix, iy + 68 * u, 150 * u, 8 * u, G.skill.xp / need, '#4890e0');
    const seen = Object.keys(G.dex.seen).length, caught = Object.keys(G.dex.caught).length, bd = Object.keys(G.bosses).length;
    text(`Glimdex ${caught}/${SPECIES.length}   Bosses ${bd}/${BOSSES.length}   ${Math.floor(G.playtime / 60)}m`, ix, iy + 92 * u, { size: 11, maxW: pw - 24 * u });
    drawIcon(C(), 'home', ix + 8 * u, iy + 116 * u, 18 * u);
    text('Storage, Fusion, Forge & Training are at your base!', ix + 24 * u, iy + 116 * u, { size: 10, color: PAL.mid, maxW: pw - 50 * u });
  }
  if (button('NEW GAME (erase)', r.x + r.w / 2 - 90 * u, r.y + r.h - 34 * u, 180 * u, 34 * u, { size: 11, fill: '#d8a090' })) ask('Erase your save and start over?', () => { wipe(); location.reload(); }, 'ERASE');
}

function teamScreen() {
  const r = frame('TEAM', up);
  text('Tap for details. The first healthy one is your partner and fights beside you.', G.W / 2, r.y + 8 * G.u, { size: 11, align: 'center', color: PAL.mid });
  pagedList(G.team, { ...r, y: r.y + 20 * G.u, h: r.h - 20 * G.u }, (c) => go('detail', { c, from: 'team' }));
}
function storageScreen() {
  const r = frame('BASE', up);
  const tab = G.ui.tab || 'team', tw = Math.min(150 * G.u, (r.w - 8 * G.u) / 2), th = 40 * G.u;
  const x0 = r.x + (r.w - (tw * 2 + 8 * G.u)) / 2;
  if (iconButton('paw', 'TEAM ' + G.team.length + '/6', x0, r.y, tw, th, { fill: tab === 'team' ? PAL.gold : PAL.light, size: 12 })) { G.ui.tab = 'team'; G.ui.page = 0; }
  if (iconButton('chest', 'STORED ' + G.storage.length, x0 + tw + 8 * G.u, r.y, tw, th, { fill: tab === 'storage' ? PAL.gold : PAL.light, size: 12 })) { G.ui.tab = 'storage'; G.ui.page = 0; }
  const area = { ...r, y: r.y + th + 8 * G.u, h: r.h - th - 8 * G.u };
  const list = tab === 'team' ? G.team : G.storage;
  pagedList(list, area, (c) => go('detail', { c, from: 'storage', tab }), { empty: tab === 'team' ? 'No team yet.' : 'Nobody lives here yet. Catch more creatures!' });
}

function removeFrom(c) { G.team = G.team.filter((x) => x !== c); G.storage = G.storage.filter((x) => x !== c); }

function detailScreen() {
  const { W, u } = G, c = G.ui.c, from = G.ui.from;
  if (!c) return go('team');
  const inTeam = G.team.includes(c);
  const r = frame(c.name.toUpperCase(), () => go(from === 'storage' ? 'storage' : 'team', { tab: G.ui.tab }));
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
    [cd ? `TRAIN (${cd}s)` : 'TRAIN', cd > 0 || !G.baseMode, () => go('train', { c, from, st: 'ready', taps: 0, t: 0, back: 'detail' })],
    [`BERRY (${G.berries})`, G.berries <= 0 || c.hp >= mh, () => { G.berries--; c.hp = Math.min(mh, c.hp + 35); sfx.heal(); save(); }],
    inTeam ? ['SET PARTNER', G.team[0] === c || c.hp <= 0, () => { G.team = [c, ...G.team.filter((x) => x !== c)]; save(); toast(c.name + ' is your partner!'); }]
      : ['TO TEAM', G.team.length >= 6 || !G.baseMode, () => { G.storage = G.storage.filter((x) => x !== c); G.team.push(c); save(); go('storage', { tab: 'storage' }); }],
    inTeam ? ['STORE', G.team.length <= 1 || !G.baseMode, () => { G.team = G.team.filter((x) => x !== c); G.storage.push(c); save(); go('storage', { tab: 'team' }); }]
      : ['RELEASE', false, () => ask(`Release ${c.name}? This is permanent.`, () => { removeFrom(c); save(); go('storage', { tab: 'storage' }); }, 'RELEASE')],
  ];
  btns.forEach(([l, dis, fn], i) => { if (button(l, rx + (i % 2) * (bw + 8 * u), by + Math.floor(i / 2) * (bh + 6 * u), bw, bh, { size: 12, disabled: dis })) fn(); });
  if (inTeam && G.team.length > 1 && button('RELEASE', rx, by + 2 * (bh + 6 * u), rw, 30 * u, { size: 11, fill: '#d8a090' })) ask(`Release ${c.name}? This is permanent.`, () => { removeFrom(c); save(); go('storage', { tab: 'team' }); }, 'RELEASE');
}

function trainScreen() {
  const { W, H, u, safe } = G, t = G.ui, c = t.c, dt = G.dt || 0.016;
  const done = () => (t.back === 'trainpick' ? go('trainpick') : go('detail', { c, from: t.from }));
  const r = frame('TRAINING', () => { if (t.st !== 'run') done(); });
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
    if (button('DONE', W / 2 - 70 * u, by + 34 * u + t.ev.length * 16 * u, 140 * u, 44 * u, { size: 16 })) done();
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
  { const hx = x0 + CAMP.cx * k, hy = y0 + CAMP.cy * k; fillR(hx - 5 * u, hy - 5 * u, 10 * u, 10 * u, PAL.dark); drawIcon(ctx, 'home', hx, hy, 11 * u); }
  for (const b of w.bosses) {
    const done = G.bosses[b.id], bx = x0 + b.x * k, by = y0 + b.y * k, rr = (6 + (done ? 0 : Math.sin(G.time * 4) * 1.5)) * u;
    fillR(bx - rr, by - rr, rr * 2, rr * 2, PAL.dark); fillR(bx - rr + u, by - rr + u, rr * 2 - 2 * u, rr * 2 - 2 * u, done ? '#9a9a9a' : PAL.red);
    text(done ? '✓' : 'B', bx, by + u, { size: 9, align: 'center', color: '#fff' });
  }
  const px = x0 + G.player.x * k, py = y0 + G.player.y * k;
  fillR(px - 4 * u, py - 4 * u, 8 * u, 8 * u, PAL.dark); if (blink) fillR(px - 2.5 * u, py - 2.5 * u, 5 * u, 5 * u, '#fff');
  text('White = you   Red B = boss   Gold + = shrine   House = base', W / 2, y0 + s + 16 * u, { size: 11, align: 'center', color: PAL.ink, maxW: r.w });
  text(`Bosses: ${w.bosses.map((b) => (G.bosses[b.id] ? '✓' : '•')).join(' ')}`, W / 2, y0 + s + 32 * u, { size: 11, align: 'center', color: PAL.mid });
}

// ---------- fusion ----------
const vialList = () => Object.keys(G.vials).filter((k) => G.vials[k] > 0 && TRAITS[k]);
function fuseScreen() {
  const { W, H, u } = G, f = G.ui.fuse;
  if (f.done) return fuseResult(f);
  if (f.vial && !(G.vials[f.vial] > 0)) f.vial = null;
  const key = f.a && f.b ? f.a.id + f.b.id + (f.vial || '') : '';
  if (key && f.key !== key) { f.key = key; f.pre = fuse(f.a, f.b, f.vial); }
  if (!key) f.pre = null;
  const req = fuseReq(f.a, f.b), can = !!f.pre && req.ready;
  const r = frame('FUSION LAB', up, [{ label: 'FUSE!', disabled: !can, fill: '#f0c830', fn: () => ask(`Fuse ${f.a.name} + ${f.b.name}? Both parents will be consumed.`, () => doFuse(f), 'FUSE') }]);
  const vials = vialList(), vh = vials.length ? 34 * u : 0, rqh = 40 * u;
  const gap = 6 * u, cw = (r.w - 2 * gap) / 3;
  const ss = Math.min(cw * 0.95, Math.max(40 * u, r.h - 190 * u - vh - rqh), 110 * u);
  const cols = [['PARENT A', f.a, 0], ['RESULT', f.pre, 1], ['PARENT B', f.b, 2]];
  cols.forEach(([label, c, i]) => {
    const x = r.x + i * (cw + gap), h = Math.min(r.h - vh - rqh, ss + 156 * u), mid = i === 1;
    panel(x, r.y, cw, h, { fill: mid ? '#f4f0a8' : PAL.pale });
    text(label, x + cw / 2, r.y + 14 * u, { size: 11, align: 'center', color: PAL.mid });
    if (!mid && !c) { drawIcon(C(), 'plus', x + cw / 2, r.y + 30 * u + ss / 2, Math.min(ss * 0.5, 40 * u), PAL.mid); text('tap', x + cw / 2, r.y + 30 * u + ss / 2 + Math.min(ss * 0.4, 30 * u), { size: 11, align: 'center', color: PAL.mid }); }
    else if (mid && !c) text('?', x + cw / 2, r.y + 30 * u + ss / 2, { size: 30, align: 'center', color: PAL.mid });
    else {
      drawCreature(C(), c.g, x + cw / 2, r.y + 26 * u + ss / 2, ss);
      const ty = r.y + 30 * u + ss, rar = rarity(c);
      text(c.name, x + cw / 2, ty, { size: 13, align: 'center', maxW: cw - 8 * u, color: RARITY[rar].c === '#9aa88a' ? PAL.ink : RARITY[rar].c });
      for (let k = 0; k <= rar; k++) drawIcon(C(), 'star', x + cw / 2 + (k - rar / 2) * 11 * u, ty + 13 * u, 10 * u, RARITY[rar].c);
      const low = !mid && c.lv < needLevel(c);
      text(`Lv ${c.lv}${low ? '/' + needLevel(c) : ''}${c.gen ? ' G' + c.gen : ''}`, x + cw / 2, ty + 26 * u, { size: 11, align: 'center', color: low ? PAL.red : PAL.mid });
      if (low) drawIcon(C(), 'lock', x + cw - 14 * u, r.y + 14 * u, 18 * u);
      chips(c.types, x + cw / 2 - (c.types.length > 1 ? 36 : 17) * u, ty + 34 * u, 12);
      const pars = mid ? [f.a, f.b] : [];
      [['HP', maxHp(c), 'hp'], ['ATK', stat(c, 'atk'), 'atk'], ['DEF', stat(c, 'def'), 'def'], ['SPD', stat(c, 'spd'), 'spd']].forEach(([l, v, k], j) => {
        const y = ty + 56 * u + j * 12 * u;
        text(l, x + 8 * u, y, { size: 10, color: PAL.mid });
        const better = mid && pars.every((p) => (k === 'hp' ? maxHp(p) : stat(p, k)) <= v);
        text(String(v), x + cw - 8 * u, y, { size: 11, align: 'right', color: better ? '#2a8a2a' : PAL.ink });
      });
      text(c.traits.length ? c.traits.join(' ') : 'no traits', x + cw / 2, ty + 108 * u, { size: 10, align: 'center', color: PAL.mid, maxW: cw - 6 * u });
    }
    if (!mid && hit(x, r.y, cw, h)) go('pick', { fuse: f, slot: i === 0 ? 'a' : 'b', page: 0 });
  });
  const py = r.y + Math.min(r.h - vh - rqh, ss + 156 * u) + 4 * u;
  if (vials.length) {
    drawIcon(C(), 'flask', r.x + 14 * u, py + 15 * u, 20 * u);
    let vx = r.x + 32 * u;
    for (const k of vials) {
      const bw = Math.min(88 * u, (r.w - 40 * u) / vials.length - 4 * u), sel = f.vial === k;
      if (button(`${k} x${G.vials[k]}`, vx, py, bw, 30 * u, { size: 11, fill: sel ? PAL.gold : PAL.light })) { f.vial = sel ? null : k; f.key = ''; }
      vx += bw + 4 * u;
    }
  }
  fuseReqRow(f, req, r.x, py + vh, r.w, rqh - 6 * u);
}
// Requirements as icons: lock+Lv (level gate), type check, essence cost, and the fusion slots as timer rings.
function fuseReqRow(f, req, x, y, w, h) {
  const { u } = G, ctx = C(), both = !!(f.a && f.b), cy = y + h / 2;
  panel(x, y, w, h, { fill: PAL.pale });
  const cell = w / 4, ok = '#2a8a2a', bad = PAL.red;
  // level gate
  let cx = x + cell * 0.5;
  const lvOk = req.lvA && req.lvB;
  drawIcon(ctx, lvOk ? 'check' : 'lock', cx - 16 * u, cy, 20 * u);
  text(`Lv ${f.a || f.b ? Math.max(req.needA, req.needB) : 10}+`, cx + 8 * u, cy, { size: 12, color: lvOk ? ok : bad });
  // type compatibility
  cx = x + cell * 1.5;
  drawIcon(ctx, 'paw', cx - 18 * u, cy, 18 * u); drawIcon(ctx, 'paw', cx - 6 * u, cy, 18 * u);
  drawIcon(ctx, !both || req.typeOk ? 'check' : 'cross', cx + 14 * u, cy, 18 * u);
  // essence cost
  cx = x + cell * 2.5;
  drawIcon(ctx, 'essence', cx - 20 * u, cy, 20 * u);
  text(both ? `${req.have}/${req.cost}` : `${req.have}`, cx + 2 * u, cy, { size: 12, color: both && !req.ess ? bad : ok });
  // slots: ring drains while a slot cools down
  cx = x + cell * 3.5;
  for (let i = 0; i < FUSE_SLOTS; i++) {
    const rx = cx - 16 * u + i * 32 * u, fr = slotFrac(i), rr = h * 0.36;
    ctx.lineWidth = 4 * u; ctx.strokeStyle = '#b8c0a0'; ctx.beginPath(); ctx.arc(rx, cy, rr, 0, 7); ctx.stroke();
    if (fr > 0) { ctx.strokeStyle = '#e8883c'; ctx.beginPath(); ctx.arc(rx, cy, rr, -Math.PI / 2, -Math.PI / 2 + fr * Math.PI * 2); ctx.stroke(); }
    else { ctx.strokeStyle = '#58c848'; ctx.beginPath(); ctx.arc(rx, cy, rr, 0, 7); ctx.stroke(); }
    drawIcon(ctx, 'timer', rx, cy, rr * 1.2, fr > 0 ? undefined : '#e4f4d0');
  }
  if (req.slot < 0) { const s = Math.ceil(req.wait / 1000); text(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, cx + 4 * u, y + h - 3 * u, { size: 9, align: 'center', color: bad }); }
}
function doFuse(f) {
  if (!payFusion(f.a, f.b)) { sfx.deny(); return; }
  const child = fuse(f.a, f.b, f.vial);
  if (f.vial) G.vials[f.vial]--;
  const pr = Math.max(rarity(f.a), rarity(f.b));
  removeFrom(f.a); removeFrom(f.b);
  const where = addCreature(child);
  f.done = { child, where, a: f.a, b: f.b, t: 0, parts: [], up: rarity(child) > pr, flashed: false, starsAt: 0 };
  f.a = f.b = null; f.key = ''; f.vial = null;
  sfx.fuse(); stat1('fuses'); questEvent('fuse'); save();
}
// Fusion reveal: parents merge -> flash -> mystery silhouette -> rarity burst.
function fuseResult(f) {
  const { W, H, u } = G, d = f.done, c = d.child, ctx = C(), dt = G.dt || 0.016, rar = rarity(c), col = RARITY[rar].c;
  d.t += dt;
  const r = frame('FUSION', () => { if (d.t > 3.4) f.done = null; }, [], true);
  if (hit(0, 0, W, H) && d.t < 3.0) d.t = 3.0;
  const t = d.t;
  const cx = W / 2, cy = r.y + r.h * 0.4, ss = Math.min(r.w * 0.55, r.h * 0.4, 180 * u);
  // rotating rays
  const rayA = t < 2.0 ? 0.12 : 0.35;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.6);
  for (let i = 0; i < 14; i++) { ctx.rotate((Math.PI * 2) / 14); ctx.fillStyle = t < 2.0 ? `rgba(184,120,240,${rayA})` : col; ctx.globalAlpha = rayA * (i % 2 ? 0.6 : 1); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, -22 * u); ctx.lineTo(W, 22 * u); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
  if (t < 1.3) { // parents slide in
    const k = t / 1.3, e = k * k, sp = (1 - e) * r.w * 0.34;
    drawCreature(ctx, d.a.g, cx - sp, cy + Math.sin(t * 14) * 4 * u, ss * (0.9 - e * 0.2), { flip: false });
    drawCreature(ctx, d.b.g, cx + sp, cy + Math.sin(t * 14 + 2) * 4 * u, ss * (0.9 - e * 0.2), { flip: true });
  } else if (t < 1.9) { // swirl + flash
    const k = (t - 1.3) / 0.6, a = k * 18;
    drawCreature(ctx, d.a.g, cx + Math.cos(a) * ss * 0.3 * (1 - k), cy + Math.sin(a) * ss * 0.15 * (1 - k), ss * (0.7 - k * 0.3), { flash: k > 0.4 });
    drawCreature(ctx, d.b.g, cx - Math.cos(a) * ss * 0.3 * (1 - k), cy - Math.sin(a) * ss * 0.15 * (1 - k), ss * (0.7 - k * 0.3), { flash: k > 0.4, flip: true });
    ctx.fillStyle = `rgba(255,255,255,${k * 0.9})`; ctx.fillRect(0, 0, W, H);
  } else if (t < 3.0) { // mystery silhouette pulsing
    const k = (t - 1.9) / 1.1, p = 1 + Math.sin(t * 16) * 0.06;
    drawCreature(ctx, c.g, cx, cy, ss * (0.6 + k * 0.4) * p, { flash: true });
    text('?', cx, cy - ss * 0.1, { size: 40, align: 'center', color: '#b060e8' });
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - k * 3)})`; ctx.fillRect(0, 0, W, H);
  } else { // reveal
    const k = Math.min(1, (t - 3.0) * 3), bounce = Math.abs(Math.sin((t - 3) * 5)) * 8 * u * Math.max(0, 1 - (t - 3) * 0.5);
    if (!d.flashed) { d.flashed = true; for (let i = 0; i < 46; i++) { const a = Math.random() * 7, v = (60 + Math.random() * 220) * u; d.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, c: Math.random() < 0.5 ? col : '#ffffff' }); } sfx.caught(); }
    drawCreature(ctx, c.g, cx, cy - bounce, ss * (0.8 + 0.2 * k));
    for (const q of d.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 160 * u * dt; ctx.globalAlpha = Math.max(0, 1 - q.t / 1.3); ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 5 * u, 5 * u); }
    ctx.globalAlpha = 1;
    const y = cy + ss * 0.62;
    text(`${c.name}!`, cx, y, { size: 22, align: 'center', color: '#fff', shadow: '#000' });
    const shown = Math.min(rar + 1, Math.floor((t - 3.2) * 4));
    for (let i = 0; i <= rar; i++) if (i < shown) drawIcon(ctx, 'star', cx + (i - rar / 2) * 24 * u, y + 26 * u, 22 * u, col);
    if (shown > d.starsAt) { d.starsAt = shown; sfx.pickup(); }
    if (shown >= rar + 1) text(RARITY[rar].n.toUpperCase() + (d.up ? '  ▲ NEW HIGH!' : ''), cx, y + 50 * u, { size: 15, align: 'center', color: col, shadow: '#000' });
    chips(c.types, cx - (c.types.length > 1 ? 36 : 17) * u, y + 62 * u, 14);
    text(`Lv ${c.lv}  Gen ${c.gen}   HP ${maxHp(c)}  ATK ${stat(c, 'atk')}  DEF ${stat(c, 'def')}  SPD ${stat(c, 'spd')}`, cx, y + 92 * u, { size: 11, align: 'center', color: '#e4eebc', maxW: r.w });
    text((c.traits.length ? c.traits.join(' + ') : 'No traits') + (d.where === 'team' ? '  • joined team' : '  • sent to base'), cx, y + 108 * u, { size: 11, align: 'center', color: '#c8b0f0', maxW: r.w });
  }
}
function pickScreen() {
  const f = G.ui.fuse, slot = G.ui.slot, other = slot === 'a' ? f.b : f.a;
  const r = frame('CHOOSE PARENT', () => go('fuse', { fuse: f }));
  const list = [...G.team, ...G.storage].filter((c) => c !== other);
  pagedList(list, r, (c) => { f[slot] = c; go('fuse', { fuse: f }); }, {
    sel: (c) => c === f[slot],
    need: (c) => (c.lv < needLevel(c) ? needLevel(c) : 0),
    bad: (c) => !!other && !compatible(c, other),
    disabled: (c) => c.lv < needLevel(c) || (!!other && !compatible(c, other)),
  });
}

// ---------- forge (gear) ----------
function costRow(cost, x, y, size) {
  let cx = x;
  for (const [k, n] of Object.entries(cost)) {
    const have = G.mats[k] || 0, ok = have >= n;
    drawIcon(C(), k, cx + size * 0.5, y, size);
    text(`${have}/${n}`, cx + size + 3 * G.u, y, { size: 12, color: ok ? '#2a8a2a' : PAL.red });
    cx += size + 46 * G.u;
  }
}
function gearCard(kind, x, y, w, h, canUp) {
  const { u } = G, list = kind === 'w' ? WEAPONS : ARMORS, cur = list[G.gear[kind]], next = list[G.gear[kind] + 1], icon = kind === 'w' ? 'sword' : 'shield';
  panel(x, y, w, h);
  drawIcon(C(), icon, x + 30 * u, y + 32 * u, 38 * u);
  text(cur.name, x + 58 * u, y + 20 * u, { size: 14, maxW: w - 70 * u });
  for (let i = 0; i < list.length; i++) drawIcon(C(), 'star', x + 66 * u + i * 14 * u, y + 40 * u, 12 * u, i <= G.gear[kind] ? '#f0c830' : '#b8c0a0');
  const v = (g) => (kind === 'w' ? g.dmg : g.hp), lab = kind === 'w' ? 'HIT' : 'HP';
  text(`${lab} ${v(cur)}${kind === 'a' ? `   DEF ${cur.def}` : ''}`, x + 14 * u, y + 66 * u, { size: 12 });
  if (!next) { text('MAX!', x + w / 2, y + h - 30 * u, { size: 20, align: 'center', color: PAL.mid }); drawIcon(C(), 'crown', x + w / 2, y + h - 58 * u, 24 * u); return; }
  drawIcon(C(), 'arrow', x + w / 2, y + 90 * u, 18 * u, '#58c848');
  text(`${next.name}  ${lab} ${v(next)}${kind === 'a' ? `  DEF ${next.def}` : ''}`, x + 14 * u, y + 112 * u, { size: 11, maxW: w - 28 * u, color: '#2a8a2a' });
  costRow(next.cost, x + 12 * u, y + 138 * u, 16 * u);
  if (canUp) {
    const ok = canAfford(next.cost);
    if (iconButton('anvil', 'UPGRADE', x + 12 * u, y + h - 52 * u, w - 24 * u, 42 * u, { fill: ok ? PAL.gold : PAL.light, disabled: !ok, size: 13 })) {
      if (upgrade(kind)) { sfx.levelup(); toast(`${next.name} ready!`); questEvent('craft'); save(); } else sfx.deny();
    }
  }
}
function forgeScreen() {
  const { u, W } = G, view = !!G.ui.view && !G.baseMode;
  const r = frame(view ? 'GEAR' : 'FORGE', up);
  const land = r.w > r.h * 1.1, gap = 8 * u, ch = Math.min(220 * u, land ? r.h - 50 * u : (r.h - 56 * u - gap) / 2), cw = land ? (r.w - gap) / 2 : Math.min(r.w, 380 * u);
  const x0 = land ? r.x : r.x + (r.w - cw) / 2;
  gearCard('w', x0, r.y, cw, ch, !view);
  gearCard('a', land ? x0 + cw + gap : x0, land ? r.y : r.y + ch + gap, cw, ch, !view);
  const my = r.y + (land ? ch : ch * 2 + gap) + 8 * u;
  MAT_KEYS.forEach((k, i) => { const mw = r.w / 4; drawIcon(C(), k, r.x + mw * i + mw * 0.3, my + 12 * u, 20 * u); text(String(G.mats[k] || 0), r.x + mw * i + mw * 0.3 + 18 * u, my + 12 * u, { size: 15 }); });
  if (view) { drawIcon(C(), 'home', W / 2 - 60 * u, my + 40 * u, 22 * u); drawIcon(C(), 'anvil', W / 2 - 30 * u, my + 40 * u, 22 * u); text('Upgrade gear at the base forge', W / 2 + 60 * u, my + 40 * u, { size: 10, color: PAL.mid, maxW: r.w * 0.5 }); }
}

// ---------- quests ----------
// Quest board: the 3 active quests with progress bars + reward icons, and a tile map of every quest (check = done, lock = later).
function rewardRow(q, x, y, size) {
  let cx = x;
  for (const [ic, n] of rewardBits(q).slice(0, 4)) { drawIcon(C(), ic, cx + size * 0.5, y, size); text('x' + n, cx + size + 1 * G.u, y, { size: 10 }); cx += size + 24 * G.u; }
}
function questsScreen() {
  const { u, W, H } = G, r = frame('QUESTS', up);
  G.questNew = false; questCheck();
  const list = activeQuests(), land = W > H * 1.1, gap = 6 * u;
  const lw = land ? r.w * 0.58 : Math.min(r.w, 480 * u), lx = land ? r.x : r.x + (r.w - lw) / 2;
  const gridH = land ? r.h : Math.min(r.h * 0.4, 5 * 40 * u + 8 * u);
  const rh = Math.max(46 * u, Math.min(78 * u, ((land ? r.h : r.h - gridH - gap) - 2 * gap) / 3));
  list.forEach((q, i) => {
    const y = r.y + i * (rh + gap), prog = progressOf(q), ready = prog >= q.n;
    panel(lx, y, lw, rh, { fill: i ? PAL.pale : '#f4f0a8' });
    drawIcon(C(), q.icon, lx + 28 * u, y + rh * 0.42, Math.min(40 * u, rh * 0.7));
    text(`${prog}/${q.n}`, lx + 56 * u, y + rh * 0.24, { size: 14 });
    bar(lx + 56 * u, y + rh * 0.4, lw - 70 * u, 11 * u, prog / q.n, ready ? '#58c848' : '#58b0ff');
    drawIcon(C(), 'gift', lx + 64 * u, y + rh * 0.78, 18 * u);
    rewardRow(q, lx + 82 * u, y + rh * 0.78, 15 * u);
    text(questText(q), lx + lw - 8 * u, y + rh * 0.24, { size: 9, align: 'right', color: PAL.mid, maxW: lw - 130 * u });
  });
  if (!list.length) { drawIcon(C(), 'crown', lx + lw / 2, r.y + 60 * u, 60 * u); text('All quests complete!', lx + lw / 2, r.y + 120 * u, { size: 16, align: 'center' }); }
  // tile map of all quests
  const cols = 6, gw = land ? r.w - lw - gap : Math.min(r.w, 480 * u), gx = land ? lx + lw + gap : lx;
  const gy = land ? r.y : r.y + 3 * (rh + gap) + 2 * u, avail = (land ? r.h : r.y + r.h - gy) - 14 * u;
  const rows = Math.ceil(QUESTS.length / cols), tile = Math.min(gw / cols, avail / rows, 46 * u);
  const gx0 = gx + (gw - tile * cols) / 2;
  QUESTS.forEach((q, i) => {
    const x = gx0 + (i % cols) * tile, y = gy + Math.floor(i / cols) * tile, st = questState(q), t = tile - 3 * u;
    fillR(x, y, t, t, PAL.dark); fillR(x + 2 * u, y + 2 * u, t - 4 * u, t - 4 * u, st === 'done' ? '#a8d890' : st === 'active' ? '#f4f0a8' : '#c8d0b8');
    drawIcon(C(), q.icon, x + t / 2, y + t / 2, t * 0.56, st === 'locked' ? '#8a9478' : undefined);
    if (st === 'done') drawIcon(C(), 'check', x + t * 0.74, y + t * 0.74, t * 0.4);
    else if (st === 'locked') drawIcon(C(), 'lock', x + t * 0.74, y + t * 0.74, t * 0.36);
  });
  const done = Object.keys(G.quests.done).length;
  text(`${done}/${QUESTS.length}`, gx + gw / 2, gy + rows * tile + 6 * u, { size: 12, align: 'center', color: PAL.mid });
}

function trainPickScreen() {
  const r = frame('TRAINING', up);
  text('Pick a creature to train', G.W / 2, r.y + 8 * G.u, { size: 11, align: 'center', color: PAL.mid });
  pagedList([...G.team, ...G.storage], { ...r, y: r.y + 20 * G.u, h: r.h - 20 * G.u }, (c) => {
    if (c.trainAt > Date.now()) { toast(`${c.name} is resting (${Math.ceil((c.trainAt - Date.now()) / 1000)}s)`); sfx.deny(); } else go('train', { c, st: 'ready', taps: 0, t: 0, back: 'trainpick' });
  });
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

const SCREENS = { menu: mainMenu, forge: forgeScreen, quests: questsScreen, trainpick: trainPickScreen, team: teamScreen, storage: storageScreen, detail: detailScreen, train: trainScreen, map: mapScreen, fuse: fuseScreen, pick: pickScreen };
export const isMenuScreen = (s) => !!SCREENS[s];
export function drawMenus() {
  const fn = SCREENS[G.screen]; if (!fn) return;
  if (confirmBox) { input.freeze = true; fn(); input.freeze = false; drawConfirm(); } else fn();
}
