// Real-time overworld combat: mobs, bosses, player melee, pet auto-attacks, orb throwing. DOM-free logic + draw helpers.
import { G, toast, gainSkill, addCreature, stat1, SKILL_MAX } from './state.js';
import { sfx } from './audio.js';
import { maxHp, stat, movesOf, calcDamage, effect, gainXp } from './creature.js';
import { newMob, moveEntity, inSafe, trySpawnWild, tileAt, isSolidTile, CAMP } from './world.js';
import { weapon, armor, playerMaxHp, rollDrops, addMats } from './gear.js';
import { questEvent } from './quests.js';
import { SPECIES_BY_ID, TYPE_COLORS, BIOME_KEYS, SPECIES } from './data.js';
import { makeCreature } from './creature.js';
import { clamp, pick } from './util.js';

export const K = {
  fx: [], parts: [], proj: [], shots: [], throws: [], grounds: [], pet: null, petId: null, focus: null, focusT: 0,
  atkCd: 0, throwCd: 0, swing: null, inv: 0, ko: 0, pv: { x: 0, y: 0 }, face: { x: 0, y: 1 }, shake: 0, hurt: 0, lowT: 0, spawnT: 0, healCd: 0, bossBar: null,
};
const rnd = (a, b) => a + Math.random() * (b - a);
export const activePet = () => G.team.find((c) => c.hp > 0) || null;
export const playerAlive = () => K.ko <= 0;
export const isCatchable = (m) => !m.boss || m.hp <= m.maxHp * 0.25;
export const radiusOf = (m) => (m.boss ? 0.85 : m.minion ? 0.38 : 0.45);

// ---------- effects ----------
export function floater(x, y, o) { K.fx.push({ x, y, t: 0, life: o.life || 0.9, ...o }); }
export function burst(x, y, col, n = 8, sp = 3, life = 0.5) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = sp * (0.4 + Math.random() * 0.8); K.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, t: 0, life: life * (0.6 + Math.random() * 0.6), col, s: 0.12 + Math.random() * 0.1 }); }
}
const shake = (v) => { K.shake = Math.max(K.shake, v); };

// ---------- setup ----------
export function initCombat() {
  Object.assign(K, { fx: [], parts: [], proj: [], shots: [], throws: [], grounds: [], pet: null, petId: null, focus: null, focusT: 0, atkCd: 0, throwCd: 0, swing: null, inv: 0, ko: 0, pv: { x: 0, y: 0 }, shake: 0, hurt: 0, spawnT: 0, healCd: 0, bossBar: null });
  G.mobs = [];
  const mx = playerMaxHp();
  if (G.hp == null || G.hp > mx) G.hp = mx;
  if (G.hp <= 0) G.hp = mx;
  for (const b of G.world.bosses) if (!G.bosses[b.id]) G.mobs.push(spawnBoss(b));
}
function spawnBoss(b) {
  return newMob(b.c, b.x, b.y, b.biome, Math.random, { boss: b, hpMul: 5, patCd: 2, pat: null, pi: 0 });
}
export function spawnMobAt(x, y, spId, lv, o = {}) {
  const m = newMob(makeCreature(spId, lv), x, y, 'meadow', Math.random, o);
  G.mobs.push(m); return m;
}

// ---------- player ----------
export function playerAttack() {
  if (!playerAlive() || K.atkCd > 0) return false;
  const p = G.player, w = weapon(), reach = w.reach;
  let best = null, bd = 99;
  for (const m of G.mobs) {
    if (m.holding) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y) - radiusOf(m);
    if (d < reach + 0.9 && d < bd) { bd = d; best = m; }
  }
  if (best) { const d = Math.hypot(best.x - p.x, best.y - p.y) || 1; K.face = { x: (best.x - p.x) / d, y: (best.y - p.y) / d }; setDirFromFace(); }
  const f = K.face, ang = Math.atan2(f.y, f.x);
  K.swing = { t: 0, dur: 0.24, ang, reach };
  K.atkCd = Math.max(0.24, 0.4 - G.gear.w * 0.025);
  K.pv.x += f.x * 2.2; K.pv.y += f.y * 2.2;
  sfx.swing(); stat1('swings');
  let hit = 0;
  for (const m of G.mobs.slice()) {
    if (m.holding) continue;
    const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy), r = radiusOf(m);
    if (d > reach + r + 0.15) continue;
    if (d > r + 0.3 && (dx * f.x + dy * f.y) / d < 0.2) continue;
    let dmg = w.dmg * rnd(0.9, 1.1), crit = Math.random() < 0.08;
    if (crit) dmg *= 1.5;
    if (m.pat && m.pat.k === 'stun') dmg *= 1.3;
    hurtMob(m, Math.max(1, Math.round(dmg)), { kx: dx / (d || 1), ky: dy / (d || 1), kb: m.boss ? 1.5 : 8, crit });
    hit++;
  }
  if (hit) { sfx.hit(); shake(3); stat1('hits', hit); }
  return true;
}
function setDirFromFace() { const f = K.face; G.player.dir = Math.abs(f.x) > Math.abs(f.y) ? (f.x < 0 ? 2 : 3) : (f.y < 0 ? 1 : 0); }
export function setFace(x, y) { K.face = { x, y }; }

