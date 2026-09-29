// Vẽ icon extension (bi cái trên nỉ) ra PNG, không cần thư viện ảnh.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BRASS = hex("#D9A72C"), IVORY = hex("#F3EDDF"), FELT = hex("#12392F"), DEEP = hex("#0B2720");

function colorAt(x, y) {
  const r = Math.hypot(x, y); // tọa độ chuẩn hóa [-1, 1]
  if (r > 0.96) return null;
  if (r > 0.86) return DEEP;
  if (r > 0.5) return BRASS;
  if (r > 0.2) return IVORY;
  return FELT;
}

function png(size) {
  const SS = 4;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = ((px + (sx + 0.5) / SS) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / SS) / size) * 2 - 1;
          const c = colorAt(x, y);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      const n = SS * SS;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / n) * 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const s of [16, 48, 128]) writeFileSync(`public/icons/icon-${s}.png`, png(s));
console.log("đã tạo icon 16/48/128");
