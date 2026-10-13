// Canvas rendering for combat: mob/pet sprites, telegraphs, projectiles, floaters. S = { sx, sy, ts, u, W, H }.
import { G } from './state.js';
import { K, radiusOf, isCatchable, activePet } from './combat.js';
import { drawCreature, drawOrb } from './sprites.js';
import { drawIcon } from './icons.js';
import { text, PAL, fillR } from './ui.js';
import { maxHp } from './creature.js';
import { TYPE_COLORS } from './data.js';
import { weapon } from './gear.js';

const shadow = (ctx, x, y, r) => { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, 7); ctx.fill(); };
const onScreen = (S, x, y, m) => x > -m && x < S.W + m && y > -m && y < S.H + m;

// ground-level telegraphs (drawn before entities so sprites stay readable)
export function drawUnder(ctx, S, aim) {
  const { sx, sy, ts } = S, t = G.time;
  for (const o of K.grounds) {
    const x = sx(o.x), y = sy(o.y); if (!onScreen(S, x, y, 40)) continue;
    const pop = Math.max(0, o.pop) * 2.5, bob = Math.sin(t * 5 + o.x) * ts * 0.04;
    ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.15 * Math.sin(t * 6)})`; ctx.beginPath(); ctx.ellipse(x, y, ts * 0.42, ts * 0.17, 0, 0, 7); ctx.fill();
    drawOrb(ctx, x, y - ts * 0.2 - bob - pop * ts * 0.3, ts * 0.42, 0);
  }
  for (const m of G.mobs) {
    if (m.holding) continue;
    const x = sx(m.x), y = sy(m.y); if (!onScreen(S, x, y, 400)) continue;
    if (m.st === 'windup') {
      const k = 1 - Math.max(0, m.stT) / 0.5, r = (radiusOf(m) + 0.7) * ts;
      ctx.fillStyle = `rgba(230,40,30,${0.12 + k * 0.22})`; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, r * k, r * 0.55 * k, 0, 0, 7); ctx.stroke();
    }
    const pat = m.pat; if (!pat) continue;
    if (pat.k === 'charge' && pat.t < 1.0) {
      const k = Math.min(1, pat.t / 1.0), L = 9 * ts, wd = 1.25 * ts, ang = Math.atan2(pat.dy, pat.dx);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.fillStyle = `rgba(230,40,30,${0.12 + 0.12 * Math.sin(t * 20)})`; ctx.fillRect(0, -wd / 2, L, wd);
      ctx.fillStyle = 'rgba(255,70,50,.35)'; ctx.fillRect(0, -wd / 2, L * k, wd);
      ctx.strokeStyle = '#ff5040'; ctx.lineWidth = 2; ctx.strokeRect(0, -wd / 2, L, wd);
      ctx.restore();
    } else if (pat.k === 'ring' && !(pat.fired >= 1 && pat.t > 1.5)) {
      const k = Math.min(1, pat.t / 0.95), r = (1 + k * 2.2) * ts;
      ctx.strokeStyle = `rgba(255,${Math.round(120 - k * 80)},50,${0.9 - k * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, 7); ctx.stroke();
    } else if (pat.k === 'summon') {
      const r = (1.6 + Math.sin(t * 10) * 0.2) * ts; ctx.strokeStyle = 'rgba(192,128,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, 7); ctx.stroke();
    }
  }
  if (aim) drawAim(ctx, S, aim);
}

function drawAim(ctx, S, a) {
  const { sx, sy, ts } = S, p = G.player, t = G.time;
  const N = 14, dist = Math.hypot(a.tx - p.x, a.ty - p.y), h = 0.9 + dist * 0.18;
  for (let i = 1; i < N; i++) {
    const k = i / N, x = sx(p.x + (a.tx - p.x) * k), y = sy(p.y + (a.ty - p.y) * k) - Math.sin(Math.PI * k) * h * ts - ts * 0.4;
    ctx.fillStyle = a.lock ? 'rgba(120,255,140,.9)' : 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, y, Math.max(2, ts * 0.06), 0, 7); ctx.fill();
  }
  const lx = sx(a.tx), ly = sy(a.ty), pr = 1 + Math.sin(t * 10) * 0.08;
  ctx.strokeStyle = a.lock ? '#78ff8c' : '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(lx, ly, ts * 0.55 * pr, ts * 0.28 * pr, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = a.lock ? 'rgba(120,255,140,.3)' : 'rgba(255,255,255,.18)'; ctx.fill();
  drawIcon(ctx, 'orb', lx, ly - ts * 0.15, ts * 0.45);
}

function hpBar(ctx, S, x, y, w, h, f, boss) {
  f = Math.max(0, Math.min(1, f));
  fillR(x - w / 2 - 1.5, y - 1.5, w + 3, h + 3, '#142814'); fillR(x - w / 2, y, w, h, '#3a2a2a');
  fillR(x - w / 2, y, w * f, h, f > 0.5 ? '#58c848' : f > 0.25 ? '#f0c830' : '#e04838');
  if (boss) fillR(x - w / 2 + w * 0.25 - 1, y - 2, 2, h + 4, '#60c8ff'); // catch window marker
}

