// Generates public/grain-dark.png and public/grain-light.png: 128x128 RGBA noise tiles.
// Pre-rendered so the paper texture costs one cached image instead of a live SVG filter.
import fs from "node:fs";
import zlib from "node:zlib";

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Grey + alpha (colour type 4), alpha quantised to 6 levels: compresses far better than RGBA.
function png(size, grey, seed) {
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const row = size * 2 + 1;
  const raw = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) {
    raw[y * row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const o = y * row + 1 + x * 2;
      raw[o] = grey;
      raw[o + 1] = Math.round(Math.pow(rand(), 2.2) * 5) * 51; // mostly faint, a few darker specks
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

fs.writeFileSync("public/grain-dark.png", png(96, 24, 7));
fs.writeFileSync("public/grain-light.png", png(96, 236, 11));
console.log("grain tiles written");