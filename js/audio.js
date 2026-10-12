import { G } from './state.js';
let ac = null;
export function initAudio() {
  try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
}
export function beep(f, d = 0.08, type = 'square', vol = 0.04, slide = 0, delay = 0) {
  if (!ac || !G.settings.sound) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, f + slide), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
}
export const sfx = {
  tap: () => beep(660, 0.04),
  hit: () => beep(180, 0.12, 'sawtooth', 0.05, -100),
  crit: () => { beep(300, 0.1, 'sawtooth', 0.06, -150); beep(500, 0.08, 'square', 0.05, 0, 0.08); },
  heal: () => [523, 659, 784].forEach((f, i) => beep(f, 0.1, 'triangle', 0.05, 0, i * 0.09)),
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'square', 0.04, 0, i * 0.1)),
  throw: () => beep(400, 0.25, 'triangle', 0.05, 500),
  shake: () => beep(220, 0.1, 'square', 0.04),
  caught: () => [659, 784, 988, 1319].forEach((f, i) => beep(f, 0.14, 'square', 0.05, 0, i * 0.12)),
  fail: () => beep(300, 0.3, 'sawtooth', 0.05, -200),
  swing: () => beep(520, 0.08, 'triangle', 0.04, -260),
  thud: () => beep(110, 0.1, 'square', 0.06, -40),
  ouch: () => { beep(240, 0.14, 'sawtooth', 0.06, -140); beep(160, 0.16, 'square', 0.05, -60, 0.07); },
  warn: () => { beep(880, 0.07, 'square', 0.035); beep(880, 0.07, 'square', 0.035, 0, 0.1); },
  pickup: () => { beep(784, 0.06, 'triangle', 0.05); beep(1175, 0.09, 'triangle', 0.05, 0, 0.06); },
  quest: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, 0.12, 'square', 0.04, 0, i * 0.09)),
  ko: () => [440, 330, 247, 165].forEach((f, i) => beep(f, 0.2, 'triangle', 0.06, 0, i * 0.16)),
  boom: () => { beep(90, 0.35, 'sawtooth', 0.07, -50); beep(60, 0.4, 'square', 0.05, -20, 0.05); },
  charge: () => beep(200, 0.6, 'sawtooth', 0.04, 500),
  fuse: () => [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.16, 'triangle', 0.05, 0, i * 0.11)),
  deny: () => { beep(200, 0.08, 'square', 0.05); beep(150, 0.12, 'square', 0.05, 0, 0.09); },
  start: () => [330, 440, 660].forEach((f, i) => beep(f, 0.1, 'square', 0.05, 0, i * 0.07)),
};