export function hurtPlayer(dmg, fx, fy) {
  if (K.inv > 0 || !playerAlive()) return;
  const def = armor().def, p = G.player;
  dmg = Math.max(1, Math.round((dmg * 100) / (100 + def)));
  G.hp = Math.max(0, G.hp - dmg);
  K.inv = 0.75; K.hurt = 0.35; shake(6);
  const d = Math.hypot(p.x - fx, p.y - fy) || 1;
  K.pv.x += ((p.x - fx) / d) * 7; K.pv.y += ((p.y - fy) / d) * 7;
  floater(p.x, p.y - 0.9, { txt: String(dmg), col: '#ff5040', big: true });
  sfx.ouch(); stat1('hurt');
  if (G.hp <= 0) {
    K.ko = 2.4; sfx.ko(); stat1('kos');
    for (const m of G.mobs) { if (m.holding) continue; m.st = 'idle'; m.aggro = 0; m.pat = null; if (m.boss) { m.hp = m.maxHp; } }
    K.focus = null;
  }
}
function respawnPlayer() {
  const w = G.world, s = w.shrine;
  G.player.x = s.x + 0.5; G.player.y = s.y + 1.6; G.hp = playerMaxHp();
  for (const c of G.team) c.hp = maxHp(c);
  K.ko = 0; K.inv = 1.5; sfx.heal();
  burst(G.player.x, G.player.y, '#a0f4ff', 18, 4, 0.8);
}
function healAtShrine() {
  const s = G.world.shrine, p = G.player;
  if (!playerAlive() || K.healCd > 0 || Math.hypot(s.x + 0.5 - p.x, s.y + 0.5 - p.y) > 2.6) return;
  const need = G.hp < playerMaxHp() || G.team.some((c) => c.hp < maxHp(c));
  if (!need) return;
  G.hp = playerMaxHp(); for (const c of G.team) c.hp = maxHp(c);
  if (G.orbs < 5) G.orbs = 5;
  K.healCd = 3; sfx.heal(); burst(p.x, p.y - 0.4, '#ff8aa8', 14, 3, 0.9);
  floater(p.x, p.y - 1.2, { icon: 'heart', col: '#e8483c', life: 1.3, big: true });
}

// ---------- mobs ----------
export function hurtMob(m, dmg, o = {}) {
  if (m.holding || m.hp <= 0) return;
  m.hp -= dmg; m.flash = 0.13; m.aggro = 10;
  if (o.kb) { m.vx += (o.kx || 0) * o.kb; m.vy += (o.ky || 0) * o.kb; }
  if (!o.fromPet) { K.focus = m; K.focusT = 7; }
  if (m.st === 'windup' && !m.boss) { m.st = 'stun'; m.stT = 0.35; }
  const col = o.eff > 1 ? '#ffd830' : o.eff < 1 ? '#b0b8b0' : o.crit ? '#ffb040' : '#ffffff';
  floater(m.x + rnd(-0.2, 0.2), m.y - 0.7, { txt: String(dmg) + (o.eff > 1 ? '▲' : o.eff < 1 ? '▼' : ''), col, big: !!(o.crit || o.eff > 1) });
  burst(m.x, m.y - 0.3, o.fromPet ? o.color || '#fff' : '#fff6c0', o.crit ? 9 : 5, 2.5, 0.35);
  if (m.hp <= 0) killMob(m);
}

