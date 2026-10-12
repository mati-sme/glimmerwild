// Vector icons for the icon-first UI. Each draws in a -1..1 box scaled to `s` px, centred on (x, y).
const P = (ctx, f) => { ctx.beginPath(); f(ctx); };
const ICONS = {
  heart(c) { P(c, (c) => { c.moveTo(0, 0.85); c.bezierCurveTo(-1.2, 0.1, -0.9, -0.9, 0, -0.35); c.bezierCurveTo(0.9, -0.9, 1.2, 0.1, 0, 0.85); }); c.fill(); c.stroke(); },
  sword(c) {
    P(c, (c) => { c.moveTo(0.75, -0.9); c.lineTo(0.9, -0.75); c.lineTo(-0.15, 0.4); c.lineTo(-0.4, 0.15); c.closePath(); }); c.fill(); c.stroke();
    P(c, (c) => { c.moveTo(-0.55, 0.05); c.lineTo(0.05, 0.65); }); c.lineWidth *= 1.8; c.stroke(); c.lineWidth /= 1.8;
    P(c, (c) => { c.moveTo(-0.3, 0.3); c.lineTo(-0.8, 0.8); }); c.lineWidth *= 1.8; c.stroke(); c.lineWidth /= 1.8;
  },
  orb(c, col) {
    P(c, (c) => c.arc(0, 0, 0.85, 0, 7)); c.fillStyle = '#f4f4f4'; c.fill(); c.stroke();
    P(c, (c) => c.arc(0, 0, 0.85, Math.PI, 0)); c.fillStyle = col || '#8a50f0'; c.fill(); c.stroke();
    P(c, (c) => { c.moveTo(-0.85, 0); c.lineTo(0.85, 0); }); c.stroke();
    P(c, (c) => c.arc(0, 0, 0.27, 0, 7)); c.fillStyle = '#fff'; c.fill(); c.stroke();
  },
  hand(c) {
    P(c, (c) => { c.moveTo(-0.55, 0.85); c.lineTo(-0.7, 0.1); c.lineTo(-0.55, -0.1); c.lineTo(-0.35, 0.1); c.lineTo(-0.35, -0.75); c.lineTo(-0.1, -0.75); c.lineTo(-0.1, -0.2); c.lineTo(0.1, -0.85); c.lineTo(0.35, -0.85); c.lineTo(0.3, -0.1); c.lineTo(0.55, -0.55); c.lineTo(0.75, -0.5); c.lineTo(0.6, 0.3); c.lineTo(0.5, 0.85); c.closePath(); }); c.fill(); c.stroke();
  },
  shield(c) { P(c, (c) => { c.moveTo(0, -0.9); c.lineTo(0.8, -0.6); c.lineTo(0.7, 0.2); c.quadraticCurveTo(0.5, 0.7, 0, 0.95); c.quadraticCurveTo(-0.5, 0.7, -0.7, 0.2); c.lineTo(-0.8, -0.6); c.closePath(); }); c.fill(); c.stroke(); },
  home(c) { P(c, (c) => { c.moveTo(-0.85, 0); c.lineTo(0, -0.85); c.lineTo(0.85, 0); c.lineTo(0.6, 0); c.lineTo(0.6, 0.8); c.lineTo(-0.6, 0.8); c.lineTo(-0.6, 0); c.closePath(); }); c.fill(); c.stroke(); P(c, (c) => c.rect(-0.2, 0.2, 0.4, 0.6)); c.fillStyle = '#4a3020'; c.fill(); },
  flask(c) { P(c, (c) => { c.moveTo(-0.25, -0.85); c.lineTo(0.25, -0.85); c.lineTo(0.25, -0.2); c.lineTo(0.8, 0.7); c.lineTo(-0.8, 0.7); c.lineTo(-0.25, -0.2); c.closePath(); }); c.fill(); c.stroke(); P(c, (c) => { c.moveTo(-0.55, 0.3); c.lineTo(0.55, 0.3); }); c.stroke(); },
  scroll(c) { P(c, (c) => c.rect(-0.6, -0.8, 1.2, 1.6)); c.fill(); c.stroke(); for (const y of [-0.45, -0.1, 0.25]) P(c, (c) => { c.moveTo(-0.35, y); c.lineTo(0.35, y); }), c.stroke(); },
  star(c) { P(c, (c) => { for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.4 : 0.95, a = -Math.PI / 2 + (i * Math.PI) / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }); c.fill(); c.stroke(); },
  paw(c) { for (const [x, y, r] of [[0, 0.3, 0.45], [-0.6, -0.15, 0.22], [-0.22, -0.6, 0.22], [0.22, -0.6, 0.22], [0.6, -0.15, 0.22]]) { P(c, (c) => c.arc(x, y, r, 0, 7)); c.fill(); c.stroke(); } },
  map(c) { P(c, (c) => { c.moveTo(-0.9, -0.6); c.lineTo(-0.3, -0.8); c.lineTo(0.3, -0.6); c.lineTo(0.9, -0.8); c.lineTo(0.9, 0.6); c.lineTo(0.3, 0.8); c.lineTo(-0.3, 0.6); c.lineTo(-0.9, 0.8); c.closePath(); }); c.fill(); c.stroke(); },
  sound(c) { P(c, (c) => { c.moveTo(-0.8, -0.3); c.lineTo(-0.35, -0.3); c.lineTo(0.15, -0.75); c.lineTo(0.15, 0.75); c.lineTo(-0.35, 0.3); c.lineTo(-0.8, 0.3); c.closePath(); }); c.fill(); c.stroke(); P(c, (c) => c.arc(0.15, 0, 0.5, -0.9, 0.9)); c.stroke(); P(c, (c) => c.arc(0.15, 0, 0.85, -0.9, 0.9)); c.stroke(); },
  mute(c) { ICONS.sound(c); P(c, (c) => { c.moveTo(-0.8, -0.8); c.lineTo(0.8, 0.8); }); c.strokeStyle = '#d8483c'; c.lineWidth *= 1.6; c.stroke(); },
  save(c) { P(c, (c) => c.rect(-0.8, -0.8, 1.6, 1.6)); c.fill(); c.stroke(); P(c, (c) => c.rect(-0.45, -0.8, 0.9, 0.55)); c.fillStyle = '#ddd'; c.fill(); c.stroke(); P(c, (c) => c.rect(-0.45, 0.1, 0.9, 0.7)); c.fillStyle = '#fff'; c.fill(); c.stroke(); },
  anvil(c) { P(c, (c) => { c.moveTo(-0.9, -0.5); c.lineTo(0.9, -0.5); c.lineTo(0.55, -0.1); c.lineTo(0.35, -0.1); c.lineTo(0.35, 0.3); c.lineTo(0.7, 0.8); c.lineTo(-0.7, 0.8); c.lineTo(-0.35, 0.3); c.lineTo(-0.35, -0.1); c.lineTo(-0.7, -0.1); c.closePath(); }); c.fill(); c.stroke(); },
  crown(c) { P(c, (c) => { c.moveTo(-0.85, 0.65); c.lineTo(-0.85, -0.55); c.lineTo(-0.4, -0.05); c.lineTo(0, -0.8); c.lineTo(0.4, -0.05); c.lineTo(0.85, -0.55); c.lineTo(0.85, 0.65); c.closePath(); }); c.fill(); c.stroke(); },
  hide(c) { P(c, (c) => { c.moveTo(-0.5, -0.8); c.lineTo(0.5, -0.8); c.lineTo(0.9, -0.2); c.lineTo(0.55, 0.15); c.lineTo(0.55, 0.85); c.lineTo(-0.55, 0.85); c.lineTo(-0.55, 0.15); c.lineTo(-0.9, -0.2); c.closePath(); }); c.fill(); c.stroke(); },
  fang(c) { P(c, (c) => { c.moveTo(-0.5, -0.8); c.quadraticCurveTo(0.7, -0.7, 0.35, 0.9); c.quadraticCurveTo(-0.1, 0, -0.5, -0.8); }); c.fill(); c.stroke(); },
  gem(c) { P(c, (c) => { c.moveTo(-0.55, -0.7); c.lineTo(0.55, -0.7); c.lineTo(0.9, -0.1); c.lineTo(0, 0.9); c.lineTo(-0.9, -0.1); c.closePath(); }); c.fill(); c.stroke(); P(c, (c) => { c.moveTo(-0.9, -0.1); c.lineTo(0.9, -0.1); }); c.stroke(); },
  core(c) { P(c, (c) => c.arc(0, 0, 0.8, 0, 7)); c.fill(); c.stroke(); P(c, (c) => c.arc(0, 0, 0.35, 0, 7)); c.fillStyle = '#fff'; c.fill(); },
  chest(c) { P(c, (c) => c.rect(-0.85, -0.3, 1.7, 1.1)); c.fill(); c.stroke(); P(c, (c) => { c.moveTo(-0.85, -0.3); c.quadraticCurveTo(0, -1.1, 0.85, -0.3); c.closePath(); }); c.fill(); c.stroke(); P(c, (c) => c.rect(-0.12, -0.1, 0.24, 0.3)); c.fillStyle = '#f0c830'; c.fill(); c.stroke(); },
  skull(c) { P(c, (c) => { c.arc(0, -0.15, 0.75, 0, 7); }); c.fill(); c.stroke(); P(c, (c) => c.rect(-0.35, 0.4, 0.7, 0.45)); c.fill(); c.stroke(); for (const x of [-0.3, 0.3]) { P(c, (c) => c.arc(x, -0.2, 0.2, 0, 7)); c.fillStyle = '#222'; c.fill(); } },
  menu(c) { for (const y of [-0.55, 0, 0.55]) { P(c, (c) => { c.moveTo(-0.7, y); c.lineTo(0.7, y); }); c.lineWidth *= 2.2; c.stroke(); c.lineWidth /= 2.2; } },
  check(c) { P(c, (c) => { c.moveTo(-0.7, 0); c.lineTo(-0.2, 0.55); c.lineTo(0.75, -0.6); }); c.lineWidth *= 2.4; c.stroke(); },
  cross(c) { P(c, (c) => { c.moveTo(-0.65, -0.65); c.lineTo(0.65, 0.65); c.moveTo(0.65, -0.65); c.lineTo(-0.65, 0.65); }); c.lineWidth *= 2.4; c.stroke(); },
  back(c) { P(c, (c) => { c.moveTo(0.2, -0.8); c.lineTo(-0.75, 0); c.lineTo(0.2, 0.8); c.lineTo(0.2, 0.35); c.lineTo(0.85, 0.35); c.lineTo(0.85, -0.35); c.lineTo(0.2, -0.35); c.closePath(); }); c.fill(); c.stroke(); },
  arrow(c) { P(c, (c) => { c.moveTo(0.95, 0); c.lineTo(0.05, -0.8); c.lineTo(0.05, -0.35); c.lineTo(-0.9, -0.35); c.lineTo(-0.9, 0.35); c.lineTo(0.05, 0.35); c.lineTo(0.05, 0.8); c.closePath(); }); c.fill(); c.stroke(); },
  tent(c) { P(c, (c) => { c.moveTo(-0.9, 0.8); c.lineTo(0, -0.85); c.lineTo(0.9, 0.8); c.closePath(); }); c.fill(); c.stroke(); P(c, (c) => { c.moveTo(0, 0.8); c.lineTo(-0.25, 0.1); c.lineTo(0.25, 0.1); c.closePath(); }); c.fillStyle = '#2a1a10'; c.fill(); },
  dumbbell(c) { P(c, (c) => { c.moveTo(-0.5, 0); c.lineTo(0.5, 0); }); c.lineWidth *= 2; c.stroke(); c.lineWidth /= 2; for (const x of [-0.7, 0.7]) { P(c, (c) => c.rect(x - 0.18, -0.55, 0.36, 1.1)); c.fill(); c.stroke(); } },
  plus(c) { P(c, (c) => { c.moveTo(-0.7, 0); c.lineTo(0.7, 0); c.moveTo(0, -0.7); c.lineTo(0, 0.7); }); c.lineWidth *= 2.6; c.stroke(); },
  gift(c) { P(c, (c) => c.rect(-0.8, -0.2, 1.6, 1.05)); c.fill(); c.stroke(); P(c, (c) => c.rect(-0.9, -0.55, 1.8, 0.4)); c.fill(); c.stroke(); P(c, (c) => { c.moveTo(0, -0.55); c.lineTo(0, 0.85); }); c.stroke(); },
};
export const ICON_COLORS = {
  heart: '#e8483c', sword: '#d8d8e4', orb: '#8a50f0', hand: '#f8d8a0', shield: '#58a0e8', home: '#e8b868', flask: '#b878f0', scroll: '#f4e4b0', star: '#f0c830', paw: '#f0a8c0',
  map: '#8cc878', sound: '#f4f4f4', mute: '#f4f4f4', save: '#58a0e8', anvil: '#9a9aa8', crown: '#f0c830', hide: '#b8803c', fang: '#f4f0d8', gem: '#58c8f0', core: '#f0508c', chest: '#b8803c',
  skull: '#f4f4f4', menu: '#f4f4f4', check: '#58d858', cross: '#e8483c', back: '#f4f4f4', arrow: '#f0c830', tent: '#e8885c', dumbbell: '#c8c8d4', plus: '#f4f4f4', gift: '#e8587c',
};
// drawIcon(ctx, 'heart', x, y, size[, color])
export function drawIcon(ctx, name, x, y, s, color) {
  const f = ICONS[name]; if (!f) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 2, s / 2);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 0.17; ctx.strokeStyle = '#142814';
  ctx.fillStyle = color || ICON_COLORS[name] || '#fff';
  f(ctx, color);
  ctx.restore();
}
export const iconNames = () => Object.keys(ICONS);
