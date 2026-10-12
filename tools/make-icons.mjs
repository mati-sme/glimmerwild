// Generates PNG icons (no dependencies): node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => {
  const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
};
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// 16x16 pixel-art creature on a green backdrop, scaled with nearest neighbour.
const P = { '.': [15, 56, 15], d: [48, 98, 48], l: [139, 172, 15], p: [228, 238, 188], k: [20, 40, 20], r: [216, 72, 60], g: [240, 200, 48] };
const ART = [
  '................',
  '......gg........',
  '.....gggg.......',
  '....ddlldd......',
  '...dllllllld....',
  '..dllllllllld...',
  '.dlllpllpllllld.',
  '.dllpkplpkplld..',
  '.dlllpllpllllld.',
  '.dllllrrrllllld.',
  '..dlllllllllld..',
  '..dllllllllld...',
  '...dlldddllld...',
  '....dd...dd.....',
  '................',
  '................',
];
function render(size, pad) {
  const px = Buffer.alloc(size * size * 4), inner = size * (1 - 2 * pad), cell = inner / 16;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ax = Math.floor((x - size * pad) / cell), ay = Math.floor((y - size * pad) / cell);
    let c = P['.'];
    if (ax >= 0 && ay >= 0 && ax < 16 && ay < 16) {
      const ch = ART[ay][ax];
      c = ch === '.' ? ((ax + ay) & 1 ? [18, 64, 18] : P['.']) : P[ch];
    }
    const o = (y * size + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
  return png(size, size, px);
}
writeFileSync(join(out, 'icon-192.png'), render(192, 0.1));
writeFileSync(join(out, 'icon-512.png'), render(512, 0.1));
writeFileSync(join(out, 'apple-touch-icon.png'), render(180, 0.1));
console.log('icons written to', out);
