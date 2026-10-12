// Glimmerwild entry: canvas setup, main loop, title/starter screens, overworld.
import { G, toast } from './state.js';
import { input, initInput, endFrame } from './input.js';
import { initAudio, sfx } from './audio.js';
import { hasSave, save } from './save.js';
import { setCtx, PAL, text, panel, button, fillR, chips, bgPattern, hit, wrap } from './ui.js';
import { drawCreature } from './sprites.js';
import { drawMenus, isMenuScreen } from './menus.js';
import { initOverworld, newGame, continueGame, updateWorld, drawWorld, drawToast } from './overworld.js';
import { spawnMobAt, K } from './combat.js';
import { SPECIES_BY_ID, STARTERS, SPECIES } from './data.js';
import { makeCreature } from './creature.js';
import { mulberry32, clamp } from './util.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d', { alpha: false });
setCtx(ctx);
initOverworld(cv);
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
  text('fight  catch  fuse  explore', W / 2, cy - 8 * u, { size: 14, align: 'center', color: PAL.mid });
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
// debug / test hook
window.__G = { G, K, spawnMobAt, input };

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
