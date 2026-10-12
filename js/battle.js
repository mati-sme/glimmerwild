// Turn-based battle: async flow driven by the main loop's update(dt).
import { G, gainSkill, addCreature, toast } from './state.js';
import { input } from './input.js';
import { sfx } from './audio.js';
import { C, PAL, text, wrap, panel, button, bar, fillR, chips, hit, font } from './ui.js';
import { drawCreature, drawOrb } from './sprites.js';
import { maxHp, stat, movesOf, calcDamage, effect, gainXp, xpNeed } from './creature.js';
import { SPECIES_BY_ID, BIOME_SCENE, TYPE_COLORS } from './data.js';
import { clamp, rint } from './util.js';
import { creatureRow } from './ui.js';
import { save } from './save.js';

let B = null;
export const inBattle = () => !!B;

export function catchChance(e, q, skill = G.skill.lvl) {
  const sp = SPECIES_BY_ID[e.sp];
  const hpF = 1.15 - 0.85 * (e.hp / maxHp(e));
  const sk = 1 + (skill - 1) * 0.07;
  const lvF = clamp(1.1 - e.lv * 0.012, 0.45, 1.1);
  return clamp(sp.cr * hpF * sk * lvF * { perfect: 1.6, good: 1.15, miss: 0.35 }[q], 0.02, 0.97);
}

export function startBattle({ enemy, boss, biome }) {
  const first = G.team.findIndex((c) => c.hp > 0);
  if (boss) enemy.hp = maxHp(enemy);
  B = {
    e: enemy, boss, biome: biome || 'meadow', active: Math.max(0, first), t: 0,
    disp: { p: G.team[Math.max(0, first)].hp, e: enemy.hp }, off: { p: 0, e: 0 }, shake: { p: 0, e: 0 }, flash: { p: 0, e: 0 },
    drop: { p: 0, e: 0 }, escale: 1, phase: 'busy', sub: 'main', msg: '', timers: [], tweens: [], orb: null, catchUI: null,
    sayRes: null, choiceRes: null, catchRes: null, teamRes: null, forced: false,
  };
  return new Promise((resolve) => { battleLoop().then((r) => { B = null; resolve(r); }); });
}

const pc = () => G.team[B.active];
const nm = (c) => (c === B.e && !B.boss ? 'Wild ' + c.name : c.name);
const wait = (ms) => new Promise((res) => B.timers.push({ t: ms / 1000, res }));
const tween = (o, k, to, ms) => new Promise((res) => B.tweens.push({ o, k, from: o[k], to, t: 0, d: ms / 1000, res }));
const say = (text, ms = 900) => { B.msg = text; B.phase = 'busy'; return new Promise((res) => { B.sayRes = res; B.sayT = 0; B.sayDur = ms / 1000; }); };
const choose = () => { B.phase = 'menu'; B.sub = 'main'; return new Promise((res) => { B.choiceRes = res; }); };
const chooseTeam = (forced) => { B.phase = 'team'; B.forced = forced; return new Promise((res) => { B.teamRes = res; }); };

function enemyMove() {
  const ms = movesOf(B.e);
  if (Math.random() < 0.6) {
    let best = ms[0], bv = -1;
    for (const m of ms) { const v = m.power * effect(m.type, pc().types) * (B.e.types.includes(m.type) ? 1.3 : 1); if (v > bv) { bv = v; best = m; } }
    return best;
  }
  return ms[Math.floor(Math.random() * ms.length)];
}

async function doAttack(side, mv) {
  const a = side === 'p' ? pc() : B.e, d = side === 'p' ? B.e : pc(), o = side === 'p' ? 'e' : 'p';
  await say(`${nm(a)} used ${mv.name}!`, 650);
  if (Math.random() * 100 > mv.acc) { await say('But it missed!', 650); return false; }
  await tween(B.off, side, 1, 110);
  const r = calcDamage(a, d, mv);
  r.crit ? sfx.crit() : sfx.hit();
  B.flash[o] = 0.3; B.shake[o] = 0.35;
  d.hp = Math.max(0, d.hp - r.dmg);
  tween(B.off, side, 0, 160);
  await wait(520);
  if (r.crit) await say('A critical hit!', 600);
  if (r.eff > 1) await say("It's super effective!", 700);
  else if (r.eff < 1) await say("It's not very effective...", 700);
  return d.hp <= 0;
}