export function killMob(m) {
  const i = G.mobs.indexOf(m); if (i >= 0) G.mobs.splice(i, 1);
  if (K.focus === m) K.focus = null;
  const lv = m.c.lv, boss = !!m.boss;
  burst(m.x, m.y - 0.4, boss ? '#ffd830' : '#ffffff', boss ? 36 : 14, boss ? 6 : 4, 0.8);
  if (boss) { sfx.boom(); shake(12); } else sfx.fail();
  if (m.minion) { addMats([{ k: 'hide', n: 1 }]); floater(m.x, m.y - 0.8, { icon: 'hide', txt: '+1', life: 1.2 }); return; }
  const drops = rollDrops(lv, boss);
  addMats(drops);
  drops.forEach((d, j) => floater(m.x + (j - drops.length / 2) * 0.45, m.y - 0.8 - j * 0.12, { icon: d.k, txt: '+' + d.n, life: 1.4 }));
  const hide = drops.filter((d) => d.k === 'hide').reduce((a, d) => a + d.n, 0);
  if (Math.random() < (boss ? 1 : 0.25)) K.grounds.push({ x: m.x + rnd(-0.5, 0.5), y: m.y + rnd(-0.3, 0.5), age: 0, pop: 0.4 });
  if (boss) { G.bosses[m.boss.id] = true; G.orbs += 5; G.berries += 2; toast(`${m.c.name} defeated!`, 3); }
  awardXp(Math.floor((20 + lv * 8) * (boss ? 3 : 1)), m.x, m.y);
  stat1('kills'); questEvent('kill'); questEvent('hide', hide); if (boss) questEvent('boss');
}
function awardXp(gain, x, y) {
  const lead = activePet(); if (!lead) return;
  floater(x, y - 1.3, { icon: 'star', txt: '+' + gain, col: '#60a8ff', life: 1.3 });
  for (const c of G.team) {
    const ev = gainXp(c, c === lead ? gain : Math.floor(gain / 2));
    if (ev.length && c === lead) {
      sfx.levelup(); const e = ev[ev.length - 1];
      floater(G.player.x, G.player.y - 1.6, { txt: `LV ${e.lv}!`, col: '#ffd830', big: true, life: 1.8, icon: 'paw' });
      toast(`${c.name} reached Lv ${e.lv}!${e.learned.length ? ' Learned ' + e.learned.join(', ') : ''}`, 3);
    }
  }
}

const mobSpeed = (m) => Math.min(3.0, 1.15 + stat(m.c, 'spd') / 48) * (m.boss ? 0.8 : 1);
const mobDmg = (m) => (4 + stat(m.c, 'atk') * 0.3 + m.c.lv * 0.6) * (m.boss ? 1.15 : 1) * rnd(0.9, 1.1);
function mobMove(m, dx, dy, dt, r = 0.22) { if (!moveEntity(G.world, m, dx * dt, dy * dt, m.boss ? 0.5 : r)) return false; return true; }

function chooseTarget(m) {
  const p = G.player, pet = K.pet && activePet() ? K.pet : null;
  const dp = playerAlive() ? Math.hypot(p.x - m.x, p.y - m.y) : 99;
  const dq = pet ? Math.hypot(pet.x - m.x, pet.y - m.y) : 99;
  if (pet && dq < dp * 0.7 && dq < 3.5) return { kind: 'pet', x: pet.x, y: pet.y, d: dq };
  return { kind: 'player', x: p.x, y: p.y, d: dp };
}

function strike(m, tgt, mult = 1) {
  if (tgt.kind === 'player') hurtPlayer(mobDmg(m) * mult, m.x, m.y);
  else hurtPet(m, mult);
}
export function hurtPet(m, mult = 1) {
  const pc = activePet(), pet = K.pet; if (!pc || !pet) return;
  const ms = movesOf(m.c); let mv = ms[0], bv = -1;
  for (const x of ms) { const v = x.power * effect(x.type, pc.types); if (v > bv) { bv = v; mv = x; } }
  const r = calcDamage(m.c, pc, mv), dmg = Math.max(1, Math.round(r.dmg * 0.55 * mult * (m.boss ? 1.3 : 1)));
  pc.hp = Math.max(0, pc.hp - dmg); pet.flash = 0.15;
  floater(pet.x, pet.y - 0.7, { txt: String(dmg), col: '#ff9070' });
  sfx.thud();
  if (pc.hp <= 0) { sfx.ko(); floater(pet.x, pet.y - 1, { icon: 'skull', life: 1.6, big: true }); burst(pet.x, pet.y, '#ffffff', 10, 3, 0.6); toast(`${pc.name} was knocked out! Visit the shrine.`, 3); K.petId = null; }
}

