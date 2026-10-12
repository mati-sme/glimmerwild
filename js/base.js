// Home base: stations (storage/team, fusion lab, forge, training) and the creatures that live and wander at camp.
import { G } from './state.js';
import { CAMP, moveEntity } from './world.js';
import { drawCreature } from './sprites.js';
import { drawIcon } from './icons.js';

export const STATION_NAMES = { chest: 'Storage & Team', lab: 'Fusion Lab', forge: 'Forge', train: 'Training' };
const crowd = new Map(); // creature id -> wanderer
const rnd = (a, b) => a + Math.random() * (b - a);

export function nearStation(p) {
  let best = null, bd = 2.0;
  for (const s of CAMP.stations) { const d = Math.hypot(s.x + 0.5 - p.x, s.y + 1.0 - p.y); if (d < bd) { bd = d; best = s; } }
  return best;
}
export const atBase = (p) => p.x > CAMP.x0 && p.x < CAMP.x1 + 1.5 && p.y > CAMP.y0 && p.y < CAMP.y1 + 1;

export function updateBase(dt) {
  const ids = new Set();
  G.storage.slice(0, 16).forEach((c) => {
    ids.add(c.id);
    if (!crowd.has(c.id)) { const x = rnd(CAMP.x0 + 1.5, CAMP.x1 - 1), y = rnd(CAMP.cy - 0.2, CAMP.y1 - 0.8); crowd.set(c.id, { c, x, y, tx: x, ty: y, wait: rnd(0, 2), dir: 1, bob: rnd(0, 6) }); }
    crowd.get(c.id).c = c;
  });
  for (const id of [...crowd.keys()]) if (!ids.has(id)) crowd.delete(id);
  for (const e of crowd.values()) {
    e.wait -= dt;
    const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
    if (d > 0.06) {
      const s = Math.min(d, 0.9 * dt);
      if (!moveEntity(G.world, e, (dx / d) * s, (dy / d) * s, 0.22)) { e.tx = e.x; e.ty = e.y; }
      if (Math.abs(dx) > 0.02) e.dir = dx < 0 ? -1 : 1;
    } else if (e.wait <= 0) {
      e.wait = 0.8 + Math.random() * 2.5;
      e.tx = Math.min(CAMP.x1 - 0.7, Math.max(CAMP.x0 + 1.5, e.x + rnd(-2.5, 2.5))); e.ty = Math.min(CAMP.y1 - 0.8, Math.max(CAMP.cy - 0.2, e.y + rnd(-2, 2)));
    }
  }
}

const R = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
function drawStation(ctx, S, st, near) {
  const { sx, sy, ts, u } = S, x = sx(st.x + 0.5), y = sy(st.y + 1), p = ts / 16, t = G.time;
  if (x < -ts * 2 || x > S.W + ts * 2 || y < -ts * 2 || y > S.H + ts * 3) return;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(x, y - p, ts * 0.55, ts * 0.17, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(Math.round(x - ts / 2), Math.round(y - ts * 1.05));
  const B = (c, a, b, w, h) => R(ctx, c, a * p, b * p, w * p, h * p);
  switch (st.id) {
    case 'chest': B('#3c2410', 1, 8, 14, 8); B('#8a5a2c', 2, 9, 12, 6); B('#a8743c', 2, 9, 12, 2); B('#3c2410', 1, 5, 14, 4); B('#a8743c', 2, 5, 12, 3); B('#f0c830', 7, 8, 2, 3); B('#3c2410', 1, 11, 14, 1); break;
    case 'lab': B('#3c2410', 1, 10, 14, 6); B('#6a4824', 2, 10, 12, 5); B('#3c2410', 2, 5, 3, 6); B('#d8f0ff', 3, 2, 5, 9); B('#b878f0', 3, 6 + Math.sin(t * 3) * 0.6, 5, 5); B('#3c2410', 9, 6, 3, 5); B('#d8f0ff', 9, 4, 4, 7); B('#58e0a0', 9, 7, 4, 4); B('#ffffff', 5, 3 + ((t * 4) % 3), 1, 1); break;
    case 'forge': B('#2c2c34', 1, 11, 14, 5); B('#50505c', 2, 9, 12, 3); B('#9a9aa8', 0, 7, 16, 3); B('#c8c8d4', 0, 7, 16, 1); B('#50505c', 5, 5, 6, 3); B('#e8582c', 3, 13, 4, 2); B('#ffd040', 4 + Math.sin(t * 9), 12, 2, 2); break;
    default: B('#5a3a1c', 7, 3, 2, 13); B('#a07040', 3, 4, 10, 4); B('#c8a060', 4, 5, 8, 2); B('#d83c3c', 5, 9, 6, 6); B('#f4f4f4', 6, 10, 4, 4); B('#d83c3c', 7, 11, 2, 2); break;
  }
  ctx.restore();
  // floating icon so the station reads without text
  const bob = Math.sin(t * 3 + st.x) * 3 * u, is = ts * (near ? 0.78 : 0.62);
  if (near) { ctx.fillStyle = 'rgba(255,255,160,.28)'; ctx.beginPath(); ctx.ellipse(x, y - p, ts * 0.8, ts * 0.28, 0, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(20,40,20,.75)'; ctx.beginPath(); ctx.arc(x, y - ts * 1.45 + bob, is * 0.62, 0, 7); ctx.fill();
  drawIcon(ctx, st.icon, x, y - ts * 1.45 + bob, is);
}

export function baseEntities(S, near) {
  const out = CAMP.stations.map((st) => ({ y: st.y + 1, fn: (ctx) => drawStation(ctx, S, st, near === st) }));
  for (const e of crowd.values()) {
    out.push({
      y: e.y, fn: (ctx) => {
        const { sx, sy, ts } = S, x = sx(e.x), y = sy(e.y), s = ts * 0.9; if (x < -s || x > S.W + s || y < -s || y > S.H + s) return;
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.3, s * 0.12, 0, 0, 7); ctx.fill();
        drawCreature(ctx, e.c.g, x, y - s * 0.38 - Math.abs(Math.sin(G.time * 3 + e.bob)) * ts * 0.05, s, { flip: e.dir < 0 });
      },
    });
  }
  return out;
}
