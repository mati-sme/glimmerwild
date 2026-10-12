// Smoke test: node tools/smoke.mjs  (needs playwright; set PW_PATH or install in /tmp/pw)
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const req = createRequire(process.env.PW_PATH || '/tmp/pw/');
const { chromium } = req('playwright');

const URL = process.env.URL || 'http://localhost:8737/';
const exe = existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined;
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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const { width: W, height: H } = opts.viewport;
  const tap = async (x, y) => { await page.touchscreen.tap(x, y); await page.waitForTimeout(400); };
  const screen = () => page.evaluate(async () => (await import('/js/state.js')).G.screen);
  // title -> NEW GAME -> pick starter -> start (probe tap positions until the world screen shows)
  for (let y = H * 0.62; (await screen()) === 'title' && y < H; y += 20) await tap(W / 2, y);
  await tap(W * 0.5, H * 0.25);
  for (let y = H * 0.3; (await screen()) === 'starter' && y < H; y += 20) await tap(W / 2, y);
  await page.waitForTimeout(800);
  if ((await screen()) !== 'world') errors.push(`[${name}] never reached world screen (stuck on ${await screen()})`);
  // joystick drag via pointer events (touchscreen API has no drag)
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const sx = W * 0.25, sy = H * 0.75;
  await touch('touchStart', sx, sy);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', sx + i * 8, sy - i * 5); await page.waitForTimeout(60); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/${name}.png` });
  await touch('touchEnd');
  await page.waitForTimeout(300);
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke OK, no console/page errors');