function updateMobs(dt) {
  const w = G.world, p = G.player, safe = inSafe(p.x, p.y), alive = playerAlive();
  const mobs = G.mobs;
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.holding) continue;
    m.flash -= dt; m.born += dt; m.cd -= dt; m.aggro = Math.max(0, m.aggro - dt);
    // knockback
    if (Math.abs(m.vx) + Math.abs(m.vy) > 0.05) { moveEntity(w, m, m.vx * dt, m.vy * dt, m.boss ? 0.5 : 0.22); const k = Math.exp(-9 * dt); m.vx *= k; m.vy *= k; }
    if (m.boss) { bossUpdate(m, dt, safe, alive); continue; }
    const tgt = chooseTarget(m), dP = Math.hypot(p.x - m.x, p.y - m.y);
    const aggroR = m.minion ? 20 : 4.6 + Math.min(2, m.c.lv * 0.05);
    const wantFight = alive && !safe && (dP < aggroR || m.aggro > 0);
    const rng = radiusOf(m) + 0.55;
    switch (m.st) {
      case 'idle': {
        if (wantFight) { m.st = 'chase'; break; }
        m.wait -= dt;
        const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
        if (d > 0.06) {
          const s = Math.min(d, 1.1 * dt);
          const px = m.x, py = m.y;
          if (!moveEntity(w, m, (dx / d) * s, (dy / d) * s, 0.22) || inSafe(m.x, m.y)) { m.x = px; m.y = py; m.tx = m.x; m.ty = m.y; }
          if (Math.abs(dx) > 0.02) m.dir = dx < 0 ? -1 : 1;
        } else if (m.wait <= 0) { m.wait = 1 + Math.random() * 3; m.tx = m.hx + rnd(-3, 3); m.ty = m.hy + rnd(-3, 3); }
        break;
      }
      case 'chase': {
        if (!wantFight && dP > aggroR * 1.8) { m.st = 'idle'; break; }
        if (!alive) { m.st = 'idle'; break; }
        const dx = tgt.x - m.x, dy = tgt.y - m.y, d = Math.hypot(dx, dy) || 1, sp = mobSpeed(m);
        if (d > rng * 0.8) {
          const px = m.x, py = m.y;
          mobMove(m, (dx / d) * sp, (dy / d) * sp, dt);
          if (inSafe(m.x, m.y)) { m.x = px; m.y = py; }
          m.dir = dx < 0 ? -1 : 1;
        }
        if (d <= rng && m.cd <= 0) { m.st = 'windup'; m.stT = 0.5; m.tgt = tgt.kind; if (dP < 8) sfx.warn(); }
        break;
      }
      case 'windup': {
        m.stT -= dt;
        if (m.stT <= 0) {
          const t2 = m.tgt === 'pet' && K.pet ? { kind: 'pet', x: K.pet.x, y: K.pet.y } : { kind: 'player', x: p.x, y: p.y };
          const dx = t2.x - m.x, dy = t2.y - m.y, d = Math.hypot(dx, dy) || 1;
          m.vx += (dx / d) * 6; m.vy += (dy / d) * 6;
          if (d <= rng + 0.35) strike(m, t2);
          burst(m.x + (dx / d) * 0.5, m.y + (dy / d) * 0.5, '#ffb0a0', 4, 2, 0.25);
          m.st = 'recover'; m.stT = 0.45; m.cd = 1.0 + Math.random() * 0.7;
        }
        break;
      }
      case 'recover': case 'stun': m.stT -= dt; if (m.stT <= 0) m.st = alive ? 'chase' : 'idle'; break;
      default: m.st = 'idle';
    }
  }
  // soft separation so mobs do not stack
  for (let i = 0; i < mobs.length; i++) for (let j = i + 1; j < mobs.length; j++) {
    const a = mobs[i], b = mobs[j]; if (a.holding || b.holding) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = radiusOf(a) + radiusOf(b) - 0.1;
    if (d > 0 && d < min) { const k = ((min - d) / d) * 0.25; if (!a.boss) moveEntity(w, a, -dx * k, -dy * k, 0.2); if (!b.boss) moveEntity(w, b, dx * k, dy * k, 0.2); }
  }
}

