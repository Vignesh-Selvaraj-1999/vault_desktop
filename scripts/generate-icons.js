// Generates the menu bar (tray) icon as macOS "template" PNGs:
// black pixels + alpha only, so macOS tints them for light/dark menu bars.
// Output: assets/trayIconTemplate.png (18px) and assets/trayIconTemplate@2x.png (36px).
// Run with: npm run icons
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, alphaAt) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4); // filter byte 0 + RGBA
    for (let x = 0; x < size; x++) row[1 + x * 4 + 3] = alphaAt(x, y);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Clock shape in a 0..1 coordinate space.
function insideClock(u, v) {
  const cx = 0.5;
  const cy = 0.5;
  const r = Math.hypot(u - cx, v - cy);
  const stroke = 0.1;
  const ring = r <= 0.44 && r >= 0.44 - stroke;
  const minuteHand = distToSegment(u, v, cx, cy, cx, cy - 0.27) <= stroke / 2;
  const hourHand = distToSegment(u, v, cx, cy, cx + 0.19, cy) <= stroke / 2;
  return ring || minuteHand || hourHand;
}

function render(size) {
  const ss = 4; // supersampling for anti-aliasing
  return encodePng(size, (x, y) => {
    let hits = 0;
    for (let i = 0; i < ss; i++) {
      for (let j = 0; j < ss; j++) {
        if (insideClock((x + (i + 0.5) / ss) / size, (y + (j + 0.5) / ss) / size)) hits++;
      }
    }
    return Math.round((hits / (ss * ss)) * 255);
  });
}

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'trayIconTemplate.png'), render(18));
fs.writeFileSync(path.join(outDir, 'trayIconTemplate@2x.png'), render(36));
console.log('Tray icons written to assets/');