async function levelMsgs(c, ev) {
  for (const e of ev) {
    sfx.levelup();
    await say(`${c.name} grew to Lv ${e.lv}!`, 1000);
    for (const l of e.learned) await say(`${c.name} learned ${l}!`, 1000);
  }
}

async function enemyDown() {
  const e = B.e;
  sfx.fail();
  await say(`${nm(e)} fainted!`, 500);
  await tween(B.drop, 'e', 1, 450);
  const gain = Math.floor((20 + e.lv * 8) * (B.boss ? 3 : 1));
  const p = pc();
  await say(`${p.name} gained ${gain} XP!`, 800);
  await levelMsgs(p, gainXp(p, gain));
  for (const c of G.team) if (c !== p && c.hp > 0) gainXp(c, Math.floor(gain / 2));
  const orbs = (B.boss ? 5 : 1) + (Math.random() < 0.4 ? 1 : 0), berries = B.boss ? 3 : Math.random() < 0.3 ? 1 : 0;
  G.orbs += orbs; G.berries += berries;
  await say(`Found ${orbs} orb${orbs > 1 ? 's' : ''}${berries ? ` and ${berries} berr${berries > 1 ? 'ies' : 'y'}` : ''}.`, 900);
  if (B.boss) {
    G.bosses[B.boss.id] = true;
    e.hp = maxHp(e);
    const where = addCreature(e);
    sfx.caught();
    await say(`${e.name} joins you! (${where === 'team' ? 'in your team' : 'sent to storage'})`, 1500);
  }
  return { result: 'win' };
}

async function playerDown() {
  const p = pc();
  await say(`${p.name} fainted!`, 500);
  await tween(B.drop, 'p', 1, 450);
  if (!G.team.some((c) => c.hp > 0)) { await say('You have no creatures left to fight...', 1400); return { result: 'lose' }; }
  const i = await chooseTeam(true);
  await switchTo(i);
  return null;
}

async function switchTo(i) {
  B.drop.p = 1;
  B.active = i; B.disp.p = pc().hp;
  await say(`Go, ${pc().name}!`, 600);
  await tween(B.drop, 'p', 0, 300);
}

function timing() {
  const e = B.e, zw = clamp(0.15 + (G.skill.lvl - 1) * 0.012 + (1 - e.hp / maxHp(e)) * 0.14, 0.15, 0.5);
  B.catchUI = { t: 0, m: 0, zc: 0.22 + Math.random() * 0.56, zw, speed: 1.0 + e.lv * 0.012 };
  B.phase = 'catch';
  return new Promise((res) => { B.catchRes = res; });
}

async function doCatch() {
  const e = B.e;
  if (B.boss) { await say('The boss shrugs off the orb! Defeat it instead!', 1300); return 'none'; }
  if (G.orbs <= 0) { await say('You have no capture orbs!', 1000); return 'none'; }
  const q = await timing();
  if (q === 'cancel') return 'none';
  G.orbs--;
  B.msg = q === 'perfect' ? 'Perfect throw!' : q === 'good' ? 'Nice throw!' : 'Off target...';
  sfx.throw();
  const miss = q === 'miss' && Math.random() < 0.4;
  B.orb = { t: 0, drop: 0, tilt: 0, open: 0, rot: 0, miss, fall: 0 };
  await tween(B.orb, 't', 1, 600);
  if (miss) {
    await tween(B.orb, 'fall', 1, 350); B.orb = null;
    sfx.fail(); await say('The orb missed!', 900); gainSkill(3); return 'fail';
  }
  sfx.hit();
  await tween(B, 'escale', 0, 250);
  await tween(B.orb, 'drop', 1, 300);
  const ok = Math.random() < catchChance(e, q);
  const shakes = ok ? 3 : rint(Math.random, 0, 2);
  for (let i = 0; i < shakes; i++) {
    await wait(300); sfx.shake();
    await tween(B.orb, 'tilt', 1, 160); await tween(B.orb, 'tilt', -1, 240); await tween(B.orb, 'tilt', 0, 160);
  }
  await wait(350);
  if (ok) {
    sfx.caught();
    const where = addCreature(e);
    await say(`Gotcha! ${e.name} was caught! ${where === 'storage' ? '(sent to storage)' : ''}`, 1500);
    const up = gainSkill(20 + e.lv * 2);
    if (up) { sfx.levelup(); await say(`Catching skill rose to Lv ${G.skill.lvl}!`, 1300); }
    return 'caught';
  }
  await tween(B.orb, 'open', 1, 150); B.orb = null;
  tween(B, 'escale', 1, 200); sfx.fail();
  await say('Oh no! It broke free!', 1000);
  const up = gainSkill(6 + Math.floor(e.lv / 2));
  if (up) { sfx.levelup(); await say(`Catching skill rose to Lv ${G.skill.lvl}!`, 1300); }
  return 'fail';
}