// ---------- bosses ----------
function bossUpdate(m, dt, safe, alive) {
  const p = G.player, w = G.world, dP = Math.hypot(p.x - m.x, p.y - m.y);
  const frac = m.hp / m.maxHp, phase2 = frac < 0.5;
  m.hurtFrac = frac;
  if (m.st === 'idle') {
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.05 * dt);
    if (alive && !safe && dP < 10) { m.st = 'fight'; m.patCd = 1.6; sfx.warn(); toast(`${m.c.name} appears!`, 2); }
    return;
  }
  if (!alive || safe || dP > 24) { m.st = 'idle'; m.pat = null; m.vx = m.vy = 0; return; }
  const pat = m.pat;
  const face = (x, y) => { m.dir = x < m.x ? -1 : 1; };
  face(p.x, p.y);
  if (!pat) {
    // approach to ~3 tiles, then pick the next pattern
    const dx = p.x - m.x, dy = p.y - m.y, d = dP || 1, sp = mobSpeed(m) * (phase2 ? 1.25 : 1);
    if (d > 3) mobMove(m, (dx / d) * sp, (dy / d) * sp, dt);
    m.patCd -= dt;
    if (m.patCd <= 0) {
      const seq = phase2 ? ['ring', 'charge', 'summon', 'charge'] : ['charge', 'ring', 'summon', 'ring'];
      let k = seq[m.pi++ % seq.length];
      if (k === 'summon' && G.mobs.filter((x) => x.minion).length >= 3) k = 'ring';
      m.pat = { k, t: 0, dx: 0, dy: 0, did: false };
      if (k === 'charge') sfx.charge(); else sfx.warn();
    }
    return;
  }
  pat.t += dt;
  if (pat.k === 'charge') {
    // telegraph 1.0s (aim locks for the last 0.3s), dash 0.65s, dizzy 1.3s
    if (pat.t < 0.7) { const d = dP || 1; pat.dx = (p.x - m.x) / d; pat.dy = (p.y - m.y) / d; }
    else if (pat.t < 1.0) { /* locked */ }
    else if (pat.t < 1.65) {
      if (!pat.go) { pat.go = true; sfx.boom(); }
      const sp = phase2 ? 10 : 8.5;
      if (!moveEntity(w, m, pat.dx * sp * dt, pat.dy * sp * dt, 0.5)) pat.t = 1.65;
      if (!pat.did) {
        if (Math.hypot(p.x - m.x, p.y - m.y) < 1.25) { hurtPlayer(mobDmg(m) * 1.2, m.x, m.y); pat.did = true; }
        if (K.pet && activePet() && Math.hypot(K.pet.x - m.x, K.pet.y - m.y) < 1.1) { hurtPet(m, 1.2); pat.did = true; }
      }
    } else if (pat.t < 3.0) { pat.k2 = 'stun'; m.pat = { ...pat, k: 'stun' }; }
  } else if (pat.k === 'stun') {
    if (pat.t > 3.0) { m.pat = null; m.patCd = phase2 ? 1.2 : 2.0; }
  } else if (pat.k === 'ring') {
    const rings = phase2 ? 2 : 1;
    if (!pat.fired) pat.fired = 0;
    const when = 0.95 + pat.fired * 0.55;
    if (pat.fired < rings && pat.t >= when) {
      const n = phase2 ? 16 : 12, off = pat.fired * (Math.PI / n);
      for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; K.proj.push({ x: m.x, y: m.y, vx: Math.cos(a) * 3.8, vy: Math.sin(a) * 3.8, t: 0, life: 3.2, r: 0.3, dmg: mobDmg(m) * 0.6, col: TYPE_COLORS[m.c.types[0]] || '#f55' }); }
      pat.fired++; sfx.boom();
    }
    if (pat.fired >= rings && pat.t > when + 0.5) { m.pat = null; m.patCd = phase2 ? 1.3 : 2.1; }
  } else if (pat.k === 'summon') {
    if (!pat.did && pat.t > 0.9) {
      pat.did = true; sfx.start();
      const list = SPECIES.filter((s) => s.biomes.includes(m.biome)), n = phase2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.28 + Math.random(), x = m.x + Math.cos(a) * 2.2, y = m.y + Math.sin(a) * 2.2;
        const mn = newMob(makeCreature((list.length ? pick(Math.random, list) : SPECIES[0]).id, Math.max(2, m.c.lv - 5)), x, y, m.biome, Math.random, { minion: true, hpMul: 0.45, st: 'chase', aggro: 99 });
        G.mobs.push(mn); burst(x, y, '#c080ff', 10, 3, 0.5);
      }
    }
    if (pat.t > 1.6) { m.pat = null; m.patCd = 2.0; }
  }
}

