import { G } from './state.js';

export const input = {
  pointers: new Map(), taps: [], keys: new Set(), keyTaps: [],
  stick: { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }, zone: null, block: [], freeze: false,
};
const inRect = (p, r) => p.x >= r[0] && p.y >= r[1] && p.x <= r[0] + r[2] && p.y <= r[1] + r[3];

export function initInput(cv, onFirst) {
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const updStick = (p) => {
    const s = input.stick, R = 55 * G.u;
    let dx = p.x - s.ox, dy = p.y - s.oy; const len = Math.hypot(dx, dy);
    if (len > R) { s.ox += (dx / len) * (len - R); s.oy += (dy / len) * (len - R); dx = p.x - s.ox; dy = p.y - s.oy; }
    s.x = dx / R; s.y = dy / R;
  };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); onFirst && onFirst();
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    const p = pos(e), rec = { x: p.x, y: p.y, sx: p.x, sy: p.y, stick: false };
    input.pointers.set(e.pointerId, rec);
    const z = input.zone;
    if (z && !input.stick.on && p.x >= z[0] && p.y >= z[1] && p.x <= z[2] && p.y <= z[3] && !input.block.some((r) => inRect(p, r))) {
      Object.assign(input.stick, { on: true, id: e.pointerId, ox: p.x, oy: p.y, x: 0, y: 0 }); rec.stick = true;
    }
  }, { passive: false });
  cv.addEventListener('pointermove', (e) => {
    const rec = input.pointers.get(e.pointerId); if (!rec) return;
    const p = pos(e); rec.x = p.x; rec.y = p.y;
    if (rec.stick) updStick(p);
  });
  const up = (e, cancel) => {
    const rec = input.pointers.get(e.pointerId); if (!rec) return;
    const p = pos(e); input.pointers.delete(e.pointerId);
    if (rec.stick) { input.stick.on = false; input.stick.x = input.stick.y = 0; input.stick.id = -1; return; }
    if (!cancel) input.taps.push({ x: p.x, y: p.y, sx: rec.sx, sy: rec.sy });
  };
  cv.addEventListener('pointerup', (e) => up(e, false));
  cv.addEventListener('pointercancel', (e) => up(e, true));
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase(); input.keys.add(k); input.keyTaps.push(k);
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    onFirst && onFirst();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { input.keys.clear(); input.pointers.clear(); input.stick.on = false; input.stick.x = input.stick.y = 0; });
}
export function getMove() {
  let x = input.stick.x, y = input.stick.y;
  const k = input.keys;
  const kx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const ky = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
  if (kx || ky) { x = kx; y = ky; }
  const len = Math.hypot(x, y);
  if (len < 0.18) return { x: 0, y: 0, len: 0 };
  const m = Math.min(1, len);
  return { x: (x / len) * m, y: (y / len) * m, len: m };
}
export const keyTapped = (...ks) => { const i = input.keyTaps.findIndex((k) => ks.includes(k)); if (i >= 0) { input.keyTaps.splice(i, 1); return true; } return false; };
export function endFrame() { input.taps.length = 0; input.keyTaps.length = 0; }