async function battleLoop() {
  const e = B.e; G.dex.seen[e.sp] = 1;
  await say(B.boss ? `${e.name} blocks your path!` : `A wild ${e.name} appeared!`, 1100);
  while (true) {
    const act = await choose();
    let steps = [];
    if (act.k === 'move') {
      const pm = movesOf(pc())[act.i], em = enemyMove();
      const pf = stat(pc(), 'spd') * (0.9 + Math.random() * 0.2) >= stat(e, 'spd') * (0.9 + Math.random() * 0.2);
      steps = pf ? [['p', pm], ['e', em]] : [['e', em], ['p', pm]];
    } else if (act.k === 'swap') { await switchTo(act.i); steps = [['e', enemyMove()]]; }
    else if (act.k === 'berry') {
      const p = pc();
      if (G.berries <= 0 || p.hp >= maxHp(p)) { await say(G.berries <= 0 ? 'No berries left!' : `${p.name} is already healthy.`, 900); continue; }
      G.berries--; p.hp = Math.min(maxHp(p), p.hp + 35); sfx.heal();
      await say(`${p.name} munched a berry and recovered HP!`, 1000); steps = [['e', enemyMove()]];
    } else if (act.k === 'catch') {
      const r = await doCatch();
      if (r === 'caught') return { result: 'caught' };
      if (r === 'none') continue;
      steps = [['e', enemyMove()]];
    } else if (act.k === 'run') {
      if (B.boss) { await say('No escape from a boss battle!', 1000); continue; }
      const chance = clamp(0.5 + (stat(pc(), 'spd') - stat(e, 'spd')) / 80, 0.25, 0.95);
      if (Math.random() < chance) { await say('Got away safely!', 900); return { result: 'ran' }; }
      await say("Couldn't get away!", 800); steps = [['e', enemyMove()]];
    }
    for (const [side, mv] of steps) {
      if (side === 'p') {
        if (pc().hp <= 0) continue;
        if (await doAttack('p', mv)) return await enemyDown();
      } else {
        if (e.hp <= 0) continue;
        if (await doAttack('e', mv)) { const r = await playerDown(); if (r) return r; break; }
      }
    }
  }
}

export function updateBattle(dt) {
  if (!B) return;
  B.t += dt;
  for (const k of ['p', 'e']) { B.shake[k] = Math.max(0, B.shake[k] - dt); B.flash[k] = Math.max(0, B.flash[k] - dt); }
  for (let i = B.timers.length - 1; i >= 0; i--) { const t = B.timers[i]; t.t -= dt; if (t.t <= 0) { B.timers.splice(i, 1); t.res(); } }
  for (let i = B.tweens.length - 1; i >= 0; i--) {
    const t = B.tweens[i]; t.t += dt; const f = Math.min(1, t.t / t.d);
    t.o[t.k] = t.from + (t.to - t.from) * f;
    if (f >= 1) { B.tweens.splice(i, 1); t.res(); }
  }
  const sp = (cur, target, mh) => (cur === target ? cur : Math.abs(cur - target) <= 0.6 ? target : cur + Math.sign(target - cur) * Math.max(mh * 0.9, 18) * dt);
  B.disp.p = sp(B.disp.p, pc().hp, maxHp(pc()));
  B.disp.e = sp(B.disp.e, B.e.hp, maxHp(B.e));
  if (B.sayRes) {
    B.sayT += dt;
    if (B.sayT >= B.sayDur || (input.taps.length && B.sayT > 0.22)) { input.taps.length = 0; const r = B.sayRes; B.sayRes = null; r(); }
  }
  if (B.phase === 'catch' && B.catchUI) {
    const c = B.catchUI; c.t += dt;
    c.m = Math.abs(((c.t * c.speed) % 2) - 1);
  }
  if (B.orb) B.orb.rot += dt * (B.orb.t < 1 ? 14 : 0);
}