// ---------- pet ----------
function updatePet(dt) {
  const pc = activePet(), p = G.player;
  if (!pc) { K.pet = null; return; }
  if (!K.pet || K.petId !== pc.id) { K.pet = { x: p.x - 0.8, y: p.y + 0.4, cd: 1, flash: 0, hop: 0, dir: 1 }; K.petId = pc.id; }
  const pet = K.pet; pet.flash -= dt; pet.cd -= dt; pet.hop -= dt;
  if (K.focusT > 0) K.focusT -= dt; else K.focus = null;
  if (K.focus && (K.focus.hp <= 0 || !G.mobs.includes(K.focus) || K.focus.holding)) K.focus = null;
  let tgt = K.focus;
  if (!tgt) { // defend against anything chasing nearby
    let bd = 3.2;
    for (const m of G.mobs) { if (m.holding || m.st === 'idle' || m.boss) continue; const d = Math.hypot(m.x - pet.x, m.y - pet.y); if (d < bd) { bd = d; tgt = m; } }
  }
  let gx, gy, sp = 4.6;
  const dpl = Math.hypot(p.x - pet.x, p.y - pet.y);
  if (tgt) {
    const dx = tgt.x - pet.x, dy = tgt.y - pet.y, d = Math.hypot(dx, dy) || 1, want = 2.1 + radiusOf(tgt);
    gx = d > want ? pet.x + (dx / d) * (d - want) : pet.x; gy = d > want ? pet.y + (dy / d) * (d - want) : pet.y;
    if (d <= 3.4 + radiusOf(tgt) && pet.cd <= 0) petAttack(pc, pet, tgt);
    pet.dir = dx < 0 ? -1 : 1;
  } else {
    const f = K.face; gx = p.x - f.x * 1.1 - f.y * 0.4; gy = p.y - f.y * 0.9 + f.x * 0.4 + 0.2;
    if (dpl < 1.3) { gx = pet.x; gy = pet.y; }
    sp = clamp(dpl * 2.2, 2.2, 6.5);
  }
  if (dpl > 14) { pet.x = p.x - 0.8; pet.y = p.y + 0.4; }
  const dx = gx - pet.x, dy = gy - pet.y, d = Math.hypot(dx, dy);
  if (d > 0.08) { const s = Math.min(d, sp * dt); moveEntity(G.world, pet, (dx / d) * s, (dy / d) * s, 0.2); if (Math.abs(dx) > 0.03) pet.dir = dx < 0 ? -1 : 1; }
}
function petAttack(pc, pet, tgt) {
  let mv = null, bv = -1;
  for (const x of movesOf(pc)) { const v = x.power * effect(x.type, tgt.c.types) * (pc.types.includes(x.type) ? 1.3 : 1); if (v > bv) { bv = v; mv = x; } }
  pet.cd = clamp(1.5 - stat(pc, 'spd') / 160, 0.8, 1.5) * 1.15; pet.hop = 0.25;
  const r = calcDamage(pc, tgt.c, mv), col = TYPE_COLORS[mv.type] || '#fff';
  K.shots.push({ x: pet.x, y: pet.y - 0.3, t: 0, dur: 0.22, m: tgt, dmg: Math.max(1, Math.round(r.dmg * 1.6 * (tgt.boss ? 0.8 : 1))), eff: r.eff, crit: r.crit, col, big: mv.power >= 60 });
  sfx.swing();
}

