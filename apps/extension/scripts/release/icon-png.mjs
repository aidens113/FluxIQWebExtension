// Renders the FluxIQ toolbar/store icon as a PNG at an exact pixel size.
//
// The build used to write one 128x128 placeholder under every icon name, so the
// 16, 32 and 48 entries in each manifest pointed at a 128-pixel image and the
// store listing had no mark at all. The icon is drawn here from geometry instead
// -- a rounded indigo-to-sky square carrying a white "F" and a dot -- so each
// size is rendered at its own resolution (4x4 supersampled for anti-aliasing),
// the output is deterministic, and no binary asset has to be tracked.

import { crc32, deflateSync } from "node:zlib";

const TOP = [0x4f, 0x46, 0xe5];
const BOTTOM = [0x0e, 0xa5, 0xe9];
const SUPERSAMPLE = 4;

/** Glyph rectangles in unit coordinates: [x0, y0, x1, y1]. */
const GLYPH_RECTS = [
  [0.29, 0.23, 0.43, 0.77],
  [0.29, 0.23, 0.72, 0.36],
  [0.29, 0.45, 0.63, 0.57]
];
const DOT = { x: 0.69, y: 0.7, r: 0.075 };
const CORNER = 0.22;

/**
 * @param {number} size  edge length in pixels
 * @returns {Buffer} a PNG (RGBA, 8-bit)
 */
export function renderIconPng(size) {
  if (!Number.isInteger(size) || size < 8 || size > 1024) throw new Error(`icon: unsupported size ${size}`);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      let shape = 0;
      let glyph = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const u = (x + (sx + 0.5) / SUPERSAMPLE) / size;
          const v = (y + (sy + 0.5) / SUPERSAMPLE) / size;
          if (!insideRoundedSquare(u, v)) continue;
          shape += 1;
          if (insideGlyph(u, v)) glyph += 1;
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const alpha = shape / samples;
      const white = shape === 0 ? 0 : glyph / shape;
      const t = (y + 0.5) / size;
      const offset = y * stride + 1 + x * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const base = TOP[channel] + (BOTTOM[channel] - TOP[channel]) * t;
        raw[offset + channel] = Math.round(base + (255 - base) * white);
      }
      raw[offset + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, raw);
}

function insideRoundedSquare(u, v) {
  const cx = Math.min(Math.max(u, CORNER), 1 - CORNER);
  const cy = Math.min(Math.max(v, CORNER), 1 - CORNER);
  return (u - cx) ** 2 + (v - cy) ** 2 <= CORNER ** 2;
}

function insideGlyph(u, v) {
  if (GLYPH_RECTS.some(([x0, y0, x1, y1]) => u >= x0 && u <= x1 && v >= y0 && v <= y1)) return true;
  return (u - DOT.x) ** 2 + (v - DOT.y) ** 2 <= DOT.r ** 2;
}

function encodePng(width, height, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed) >>> 0, 0);
  return Buffer.concat([length, typed, checksum]);
}
