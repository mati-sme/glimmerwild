// Immediate-mode canvas UI helpers (GB-green palette).
import { G } from './state.js';
import { input } from './input.js';
import { sfx } from './audio.js';
import { TYPE_COLORS, TYPE_NAMES } from './data.js';
import { drawCreature } from './sprites.js';
import { drawIcon } from './icons.js';

export const PAL = { dark: '#0f380f', mid: '#306230', light: '#8bac0f', pale: '#e4eebc', ink: '#142814', red: '#d8483c', gold: '#f0c830' };
let ctx = null;
export const setCtx = (c) => { ctx = c; };
export const C = () => ctx;
const inR = (px, py, x, y, w, h) => px >= x && py >= y && px <= x + w && py <= y + h;

export function hit(x, y, w, h) {
  if (input.freeze) return false;
  for (let i = 0; i < input.taps.length; i++) {
    const t = input.taps[i];
    if (inR(t.x, t.y, x, y, w, h) && inR(t.sx, t.sy, x, y, w, h)) { input.taps.splice(i, 1); return true; }
  }
  return false;
}
export function pressed(x, y, w, h) {
  if (input.freeze) return false;
  for (const p of input.pointers.values()) if (!p.stick && inR(p.sx, p.sy, x, y, w, h) && inR(p.x, p.y, x, y, w, h)) return true;
  return false;
}
export const font = (size, bold = true) => { ctx.font = `${bold ? 'bold ' : ''}${Math.max(6, Math.round(size * G.u))}px "Courier New",Courier,monospace`; };