// ---------- orbs / catching ----------
export function catchChance(m) {
  const e = m.c, sp = SPECIES_BY_ID[e.sp];
  const hpF = 1.15 - 0.85 * (m.hp / m.maxHp), sk = 1 + (G.skill.lvl - 1) * 0.07, lvF = clamp(1.1 - e.lv * 0.012, 0.45, 1.1);
  return clamp(sp.cr * hpF * sk * lvF + (m.boss ? 0.15 : 0), 0.03, 0.97);
}
export function maxThrowRange() { return 7.5; }
// walk the line from the player toward (tx,ty) and stop before the first solid tile
export function clampLanding(tx, ty) {
  const p = G.player, dx = tx - p.x, dy = ty - p.y, len = Math.hypot(dx, dy);
  if (len < 0.01) return { x: p.x + K.face.x, y: p.y + K.face.y };
  const L = Math.min(len, maxThrowRange()); let lx = p.x, ly = p.y;
  for (let s = 0.25; s <= L + 0.001; s += 0.25) {
    const x = p.x + (dx / len) * s, y = p.y + (dy / len) * s;
    if (isSolidTile(tileAt(G.world, Math.floor(x), Math.floor(y)))) break;
    lx = x; ly = y;
  }
  return { x: lx, y: ly };
}
export function aimAssist(tx, ty) {
  let best = null, bd = 1.5;
  for (const m of G.mobs) { if (m.holding) continue; const d = Math.hypot(m.x - tx, m.y - ty); if (d < bd + radiusOf(m) * 0.5) { bd = d; best = m; } }
  return best;
}
export function nearestMob(maxD = 9) {
  let best = null, bd = maxD; const p = G.player;
  for (const m of G.mobs) { if (m.holding) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } }
  return best;
}
export function throwOrb(tx, ty, lock) {
  if (!playerAlive() || K.throwCd > 0) return false;
  if (G.orbs <= 0) { sfx.deny(); floater(G.player.x, G.player.y - 1, { icon: 'orb', txt: '0', col: '#e8483c' }); return false; }
  const p = G.player, land = clampLanding(tx, ty);
  G.orbs--; K.throwCd = 0.55; stat1('throws');
  const dist = Math.hypot(land.x - p.x, land.y - p.y);
  K.throws.push({ sx: p.x, sy: p.y, tx: land.x, ty: land.y, t: 0, dur: 0.38 + dist * 0.055, lock: lock || null, x: p.x, y: p.y, z: 0 });
  sfx.throw(); return true;
}
function updateThrows(dt) {
  K.throwCd -= dt;
  for (let i = K.throws.length - 1; i >= 0; i--) {
    const o = K.throws[i];
    o.t += dt / o.dur;
    if (o.lock && G.mobs.includes(o.lock) && !o.lock.holding) { const c = clampLanding(o.lock.x, o.lock.y); o.tx = c.x; o.ty = c.y; }
    const t = Math.min(1, o.t);
    o.x = o.sx + (o.tx - o.sx) * t; o.y = o.sy + (o.ty - o.sy) * t; o.z = Math.sin(Math.PI * t) * (0.9 + Math.hypot(o.tx - o.sx, o.ty - o.sy) * 0.18);
    if (o.t >= 1) { K.throws.splice(i, 1); landOrb(o); }
  }
}
function landOrb(o) {
  let best = null, bd = 99;
  for (const m of G.mobs) { if (m.holding) continue; const d = Math.hypot(m.x - o.tx, m.y - o.ty); if (d < radiusOf(m) + 0.55 && d < bd) { bd = d; best = m; } }
  if (!best) { K.grounds.push({ x: o.tx, y: o.ty, age: 0, pop: 0.3 }); burst(o.tx, o.ty, '#ffffff', 5, 1.5, 0.3); sfx.shake(); stat1('misses'); return; }
  stat1('orbHits');
  if (!isCatchable(best)) {
    sfx.deny(); floater(best.x, best.y - 1.1, { icon: 'shield', txt: '✕', col: '#e8483c', life: 1.3, big: true });
    K.grounds.push({ x: o.tx + rnd(-0.6, 0.6), y: o.ty + rnd(0.3, 0.8), age: 0, pop: 0.4 }); burst(best.x, best.y - 0.5, '#9ac8ff', 8, 3, 0.4);
    return;
  }
  const ok = Math.random() < catchChance(best) * (bd < 0.4 ? 1.12 : 1);
  best.holding = { t: 0, wob: ok ? 3 : Math.floor(Math.random() * 3), ok, ox: best.x, oy: best.y, lastW: -1 };
  if (K.focus === best) K.focus = null;
  best.vx = best.vy = 0; sfx.hit(); burst(best.x, best.y - 0.4, '#ffffff', 10, 3, 0.4); stat1('captureTries');
}
function updateHolding(dt) {
  for (const m of G.mobs.slice()) {
    const h = m.holding; if (!h) continue;
    h.t += dt;
    const shrink = 0.35, wobT = 0.6, wi = Math.floor((h.t - shrink) / wobT);
    if (h.t > shrink && wi >= 0 && wi < h.wob && wi !== h.lastW) { h.lastW = wi; sfx.shake(); }
    const end = shrink + h.wob * wobT + 0.55;
    if (h.t >= end) {
      if (h.ok) finishCatch(m); else breakFree(m);
    }
  }
}
function finishCatch(m) {
  const i = G.mobs.indexOf(m); if (i >= 0) G.mobs.splice(i, 1);
  const c = m.c; c.hp = maxHp(c);
  const where = addCreature(c);
  sfx.caught(); burst(m.x, m.y - 0.5, '#ffd830', 24, 4.5, 0.9); shake(4);
  floater(m.x, m.y - 1.3, { icon: 'check', txt: '', col: '#58d858', big: true, life: 1.6 });
  for (const t of c.traits) if (t !== 'Titan') G.vials[t] = (G.vials[t] || 0) + 1;
  if (c.traits.length) floater(m.x, m.y - 1.9, { icon: 'flask', txt: '+' + c.traits[0], col: '#c898ff', life: 1.8 });
  const up = gainSkill(20 + c.lv * 2);
  if (up) { sfx.levelup(); toast(`Catching skill rose to Lv ${G.skill.lvl}!`, 3); }
  toast(`${c.name} joined${where === 'storage' ? ' (sent to the base)' : ' your team'}!`, 2.6);
  stat1('catches'); questEvent('catch');
  if (m.boss) {
    G.bosses[m.boss.id] = true; const d = rollDrops(c.lv, true); addMats(d); G.orbs += 5; sfx.boom(); questEvent('boss');
  }
}
function breakFree(m) {
  m.holding = null; m.st = 'stun'; m.stT = 0.9; m.aggro = 10; m.flash = 0.2;
  sfx.fail(); burst(m.x, m.y - 0.4, '#ff8080', 10, 3, 0.4); floater(m.x, m.y - 1.1, { icon: 'cross', col: '#e8483c', life: 1.2, big: true });
  const up = gainSkill(3 + Math.floor(m.c.lv / 4)); if (up) { sfx.levelup(); toast(`Catching skill rose to Lv ${G.skill.lvl}!`, 3); }
}