function layout() {
  const { W, H, u, safe } = G;
  const ph = Math.round(clamp(H * 0.36, 150 * u, 270 * u)), sceneH = H - ph;
  const px0 = safe.l + 8 * u, pw = W - safe.l - safe.r - 16 * u, py0 = H - ph + 8 * u, phh = ph - 8 * u - Math.max(safe.b, 8 * u);
  const land = W > H * 1.1;
  return {
    ph, sceneH, land,
    msg: land ? [px0, py0, pw * 0.44, phh] : [px0, py0, pw, phh * 0.36],
    btn: land ? [px0 + pw * 0.46, py0, pw * 0.54, phh] : [px0, py0 + phh * 0.39, pw, phh * 0.61],
  };
}
const cell = (r, cols, rows, ci, ri, span = 1, gap = 6 * G.u) => {
  const cw = (r[2] - gap * (cols - 1)) / cols, ch = (r[3] - gap * (rows - 1)) / rows;
  return [r[0] + ci * (cw + gap), r[1] + ri * (ch + gap), cw * span + gap * (span - 1), ch];
};

function infoBox(c, x, y, w, disp, own) {
  const u = G.u, h = (own ? 62 : 58) * u;
  panel(x, y, w, h);
  text(c.name, x + 8 * u, y + 13 * u, { size: 13, maxW: w * 0.62 });
  text('Lv' + c.lv, x + w - 8 * u, y + 13 * u, { size: 12, align: 'right', color: PAL.mid });
  bar(x + 8 * u, y + 24 * u, w - 16 * u, 8 * u, disp / maxHp(c));
  if (own) {
    text(`${Math.ceil(disp)}/${maxHp(c)}`, x + w - 8 * u, y + 41 * u, { size: 10, align: 'right', color: PAL.mid });
    bar(x + 8 * u, y + 47 * u, w - 16 * u, 4 * u, c.xp / xpNeed(c.lv), '#4890e0');
    chips(c.types, x + 8 * u, y + 35 * u, 11);
  } else chips(c.types, x + 8 * u, y + 37 * u, 12);
}