export function text(s, x, y, o = {}) {
  let size = o.size || 12;
  font(size, o.bold !== false);
  if (o.maxW) { const w = ctx.measureText(s).width; if (w > o.maxW) { size = size * (o.maxW / w); font(size, o.bold !== false); } }
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'middle';
  if (o.shadow !== false && o.shadow) { ctx.fillStyle = o.shadow === true ? PAL.dark : o.shadow; ctx.fillText(s, Math.round(x + G.u), Math.round(y + G.u)); }
  ctx.fillStyle = o.color || PAL.ink; ctx.fillText(s, Math.round(x), Math.round(y));
}
export function wrap(s, maxW, size = 12) {
  font(size); const out = []; let line = '';
  for (const w of String(s).split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
export const fillR = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
export function panel(x, y, w, h, o = {}) {
  const b = Math.max(2, Math.round(2 * G.u));
  fillR(x, y, w, h, PAL.dark); fillR(x + b, y + b, w - 2 * b, h - 2 * b, o.fill || PAL.pale);
  if (!o.flat) { fillR(x + b, y + b, w - 2 * b, b, 'rgba(255,255,255,.5)'); fillR(x + b, y + h - 2 * b, w - 2 * b, b, 'rgba(0,0,0,.12)'); }
}
export function button(label, x, y, w, h, o = {}) {
  const dis = !!o.disabled, p = !dis && pressed(x, y, w, h), tapped = !dis && hit(x, y, w, h);
  const b = Math.max(2, Math.round(2 * G.u));
  fillR(x, y, w, h, PAL.dark);
  fillR(x + b, y + b, w - 2 * b, h - 2 * b, dis ? '#9aa88a' : p ? PAL.mid : o.fill || PAL.light);
  if (!p && !dis) { fillR(x + b, y + b, w - 2 * b, b, 'rgba(255,255,255,.4)'); fillR(x + b, y + h - 2 * b, w - 2 * b, b, 'rgba(0,0,0,.18)'); }
  text(label, x + w / 2, y + h / 2 + (p ? b / 2 : 0), { size: o.size || 13, color: dis ? '#6a7a5a' : p ? PAL.pale : o.color || PAL.dark, align: 'center', maxW: w - 8 * G.u });
  if (tapped) sfx.tap();
  return tapped;
}
// Big icon-first button. Icon on top (square-ish buttons) or left (wide buttons); label is optional.
export function iconButton(icon, label, x, y, w, h, o = {}) {
  const dis = !!o.disabled, p = !dis && pressed(x, y, w, h), tapped = !dis && hit(x, y, w, h), b = Math.max(2, Math.round(2 * G.u));
  fillR(x, y, w, h, PAL.dark);
  fillR(x + b, y + b, w - 2 * b, h - 2 * b, dis ? '#9aa88a' : p ? PAL.mid : o.fill || PAL.light);
  if (!p && !dis) { fillR(x + b, y + b, w - 2 * b, b, 'rgba(255,255,255,.4)'); fillR(x + b, y + h - 2 * b, w - 2 * b, b, 'rgba(0,0,0,.18)'); }
  const wide = w > h * 1.4, is = Math.min(wide ? h * 0.62 : Math.min(w * 0.55, h * (label ? 0.5 : 0.62)), 70 * G.u);
  const ix = wide ? x + h * 0.5 + b : x + w / 2, iy = wide || !label ? y + h / 2 : y + h * 0.4;
  if (dis) ctx.globalAlpha = 0.45;
  drawIcon(ctx, icon, ix, iy + (p ? b / 2 : 0), is, o.color);
  ctx.globalAlpha = 1;
  if (o.badge !== undefined) text(String(o.badge), x + w - 6 * G.u, y + 10 * G.u, { size: 12, align: 'right', color: '#fff', shadow: PAL.dark });
  if (label) text(label, wide ? x + h + 4 * G.u + (w - h - 8 * G.u) / 2 : x + w / 2, wide ? y + h / 2 : y + h * 0.82, { size: o.size || 11, color: dis ? '#6a7a5a' : PAL.dark, align: 'center', maxW: wide ? w - h - 10 * G.u : w - 8 * G.u });
  if (tapped) sfx.tap();
  return tapped;
}
export function bar(x, y, w, h, f, color) {
  f = Math.max(0, Math.min(1, f));
  fillR(x, y, w, h, PAL.dark); fillR(x + 1.5 * G.u, y + 1.5 * G.u, w - 3 * G.u, h - 3 * G.u, '#2a3a2a');
  const col = color || (f > 0.5 ? '#58c848' : f > 0.2 ? '#f0c830' : '#e04838');
  fillR(x + 1.5 * G.u, y + 1.5 * G.u, (w - 3 * G.u) * f, h - 3 * G.u, col);
}
export function chip(type, x, y, h = 15) {
  const n = TYPE_NAMES[type].toUpperCase(); font(h * 0.62);
  const w = ctx.measureText(n).width + 8 * G.u;
  fillR(x, y, w, h * G.u, PAL.dark); fillR(x + G.u, y + G.u, w - 2 * G.u, h * G.u - 2 * G.u, TYPE_COLORS[type]);
  text(n, x + w / 2, y + (h * G.u) / 2, { size: h * 0.62, color: type === 'volt' || type === 'frost' ? PAL.dark : '#fff', align: 'center' });
  return w;
}
export function chips(types, x, y, h = 15) { let cx = x; for (const t of types) cx += chip(t, cx, y, h) + 3 * G.u; return cx - x; }
export function screenTitle(title) {
  const { W, safe, u } = G;
  fillR(0, 0, W, safe.t + 40 * u, PAL.dark);
  text(title, W / 2, safe.t + 20 * u, { size: 18, color: PAL.pale, align: 'center' });
}
export function bgPattern() {
  const { W, H, u } = G;
  fillR(0, 0, W, H, PAL.light);
  const s = 16 * u;
  ctx.fillStyle = 'rgba(15,56,15,.08)';
  for (let y = 0; y < H; y += s * 2) for (let x = ((y / s) % 4) * s; x < W; x += s * 2) ctx.fillRect(x, y, s, s);
}
export function creatureIcon(c, x, y, size) { drawCreature(ctx, c.g, x + size / 2, y + size / 2, size); }

// Creature card row. Returns true when tapped.
import { maxHp, xpNeed, rarity, RARITY } from './creature.js';
export function creatureRow(c, x, y, w, h, o = {}) {
  const dis = !!o.disabled, p = !dis && pressed(x, y, w, h), tapped = !dis && hit(x, y, w, h), u = G.u;
  const b = Math.max(2, Math.round(2 * u));
  fillR(x, y, w, h, PAL.dark);
  fillR(x + b, y + b, w - 2 * b, h - 2 * b, dis ? '#b8c4a0' : o.sel ? '#f4f0a8' : p ? '#c8dc8c' : PAL.pale);
  const ic = h - 2 * b - 2 * u;
  fillR(x + b + u, y + b + u, ic, ic, 'rgba(48,98,48,.25)');
  drawCreature(ctx, c.g, x + b + u + ic / 2, y + b + u + ic / 2 - ic * 0.04, ic * 1.12, { alpha: c.hp <= 0 ? 0.45 : 1 });
  const tx = x + b + ic + 8 * u, tw = w - (tx - x) - 8 * u;
  text(c.name + (c.gen ? ' ' + '★'.repeat(Math.min(c.gen, 3)) : ''), tx, y + h * 0.27, { size: 13, maxW: tw * 0.62, color: dis ? '#6a7a5a' : PAL.ink });
  text('Lv' + c.lv + (o.need ? '/' + o.need : ''), x + w - 8 * u, y + h * 0.27, { size: 12, align: 'right', color: o.need ? PAL.red : PAL.mid });
  if (o.need) drawIcon(ctx, 'lock', x + b + u + ic * 0.78, y + b + u + ic * 0.78, ic * 0.5);
  else if (o.bad) drawIcon(ctx, 'cross', x + b + u + ic * 0.78, y + b + u + ic * 0.78, ic * 0.5);
  { const r = rarity(c); for (let i = 0; i <= r; i++) drawIcon(ctx, 'star', x + w - 10 * u - i * 9 * u, y + h * 0.84, 8 * u, RARITY[r].c); }
  const bw = Math.min(tw * 0.55, 120 * u), mh = maxHp(c);
  bar(tx, y + h * 0.52, bw, 8 * u, c.hp / mh);
  text(c.hp <= 0 ? 'FAINTED' : `${c.hp}/${mh}`, tx + bw + 6 * u, y + h * 0.52 + 4 * u, { size: 10, color: c.hp <= 0 ? PAL.red : PAL.mid });
  if (h > 50 * u) { let cx = tx; for (const t of c.types) cx += chip(t, cx, y + h * 0.68, 11) + 3 * u; for (const tr of c.traits) { text(tr, cx + 2 * u, y + h * 0.68 + 5.5 * u, { size: 10, color: PAL.mid }); cx += (tr.length * 6.6 + 8) * u; } }
  if (tapped) sfx.tap();
  return tapped;
}
export const xpFrac = (c) => c.xp / xpNeed(c.lv);