// ---------- projectiles ----------
function updateProj(dt) {
  const p = G.player;
  for (let i = K.proj.length - 1; i >= 0; i--) {
    const q = K.proj[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
    let dead = q.t > q.life || isSolidTile(tileAt(G.world, Math.floor(q.x), Math.floor(q.y)));
    if (!dead && playerAlive() && Math.hypot(q.x - p.x, q.y - p.y) < q.r + 0.3) { hurtPlayer(q.dmg, q.x - q.vx, q.y - q.vy); dead = true; }
    if (!dead && K.pet && activePet() && Math.hypot(q.x - K.pet.x, q.y - K.pet.y) < q.r + 0.3) { const pc = activePet(); pc.hp = Math.max(0, pc.hp - Math.round(q.dmg * 0.4)); K.pet.flash = 0.15; floater(K.pet.x, K.pet.y - 0.7, { txt: String(Math.round(q.dmg * 0.4)), col: '#ff9070' }); if (pc.hp <= 0) { sfx.ko(); K.petId = null; floater(K.pet.x, K.pet.y - 1, { icon: 'skull', life: 1.6, big: true }); } dead = true; }
    if (dead) { burst(q.x, q.y, q.col, 3, 1.5, 0.25); K.proj.splice(i, 1); }
  }
  for (let i = K.shots.length - 1; i >= 0; i--) {
    const s = K.shots[i]; s.t += dt / s.dur;
    if (s.t >= 1) {
      K.shots.splice(i, 1);
      if (G.mobs.includes(s.m) && !s.m.holding) {
        const dx = s.m.x - s.x, dy = s.m.y - s.y, d = Math.hypot(dx, dy) || 1;
        hurtMob(s.m, s.dmg, { fromPet: true, eff: s.eff, crit: s.crit, color: s.col, kx: dx / d, ky: dy / d, kb: s.m.boss ? 0 : 3 });
        sfx.hit();
      }
    } else if (G.mobs.includes(s.m)) { s.x += (s.m.x - s.x) * Math.min(1, 12 * dt); s.y += (s.m.y - 0.3 - s.y) * Math.min(1, 12 * dt); }
  }
  for (let i = K.grounds.length - 1; i >= 0; i--) {
    const g = K.grounds[i]; g.age += dt; g.pop -= dt;
    if (playerAlive() && g.age > 0.5 && Math.hypot(g.x - p.x, g.y - p.y) < 0.85) { K.grounds.splice(i, 1); G.orbs++; sfx.pickup(); floater(p.x, p.y - 1, { icon: 'orb', txt: '+1', life: 0.9 }); stat1('pickups'); }
    else if (g.age > 120) K.grounds.splice(i, 1);
  }
}

// ---------- main update ----------
export function updateCombat(dt, move) {
  const p = G.player, w = G.world;
  K.atkCd -= dt; K.inv -= dt; K.hurt -= dt; K.healCd -= dt; K.shake = Math.max(0, K.shake - dt * 22);
  if (K.swing) { K.swing.t += dt; if (K.swing.t > K.swing.dur) K.swing = null; }
  // player movement (+ knockback)
  if (K.ko > 0) { K.ko -= dt; if (K.ko <= 0) respawnPlayer(); p.moving = false; }
  else if (move && move.len > 0) {
    K.face = { x: move.x / move.len, y: move.y / move.len }; setDirFromFace();
  }
  if (Math.abs(K.pv.x) + Math.abs(K.pv.y) > 0.05) { moveEntity(w, p, K.pv.x * dt, K.pv.y * dt); const k = Math.exp(-10 * dt); K.pv.x *= k; K.pv.y *= k; }
  // low-HP warning
  if (playerAlive() && G.hp / playerMaxHp() < 0.3) { K.lowT -= dt; if (K.lowT <= 0) { K.lowT = 1.1; sfx.warn(); } }
  // spawning
  K.spawnT -= dt;
  if (K.spawnT <= 0) {
    K.spawnT = 0.6;
    if (G.mobs.filter((m) => !m.boss && !m.minion).length < 12) { const s = trySpawnWild(w, p.x, p.y); if (s) G.mobs.push(s); }
  }
  for (let i = G.mobs.length - 1; i >= 0; i--) { const m = G.mobs[i]; if (!m.boss && !m.holding && Math.hypot(m.x - p.x, m.y - p.y) > 26) G.mobs.splice(i, 1); }
  updateMobs(dt); updatePet(dt); updateThrows(dt); updateHolding(dt); updateProj(dt);
  healAtShrine();
  for (let i = K.fx.length - 1; i >= 0; i--) { const f = K.fx[i]; f.t += dt; if (f.t > f.life) K.fx.splice(i, 1); }
  for (let i = K.parts.length - 1; i >= 0; i--) { const q = K.parts[i]; q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 6 * dt; if (q.t > q.life) K.parts.splice(i, 1); }
  // boss bar: the closest engaged boss
  K.bossBar = G.mobs.find((m) => m.boss && m.st === 'fight') || null;
}