export function drawBattle() {
  if (!B) return;
  const ctx = C(), { W, H, u, safe } = G, L = layout(), sh = L.sceneH;
  const [sky, gr] = BIOME_SCENE[B.biome] || BIOME_SCENE.meadow;
  fillR(0, 0, W, sh, sky); fillR(0, sh * 0.5, W, sh * 0.5 + 2, gr);
  fillR(0, sh * 0.5, W, 3 * u, 'rgba(0,0,0,.18)');
  const e = B.e, p = pc();
  const es = Math.min(W * 0.4, sh * 0.44) * (B.boss ? 1.25 : 1), ps = Math.min(W * 0.46, sh * 0.5);
  const ex = W * 0.7, ey = sh * 0.46, pxx = W * 0.27, pyy = sh * 0.9;
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  const plat = (x, y, s) => { ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.13, 0, 0, 7); ctx.fill(); };
  plat(ex, ey, es); plat(pxx, pyy, ps);
  // enemy
  const bob = Math.sin(B.t * 3) * 2 * u;
  if (B.escale > 0.02 || B.orb) {
    const o = B.off.e, sk = B.shake.e > 0 ? Math.sin(B.t * 70) * 4 * u : 0;
    drawCreature(ctx, e.g, ex + sk - o * es * 0.1, ey - es * 0.4 + bob + o * es * 0.06 + B.drop.e * es * 0.4, es * B.escale, { flash: B.flash.e > 0 && Math.floor(B.t * 30) % 2 === 0, alpha: 1 - B.drop.e, flip: false, scaleY: B.escale });
  }
  if (B.drop.p < 0.98) {
    const o = B.off.p, sk = B.shake.p > 0 ? Math.sin(B.t * 70) * 4 * u : 0;
    drawCreature(ctx, p.g, pxx + sk + o * ps * 0.12, pyy - ps * 0.4 + bob * 0.6 - o * ps * 0.07 + B.drop.p * ps * 0.4, ps, { flip: true, flash: B.flash.p > 0 && Math.floor(B.t * 30) % 2 === 0, alpha: 1 - B.drop.p });
  }
  // orb
  if (B.orb) {
    const o = B.orb, os = 26 * u;
    let x, y;
    if (o.t < 1) { x = pxx + (ex - pxx) * o.t; y = pyy - ps * 0.4 + (ey - es * 0.3 - (pyy - ps * 0.4)) * o.t - Math.sin(o.t * Math.PI) * sh * 0.25; if (o.miss) { x += o.t * es * 0.35; } }
    else { const gx = o.miss ? ex + es * 0.35 : ex, gy = ey + es * 0.05; x = gx; y = (o.miss ? ey - es * 0.3 : ey - es * 0.3) + (gy - (ey - es * 0.3)) * Math.max(o.drop, o.fall); if (o.miss) y = ey - es * 0.3 + o.fall * es * 0.35; }
    drawOrb(ctx, x + o.tilt * 5 * u, y, os, o.t < 1 ? o.rot : o.tilt * 0.4, o.open);
  }
  // info boxes
  const bw = Math.min(W * 0.5, 230 * u);
  infoBox(e, safe.l + 10 * u, safe.t + 10 * u, bw, B.disp.e, false);
  infoBox(p, W - safe.r - bw - 10 * u, sh - 62 * u - 10 * u, bw, B.disp.p, true);
  if (B.boss) text('BOSS', safe.l + 10 * u + bw + 8 * u, safe.t + 20 * u, { size: 12, color: '#fff', shadow: PAL.red });

  // bottom panel
  fillR(0, H - L.ph, W, L.ph, PAL.dark); fillR(0, H - L.ph + 3 * u, W, L.ph, PAL.mid);
  panel(L.msg[0], L.msg[1], L.msg[2], L.msg[3]);
  const lines = wrap(B.msg, L.msg[2] - 20 * u, 13);
  lines.slice(-3).forEach((l, i) => text(l, L.msg[0] + 10 * u, L.msg[1] + 16 * u + i * 17 * u, { size: 13 }));

  if (B.phase === 'menu') drawMenu(L);
  else if (B.phase === 'catch') drawCatch(L);
  else if (B.phase === 'team') drawTeam(L);
}

function drawMenu(L) {
  const r = L.btn, take = (v) => { B.phase = 'busy'; const f = B.choiceRes; B.choiceRes = null; f(v); };
  if (B.sub === 'main') {
    const c = [cell(r, 3, 2, 0, 0), cell(r, 3, 2, 1, 0), cell(r, 3, 2, 2, 0), cell(r, 3, 2, 0, 1), cell(r, 3, 2, 1, 1, 2)];
    if (button('FIGHT', ...c[0], { size: 15 })) B.sub = 'moves';
    if (button(`ORB x${G.orbs}`, ...c[1], { size: 14, disabled: G.orbs <= 0 || !!B.boss })) take({ k: 'catch' });
    if (button(`BERRY x${G.berries}`, ...c[2], { size: 13, disabled: G.berries <= 0 })) take({ k: 'berry' });
    if (button('TEAM', ...c[3], { size: 15, disabled: G.team.filter((x) => x.hp > 0).length < 2 })) { B.sub = 'team'; chooseTeam(false).then((i) => { if (i >= 0) take({ k: 'swap', i }); else B.phase = 'menu'; B.sub = 'main'; }); }
    if (button('RUN', ...c[4], { size: 15, disabled: !!B.boss })) take({ k: 'run' });
  } else if (B.sub === 'moves') {
    const ms = movesOf(pc());
    ms.forEach((m, i) => {
      const eff = effect(m.type, B.e.types);
      const lab = m.name + (eff > 1 ? ' ▲' : eff < 1 ? ' ▼' : '');
      if (button(lab, ...cell(r, 2, 3, i % 2, Math.floor(i / 2)), { fill: m.type === 'plain' ? '#c8c8c8' : TYPE_COLORS[m.type], color: m.type === 'frost' || m.type === 'volt' || m.type === 'plain' ? PAL.dark : '#fff', size: 12 })) take({ k: 'move', i });
    });
    if (button('◀ BACK', ...cell(r, 2, 3, 0, 2, 2), { size: 13 })) B.sub = 'main';
  }
}

