// Smoke test: node tools/smoke.mjs  (needs playwright; set PW_PATH or install in /tmp/pw; serve the repo at http://localhost:8737/)
// Exercises the real UI per viewport: walk to a mob, Attack, drag-throw from Catch, visit the base stations, finish a quest, fight a boss.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
const req = createRequire(process.env.PW_PATH || '/tmp/pw/');
const { chromium } = req('playwright');

const URL = process.env.URL || 'http://localhost:8737/';
const exe = existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
mkdirSync('screenshots', { recursive: true });
const runs = [
  { name: 'phone', opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  { name: 'phone-landscape', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
  { name: 'tablet', opts: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
];
const errors = [];
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
for (const { name, opts } of runs) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const fail = (m) => errors.push(`[${name}] ${m}`);
  page.on('console', (m) => { if (m.type() === 'error') fail(`console: ${m.text()}`); });
  page.on('pageerror', (e) => fail(`pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const { width: W, height: H } = opts.viewport;
  const wait = (ms) => page.waitForTimeout(ms);
  const tap = async (x, y, ms = 400) => { await page.touchscreen.tap(x, y); await wait(ms); };
  const G = (fn, arg) => page.evaluate(fn, arg);
  const screen = () => G(() => window.__G.G.screen);
  // title -> NEW GAME -> pick starter -> start (probe tap positions until the world screen shows)
  for (let y = H * 0.62; (await screen()) === 'title' && y < H; y += 20) await tap(W / 2, y);
  await tap(W * 0.5, H * 0.25);
  for (let y = H * 0.3; (await screen()) === 'starter' && y < H; y += 20) await tap(W / 2, y);
  await wait(600);
  if ((await screen()) !== 'world') { fail(`never reached world screen (stuck on ${await screen()})`); await ctx.close(); continue; }
  if (!(await G(() => !!window.__G))) fail('window.__G missing');

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  const heal = () => G(() => { const g = window.__G.G; g.hp = 60; for (const c of g.team) c.hp = 999; });
  const snap = (file) => page.screenshot({ path: `screenshots/${file}.png` });

  // teleport the player to open, non-safe ground east of the base and return a helper to place mobs near
  await G(async () => {
    const w = await import('/js/world.js'), g = window.__G.G, wd = g.world, sp = wd.spawn;
    const free = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = w.tileAt(wd, Math.floor(x) + dx, Math.floor(y) + dy); if (w.isSolidTile(t)) return false; } return wd.reach[Math.floor(y) * w.N + Math.floor(x)] === 1 && !w.inSafe(x, y); };
    window.__free = free;
    outer: for (let r = 9; r < 30; r++) for (let a = 0; a < 6.28; a += 0.2) {
      const x = Math.floor(sp.x + Math.cos(a) * r) + 0.5, y = Math.floor(sp.y + Math.sin(a) * r) + 0.5;
      if (free(x, y) && free(x + 4, y)) { g.player.x = x; g.player.y = y; window.__spot = { x, y }; break outer; }
    }
  });
  await wait(300);
  await heal();
  const spawnMob = (dx, dy, lv, spId = 'budlet') => G(({ dx, dy, lv, spId }) => { const g = window.__G.G, p = g.player; return window.__G.spawnMobAt(p.x + dx, p.y + dy, spId, lv) && true; }, { dx, dy, lv, spId });
  const state = () => G(() => { const g = window.__G.G, p = g.player; const m = g.mobs.filter((x) => !x.boss).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]; return { px: p.x, py: p.y, hp: g.hp, m: m && { x: m.x, y: m.y, hp: m.hp, max: m.maxHp }, hud: g.hud, stats: { ...g.stats }, screen: g.screen }; });

  // --- walk to a mob with the joystick ---
  await G(() => { window.__G.G.mobs = window.__G.G.mobs.filter((m) => m.boss); });
  await spawnMob(4, 0, 3);
  const sx = W * 0.25, sy = H * 0.72;
  await touch('touchStart', sx, sy);
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) {
    const s = await state();
    const dx = s.m.x - s.px, dy = s.m.y - s.py, d = Math.hypot(dx, dy);
    if (d < 1.7) { reached = true; break; }
    await touch('touchMove', sx + (dx / d) * 45, sy + (dy / d) * 45);
    await wait(100);
    await heal();
  }
  await touch('touchEnd', sx, sy);
  if (!reached) fail('could not walk to the mob');
  await snap(name);
  await heal();

  // --- Attack via the big button ---
  const before = (await state()).stats.hits || 0;
  for (let i = 0; i < 12; i++) {
    const s = await state();
    if (!s.m || s.m.hp <= 0) break;
    await tap(s.hud.attack.x, s.hud.attack.y, 430);
    await heal();
  }
  const aft = await state();
  if ((aft.stats.hits || 0) <= before) fail('Attack never hit a mob');
  if (!(aft.stats.swings > 0)) fail('no swings recorded');

  // --- Catch: hold + drag from the Catch button toward a mob, screenshot the aim, release ---
  await G(() => { window.__G.G.mobs = window.__G.G.mobs.filter((m) => m.boss); window.__G.G.orbs = 20; });
  await spawnMob(4.5, -1, 5, 'pondle');
  await wait(200);
  {
    const s = await state(), h = s.hud, ts = h.ts;
    const dx = s.m.x - s.px, dy = s.m.y - s.py, k = ts * 0.45;
    const t0 = (await state()).stats.throws || 0;
    await touch('touchStart', h.catch.x, h.catch.y, 2);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', h.catch.x + (dx * k * i) / 8, h.catch.y + (dy * k * i) / 8, 2); await wait(40); }
    await wait(250);
    await snap(name === 'phone' ? 'combat-phone' : name === 'tablet' ? 'combat-tablet' : 'combat-' + name);
    await touch('touchEnd', 0, 0, 2);
    await wait(3200);
    const a2 = await state();
    if ((a2.stats.throws || 0) <= t0) fail('catch throw did not happen');
    if (!((a2.stats.orbHits || 0) + (a2.stats.misses || 0) > 0)) fail('thrown orb never landed');
    await snap('catch-after-' + name);
  }
  // quick tap on Catch auto-aims at the nearest mob
  await spawnMob(3, 1, 4);
  { const s = await state(), t0 = s.stats.throws || 0; await tap(s.hud.catch.x, s.hud.catch.y, 1500); if (((await state()).stats.throws || 0) <= t0) fail('tap-catch did not throw'); }

  // --- quest: defeat creatures until the first quest completes ---
  await heal();
  for (let n = 0; n < 6 && !(await G(() => window.__G.G.quests.done.q1)); n++) {
    await G(() => { const g = window.__G.G; g.mobs = g.mobs.filter((m) => m.boss); const p = g.player; window.__G.spawnMobAt(p.x + 1.1, p.y, 'budlet', 1); });
    for (let i = 0; i < 6; i++) { const s = await state(); if (!s.m || s.m.hp <= 0) break; await tap(s.hud.attack.x, s.hud.attack.y, 430); await heal(); }
  }
  await wait(300);
  if (!(await G(() => !!window.__G.G.quests.done.q1))) fail('first quest did not complete');
  await snap('quest-' + name);
  // quests screen
  await tap((await state()).hud.menu.x, (await state()).hud.menu.y, 500);
  if ((await screen()) !== 'menu') fail('menu button did not open the menu');
  await G(() => { window.__G.G.screen = 'quests'; });
  await wait(300); await snap('quests-' + name);
  await page.keyboard.press('Escape'); await wait(300);
  await G(() => { window.__G.G.screen = 'world'; });

  // --- visit the base: forge, lab, storage, training ---
  await G(async () => { const cr = await import('/js/creature.js'), g = window.__G.G; for (const id of ['frostnub', 'zapkin', 'duneskit']) g.storage.push(cr.makeCreature(id, 4)); });
  for (const [id, scr] of [['forge', 'forge'], ['lab', 'fuse'], ['chest', 'storage'], ['train', 'trainpick']]) {
    await G(async (id) => { const w = await import('/js/world.js'), g = window.__G.G, st = w.CAMP.stations.find((s) => s.id === id); g.mobs = g.mobs.filter((m) => m.boss); g.player.x = st.x + 0.5; g.player.y = st.y + 2.0; }, id);
    await wait(500);
    const s = await state();
    if (!s.hud.use) { fail(`no USE button near ${id}`); continue; }
    if (id === 'forge') await snap('base-' + name);
    await tap(s.hud.use.x, s.hud.use.y, 500);
    const sc = await screen();
    if (sc !== scr) fail(`USE at ${id} opened "${sc}" instead of "${scr}"`);
    if (id === 'forge' || id === 'lab') await snap(`${scr}-${name}`);
    await page.keyboard.press('Escape'); await wait(400);
    if ((await screen()) !== 'world') { fail(`could not leave ${scr}`); await G(() => { window.__G.G.screen = 'world'; window.__G.G.baseMode = false; }); }
  }
  // fusion reveal: give the player two creatures and run the real fuse flow
  if (name === 'phone' || name === 'tablet') {
    await G(async () => {
      const cr = await import('/js/creature.js'), g = window.__G.G;
      g.team.push(cr.makeCreature('pondle', 8), cr.makeCreature('zapkin', 8)); g.vials.Swift = 1;
      const w = await import('/js/world.js'), st = w.CAMP.stations.find((s) => s.id === 'lab'); g.player.x = st.x + 0.5; g.player.y = st.y + 2;
    });
    await wait(400);
    await G(() => { const g = window.__G.G; g.baseMode = true; g.screen = 'fuse'; g.ui = { fuse: { a: g.team[g.team.length - 1], b: g.team[g.team.length - 2], vial: 'Swift' }, page: 0 }; });
    await wait(400); await snap('fuse-ready-' + name);
    // real UI: tap FUSE!, then the confirm button (probe y positions on the right half until the fusion starts)
    const f0 = await G(() => window.__G.G.team.length + window.__G.G.storage.length), u = Math.min(Math.max(Math.min(W, H) / 380, 0.85), 2.4);
    await tap(W * 0.72, H - 10 * u - 22 * u, 300);
    for (let y = H * 0.45; y < H * 0.75 && (await G(() => !window.__G.G.ui.fuse.done)); y += 8) await tap(W * 0.62, y, 120);
    if (await G(() => !window.__G.G.ui.fuse.done)) fail('fusion did not start from the UI');
    else {
      await wait(1500); await snap('fuse-merge-' + name);
      await wait(2800); await snap('fuse-reveal-' + name);
      const f1 = await G(() => window.__G.G.team.length + window.__G.G.storage.length);
      if (f1 !== f0 - 1) fail(`fusion should consume 2 and add 1 (${f0} -> ${f1})`);
      if (await G(() => window.__G.G.vials.Swift !== 0)) fail('gene vial was not consumed');
      await wait(900);
      await page.keyboard.press('Escape'); await wait(300);
    }
    await G(() => { window.__G.G.screen = 'world'; window.__G.G.baseMode = false; });
  }

  // --- boss: real-time patterns, then defeat ---
  if (name === 'phone') {
    await G(() => { const g = window.__G.G, b = g.mobs.find((m) => m.boss); g.mobs = [b]; g.player.x = b.x + 1.0; g.player.y = b.y + 1.0; g.hp = 60; });
    await wait(3500); await heal();
    await snap('boss-' + name);
    const patterns = new Set();
    for (let i = 0; i < 40; i++) { const p = await G(() => { const b = window.__G.G.mobs.find((m) => m.boss); return b && b.pat && b.pat.k; }); if (p) patterns.add(p); await heal(); await wait(250); }
    if (!patterns.size) fail('boss never used an attack pattern');
    const bossHp = await G(() => { const b = window.__G.G.mobs.find((m) => m.boss); if (!b) return null; b.hp = 3; return b.hp; });
    for (let i = 0; i < 14; i++) { const s = await state(); if (!(await G(() => window.__G.G.mobs.some((m) => m.boss)))) break; await G(() => { const g = window.__G.G, b = g.mobs.find((m) => m.boss); if (b) { g.player.x = b.x - 1.2; g.player.y = b.y; } }); await tap(s.hud.attack.x, s.hud.attack.y, 300); await heal(); }
    if (bossHp !== null && !(await G(() => Object.keys(window.__G.G.bosses).length > 0))) fail('boss not defeated');
  }

  // --- save + reload keeps the game (v2 save) ---
  await G(() => { window.__G.G.screen = 'world'; });
  await ctx.close();
}
// --- old v1 save migrates safely ---
{
  const ctx = await browser.newContext(runs[0].opts), page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[migrate] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[migrate] pageerror: ${e.message}`));
  const old = { v: 1, seed: 4242, p: { x: 120.5, y: 120.5, dir: 0 }, team: [{ id: 'old1', sp: 'budlet', name: 'Oldie', lv: 7, xp: 3, g: { body: 0, f1: 8, f2: 0, eye: 1, pat: 1, mouth: 1, c1: [110, 55, 50], c2: [60, 60, 75], size: 1, sd: 5 }, types: ['leaf'], base: [48, 42, 44, 46], traits: ['Swift'], hp: 30, gen: 0, trainAt: 0 }], storage: [], orbs: 9, berries: 2, skill: { lvl: 3, xp: 4 }, bosses: { b_meadow: true }, dex: { seen: { budlet: 1 }, caught: { budlet: 1 } }, settings: { sound: false }, playtime: 99 };
  await page.addInitScript((o) => { if (!localStorage.getItem('glimmerwild.save.v1')) localStorage.setItem('glimmerwild.save.v1', JSON.stringify(o)); }, old);
  await page.goto(URL, { waitUntil: 'load' }); await page.waitForTimeout(800);
  const { width: W, height: H } = runs[0].opts.viewport;
  for (let y = H * 0.62; (await page.evaluate(() => window.__G.G.screen)) === 'title' && y < H; y += 20) { await page.touchscreen.tap(W / 2, y); await page.waitForTimeout(300); }
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => { const g = window.__G.G; return { screen: g.screen, name: g.team[0] && g.team[0].name, orbs: g.orbs, gear: g.gear, mats: g.mats, hp: g.hp, boss: !!g.bosses.b_meadow, bossMobs: g.mobs.filter((m) => m.boss).length, seed: g.seed, skill: g.skill.lvl }; });
  if (r.screen !== 'world' || r.name !== 'Oldie' || r.orbs !== 9 || r.seed !== 4242 || r.skill !== 3 || !r.boss) errors.push('[migrate] v1 save did not load correctly: ' + JSON.stringify(r));
  if (r.gear.w !== 0 || r.mats.hide !== 0 || !(r.hp > 0)) errors.push('[migrate] v2 defaults missing: ' + JSON.stringify(r));
  if (r.bossMobs !== 5) errors.push('[migrate] defeated boss should not respawn (boss mobs: ' + r.bossMobs + ')');
  await page.evaluate(() => window.__G.G.team[0].lv++); await page.waitForTimeout(100);
  await page.evaluate(() => dispatchEvent(new Event('pagehide')));
  const keep = await page.evaluate(() => ({ v1: JSON.parse(localStorage.getItem('glimmerwild.save.v1')).team[0].lv, v2: JSON.parse(localStorage.getItem('glimmerwild.save.v2')).team[0].lv }));
  if (keep.v1 !== 7 || keep.v2 !== 8) errors.push('[migrate] save keys wrong: ' + JSON.stringify(keep));
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke OK, no console/page errors');
