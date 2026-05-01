// Build script: writes a "Q" tray icon as a Template PNG (alpha mask).
// Generates both the 1x and @2x variants so it stays sharp on retina menu bars.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Builds an RGBA buffer (with PNG filter byte per row) of a "Q" silhouette:
// solid filled disk + diagonal tail pointing to the bottom-right.
function buildQ(W, H) {
  const cx = (W - 1) / 2;
  const cy = (H - 1) / 2;
  const rOuter = W * 0.44;
  const ang = Math.PI / 4;
  const tailInner = rOuter * 0.6;
  const tailOuter = rOuter * 1.18;
  const tax = cx + tailInner * Math.cos(ang);
  const tay = cy + tailInner * Math.sin(ang);
  const tbx = cx + tailOuter * Math.cos(ang);
  const tby = cy + tailOuter * Math.sin(ang);
  const tailHalf = W * 0.075;

  const rowLen = 1 + W * 4;
  const raw = Buffer.alloc(H * rowLen);

  for (let y = 0; y < H; y++) {
    raw[y * rowLen] = 0; // PNG filter byte: None
    for (let x = 0; x < W; x++) {
      const dxC = x - cx;
      const dyC = y - cy;
      const distC = Math.sqrt(dxC * dxC + dyC * dyC);
      const aaCircle = Math.max(0, Math.min(1, rOuter - distC + 0.5));

      const dT = distToSegment(x, y, tax, tay, tbx, tby);
      const aaTail = Math.max(0, Math.min(1, tailHalf - dT + 0.5));

      const alpha = Math.max(aaCircle, aaTail);
      const off = y * rowLen + 1 + x * 4;
      raw[off] = 255;
      raw[off + 1] = 255;
      raw[off + 2] = 255;
      raw[off + 3] = Math.round(alpha * 255);
    }
  }
  return raw;
}

function encodePNG(W, H, raw) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const variants = [
  { w: 16, h: 16, name: 'trayIconTemplate.png' },
  { w: 32, h: 32, name: 'trayIconTemplate@2x.png' },
];

for (const { w, h, name } of variants) {
  const png = encodePNG(w, h, buildQ(w, h));
  const out = path.join(outDir, name);
  fs.writeFileSync(out, png);
  console.log(`wrote ${out} (${png.length} bytes, ${w}x${h})`);
}