function drawMob(ctx, S, m) {
  const { sx, sy, ts, u } = S, x = sx(m.x), y = sy(m.y), t = G.time;
  const sz = ts * (m.boss ? 2.5 : m.minion ? 0.85 : m.elite ? 1.4 : 1.1);
  if (!onScreen(S, x, y, sz * 1.5)) return;
  if (m.holding) {
    const h = m.holding, k = Math.min(1, h.t / 0.35), wi = (h.t - 0.35) / 0.6;
    const tilt = h.t > 0.35 && wi < h.wob ? Math.sin((wi % 1) * Math.PI * 2) * 0.5 : 0;
    shadow(ctx, x, y, ts * 0.3);
    if (k < 1) drawCreature(ctx, m.c.g, x, y - sz * 0.38, sz * (1 - k), { flash: true, alpha: 1 - k });
    drawOrb(ctx, x, y - ts * 0.3, ts * 0.8 * (0.5 + k * 0.5), tilt);
    for (let i = 0; i < h.wob; i++) { ctx.fillStyle = wi > i ? '#ffd830' : 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x + (i - (h.wob - 1) / 2) * ts * 0.22, y - ts * 0.95, ts * 0.07, 0, 7); ctx.fill(); }
    if (h.t > 0.35 + h.wob * 0.6 + 0.1) drawIcon(ctx, h.ok ? 'check' : 'cross', x, y - ts * 0.95, ts * 0.55);
    return;
  }
  const bob = Math.abs(Math.sin(t * 4 + m.bob)) * ts * 0.06 * (m.st === 'idle' ? 1 : 0.4);
  shadow(ctx, x, y, sz * 0.32);
  let sc = 1, ox = 0;
  if (m.st === 'windup') { sc = 0.82 + 0.06 * Math.sin(t * 30); ox = Math.sin(t * 50) * u; }
  if (m.pat && m.pat.k === 'charge' && m.pat.t < 1) { sc = 0.8; ox = Math.sin(t * 60) * 2 * u; }
  if (m.pat && m.pat.k === 'stun') ox = Math.sin(t * 8) * 2 * u;
  const spawnK = m.minion ? Math.min(1, m.born * 3) : 1;
  if (m.elite) { // golden pulsing aura on the ground
    ctx.fillStyle = `rgba(255,208,48,${0.28 + 0.14 * Math.sin(t * 5)})`; ctx.beginPath(); ctx.ellipse(x, y - sz * 0.02, sz * 0.52, sz * 0.2, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#f0c830'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(x, y - sz * 0.02, sz * 0.52, sz * 0.2, 0, 0, 7); ctx.stroke();
  }
  drawCreature(ctx, m.c.g, x + ox, y - sz * 0.38 - bob, sz * spawnK, { flip: m.dir < 0, flash: m.flash > 0, scaleY: sc });
  if (m.boss) { // crown + glow so bosses read at a glance
    ctx.strokeStyle = `rgba(255,80,60,${0.35 + 0.2 * Math.sin(t * 4)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, sz * 0.5, sz * 0.18, 0, 0, 7); ctx.stroke();
    drawIcon(ctx, 'crown', x, y - sz * 1.0 - ts * 0.35, ts * 0.5);
  }
  if (m.st === 'windup' || (m.pat && (m.pat.k === 'charge' || m.pat.k === 'ring') && m.pat.t < 1)) text('!', x, y - sz * 0.95 - (m.boss ? ts * 0.7 : 0), { size: m.boss ? 30 : 22, align: 'center', color: '#ff3020', shadow: '#fff' });
  if (m.pat && m.pat.k === 'stun') for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; drawIcon(ctx, 'star', x + Math.cos(a) * sz * 0.3, y - sz * 0.95 + Math.sin(a) * sz * 0.08, ts * 0.28); }
  const f = m.hp / m.maxHp;
  if (m.boss) {
    hpBar(ctx, S, x, y - sz * 0.98 - ts * 0.1, sz * 0.9, 7 * u, f, true);
  } else if (f < 1 || m.aggro > 0 || m.elite) {
    const w = sz * 0.8, by = y - sz * 0.92 - bob;
    hpBar(ctx, S, x + 3 * u, by, w, (m.elite ? 7 : 5) * u, f, false);
    if (m.elite) { ctx.strokeStyle = '#f0c830'; ctx.lineWidth = 2; ctx.strokeRect(x + 3 * u - w / 2 - 2, by - 2, w + 4, 7 * u + 4); drawIcon(ctx, 'elite', x + 3 * u, by - 12 * u - Math.sin(t * 5) * 1.5 * u, 20 * u); }
    ctx.fillStyle = TYPE_COLORS[m.c.types[0]]; ctx.beginPath(); ctx.arc(x - w / 2 - 5 * u, by + 2.5 * u, 4 * u, 0, 7); ctx.fill(); ctx.strokeStyle = '#142814'; ctx.lineWidth = 1; ctx.stroke();
    if (f <= 0.35) drawIcon(ctx, 'orb', x + w / 2 + 10 * u, by + 2.5 * u, (11 + Math.sin(t * 8) * 1.5) * u);
  }
  if (m.boss && isCatchable(m)) drawIcon(ctx, 'orb', x + sz * 0.55, y - sz * 0.98, (16 + Math.sin(t * 8) * 2) * u);
}

export function mobEntities(S) { return G.mobs.map((m) => ({ y: m.y, fn: (ctx) => drawMob(ctx, S, m) })); }

export function petEntity(S) {
  const pc = activePet(), pet = K.pet; if (!pc || !pet) return null;
  return {
    y: pet.y, fn: (ctx) => {
      const { sx, sy, ts, u } = S, x = sx(pet.x), y = sy(pet.y), sz = ts * 0.85, hop = pet.hop > 0 ? Math.sin((pet.hop / 0.25) * Math.PI) * ts * 0.25 : 0;
      shadow(ctx, x, y, sz * 0.3);
      drawCreature(ctx, pc.g, x, y - sz * 0.38 - hop - Math.abs(Math.sin(G.time * 5)) * ts * 0.03, sz, { flip: pet.dir < 0, flash: pet.flash > 0 });
      if (pc.hp < maxHp(pc)) hpBar(ctx, S, x, y - sz * 0.9, sz * 0.7, 4 * u, pc.hp / maxHp(pc), false);
      ctx.fillStyle = '#58b0ff'; ctx.beginPath(); ctx.arc(x, y - sz * 1.05 - ts * 0.02, 3 * u, 0, 7); ctx.fill(); // partner marker
    },
  };
}

export function drawOver(ctx, S) {
  const { sx, sy, ts, u } = S;
  // swing arc
  const sw = K.swing;
  if (sw) {
    const k = sw.t / sw.dur, p = G.player, x = sx(p.x), y = sy(p.y) - ts * 0.45, r = (sw.reach + 0.35) * ts;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255,255,240,${1 - k})`; ctx.lineWidth = ts * 0.22 * (1 - k * 0.5);
    ctx.beginPath(); ctx.arc(x, y, r * (0.8 + k * 0.2), sw.ang - 1.1 + k * 1.0, sw.ang - 0.1 + k * 1.0); ctx.stroke();
    ctx.strokeStyle = `rgba(255,220,120,${0.7 * (1 - k)})`; ctx.lineWidth = ts * 0.09;
    ctx.beginPath(); ctx.arc(x, y, r * (0.8 + k * 0.2) + ts * 0.08, sw.ang - 1.1 + k * 1.0, sw.ang - 0.1 + k * 1.0); ctx.stroke();
    ctx.restore();
  }
  for (const o of K.throws) {
    const x = sx(o.x), y = sy(o.y);
    shadow(ctx, x, y, ts * 0.2); drawOrb(ctx, x, y - o.z * ts - ts * 0.4, ts * 0.45, G.time * 14);
  }
  for (const s of K.shots) {
    const x = sx(s.x), y = sy(s.y);
    ctx.fillStyle = s.col; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(x, y, ts * (s.big ? 0.32 : 0.24), 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x, y, ts * (s.big ? 0.18 : 0.13), 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, ts * 0.06, 0, 7); ctx.fill();
  }
  for (const q of K.proj) {
    const x = sx(q.x), y = sy(q.y) - ts * 0.3;
    ctx.fillStyle = '#142814'; ctx.beginPath(); ctx.arc(x, y, ts * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(x, y, ts * 0.17, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - ts * 0.04, y - ts * 0.04, ts * 0.06, 0, 7); ctx.fill();
  }
  for (const q of K.parts) { const a = 1 - q.t / q.life; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = q.col; const s = q.s * ts * (0.5 + a * 0.5); ctx.fillRect(sx(q.x) - s / 2, sy(q.y) - s / 2 - ts * 0.3, s, s); }
  ctx.globalAlpha = 1;
  for (const f of K.fx) {
    const k = f.t / f.life, x = sx(f.x), y = sy(f.y) - k * ts * 0.9;
    ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
    const sc = f.t < 0.12 ? 1 + (1 - f.t / 0.12) * 0.6 : 1, sz = (f.big ? 22 : 15) * sc;
    let ix = x;
    if (f.icon) { const is = (f.big ? 26 : 20) * u; if (f.txt) ix = x + is * 0.55; drawIcon(ctx, f.icon, f.txt ? x - is * 0.55 : x, y, is); }
    if (f.txt) text(f.txt, ix, y, { size: sz, align: 'center', color: f.col || '#fff', shadow: '#142814' });
    ctx.globalAlpha = 1;
  }
}
export { weapon };
