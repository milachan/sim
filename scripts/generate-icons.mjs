#!/usr/bin/env node
/**
 * Menghasilkan ikon PWA (PNG) tanpa dependensi eksternal.
 * Desain: kotak emerald dengan topi toga putih — senada dengan logo aplikasi.
 *
 * Output (public/icons/):
 *   - icon-192.png            (192x192, sudut membulat)
 *   - icon-512.png            (512x512, sudut membulat)
 *   - icon-maskable-512.png   (512x512, full-bleed, glyph dalam safe zone)
 *   - apple-touch-icon.png    (180x180, full-bleed untuk iOS)
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "icons");
mkdirSync(OUT, { recursive: true });

// ---------- Minimal PNG encoder ----------
const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter none
    src.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Renderer (supersampling 4x untuk anti-aliasing) ----------
const SS = 4;
const C1 = [16, 185, 129]; // emerald-500
const C2 = [6, 95, 70]; // emerald-800

function render(size, { maskable = false } = {}) {
  const n = size * SS;
  const px = new Float64Array(n * n * 4);
  const gs = maskable ? 0.78 : 1; // glyph lebih kecil utk maskable (safe zone)
  const r = 0.2 * n; // radius sudut

  const inRoundedRect = (x, y) => {
    const cx = Math.max(r, Math.min(x, n - r));
    const cy = Math.max(r, Math.min(y, n - r));
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };

  // Topi toga: belah ketupat + papan bawah + jumbai
  const inDiamond = (x, y) => {
    const cx = 0.5 * n;
    const cy = 0.42 * n;
    const hx = 0.21 * n * gs;
    const hy = 0.105 * n * gs;
    return Math.abs(x - cx) / hx + Math.abs(y - cy) / hy <= 1;
  };

  const inBase = (x, y) => {
    const cx = 0.5 * n;
    const y0 = (0.42 + 0.03 * gs) * n;
    const y1 = (0.42 + 0.16 * gs) * n;
    const w = 0.17 * n * gs;
    return x >= cx - w && x <= cx + w && y >= y0 && y <= y1;
  };

  const distToSegment = (x, y, ax, ay, bx, by) => {
    const abx = bx - ax;
    const aby = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (y - ay) * aby) / (abx * abx + aby * aby)));
    const dx = x - (ax + t * abx);
    const dy = y - (ay + t * aby);
    return Math.sqrt(dx * dx + dy * dy);
  };

  const inTassel = (x, y) => {
    const ax = 0.5 * n;
    const ay = (0.42 - 0.105 * gs) * n;
    const bx = (0.5 + 0.17 * gs) * n;
    const by = (0.42 + 0.02 * gs) * n;
    // tali jumbai
    if (distToSegment(x, y, ax, ay, bx, by) <= 0.02 * n * gs) return true;
    // bola di ujung
    const dx = x - bx;
    const dy = y - by;
    return dx * dx + dy * dy <= Math.pow(0.05 * n * gs, 2);
  };

  const white = [255, 255, 255, 255];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      if (inDiamond(x, y) || inBase(x, y) || inTassel(x, y)) {
        px[i] = white[0];
        px[i + 1] = white[1];
        px[i + 2] = white[2];
        px[i + 3] = white[3];
        continue;
      }
      const inBg = maskable || inRoundedRect(x, y);
      if (!inBg) continue;
      const t = Math.min(1, Math.max(0, (x + y) / (2 * n)));
      px[i] = C1[0] + (C2[0] - C1[0]) * t;
      px[i + 1] = C1[1] + (C2[1] - C1[1]) * t;
      px[i + 2] = C1[2] + (C2[2] - C1[2]) * t;
      px[i + 3] = 255;
    }
  }

  // Downsample SSxSS -> 1 piksel
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * n + (x * SS + sx)) * 4;
          const a = px[i + 3];
          rSum += px[i] * a;
          gSum += px[i + 1] * a;
          bSum += px[i + 2] * a;
          aSum += a;
        }
      }
      const o = (y * size + x) * 4;
      const div = aSum || 1;
      out[o] = Math.round(rSum / div);
      out[o + 1] = Math.round(gSum / div);
      out[o + 2] = Math.round(bSum / div);
      out[o + 3] = Math.round(aSum / (SS * SS));
    }
  }
  return encodePng(size, size, out);
}

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
];

for (const t of targets) {
  const png = render(t.size, { maskable: t.maskable });
  writeFileSync(join(OUT, t.file), png);
  console.log(`✔ ${t.file} (${t.size}x${t.size}) — ${png.length} bytes`);
}

console.log("\n✅ Ikon PWA selesai dibuat di public/icons/");