function drawCatch(L) {
  const { W, u } = G, c = B.catchUI, e = B.e, ctx = C();
  const mw = Math.min(W * 0.8, 360 * u), mx = (W - mw) / 2, my = L.sceneH * 0.5, mh = 26 * u;
  panel(mx - 10 * u, my - 34 * u, mw + 20 * u, mh + 74 * u);
  text('TAP to throw the orb!', W / 2, my - 16 * u, { size: 14, align: 'center' });
  fillR(mx, my, mw, mh, PAL.dark); fillR(mx + 2 * u, my + 2 * u, mw - 4 * u, mh - 4 * u, '#2a3a2a');
  const zx = mx + 2 * u + (mw - 4 * u) * (c.zc - c.zw / 2), zw = (mw - 4 * u) * c.zw;
  fillR(zx, my + 2 * u, zw, mh - 4 * u, '#58c848'); fillR(zx + zw * 0.333, my + 2 * u, zw * 0.334, mh - 4 * u, '#d8f070');
  const kx = mx + 2 * u + (mw - 4 * u) * c.m;
  fillR(kx - 3 * u, my - 4 * u, 6 * u, mh + 8 * u, '#fff'); fillR(kx - 1.5 * u, my - 4 * u, 3 * u, mh + 8 * u, PAL.red);
  text(`Base catch chance ~${Math.round(catchChance(e, 'good') * 100)}%  |  Skill Lv ${G.skill.lvl}`, W / 2, my + mh + 16 * u, { size: 11, align: 'center', color: PAL.mid });
  text('Weaker creature = bigger target', W / 2, my + mh + 30 * u, { size: 10, align: 'center', color: PAL.mid });
  if (button('CANCEL', ...cell(L.btn, 2, 3, 0, 2, 1), { size: 13 })) { B.phase = 'busy'; const f = B.catchRes; B.catchRes = null; f('cancel'); return; }
  if (c.t > 0.35 && input.taps.length) {
    input.taps.length = 0;
    const d = Math.abs(c.m - c.zc), q = d <= c.zw / 6 ? 'perfect' : d <= c.zw / 2 ? 'good' : 'miss';
    B.phase = 'busy'; const f = B.catchRes; B.catchRes = null; f(q);
  } else if (c.t <= 0.35) input.taps.length = 0;
}

function drawTeam(L) {
  const { W, H, u, safe } = G;
  fillR(0, 0, W, H, 'rgba(15,56,15,.88)');
  text(B.forced ? 'Choose your next creature!' : 'Switch creature', W / 2, safe.t + 22 * u, { size: 16, align: 'center', color: PAL.pale });
  const cols = W > H * 1.1 ? 2 : 1, top = safe.t + 44 * u, rh = Math.min(62 * u, (H - top - 70 * u - safe.b) / Math.ceil(6 / cols) - 6 * u);
  const cw = (W - safe.l - safe.r - 24 * u - (cols - 1) * 8 * u) / cols;
  G.team.forEach((c, i) => {
    const x = safe.l + 12 * u + (i % cols) * (cw + 8 * u), y = top + Math.floor(i / cols) * (rh + 6 * u);
    if (creatureRow(c, x, y, cw, rh, { disabled: c.hp <= 0 || i === B.active, sel: i === B.active })) { B.phase = 'busy'; const f = B.teamRes; B.teamRes = null; f(i); }
  });
  if (!B.forced && button('CANCEL', W / 2 - 80 * u, H - safe.b - 54 * u, 160 * u, 44 * u)) { B.phase = 'busy'; const f = B.teamRes; B.teamRes = null; f(-1); }
}
