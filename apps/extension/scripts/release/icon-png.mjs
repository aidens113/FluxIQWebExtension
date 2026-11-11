// Renders the FluxIQ toolbar/store icon as a PNG at an exact pixel size.
//
// The icon is the website's brand mark (FluxIQWebsite design/brand/fluxiq-mark.svg):
// a near-black rounded tile (#0c0d0f, rx 112 of 512) carrying a light bracket
// stroke (#e8e6e3, width 3.5 in the mark's 32-unit space, round caps) -- a
// vertical stem rising from (9,26) to a quarter-arc corner and a bar to (26,6),
// plus a short crossbar at y 16.5 -- and an amber node (#f5b83d, r 3) at
// (23.5,16.5). The mark sits at translate(64 64) scale(12) inside the 512 tile.
//
// It is drawn from geometry rather than shipped as a binary asset: every stroke
// is a distance-to-segment / distance-to-arc test, each size is rendered at its
// own resolution (4x4 supersampled for anti-aliasing), and the output is
// deterministic. At 32 px and below a small-size variant is drawn: heavier
// strokes, a shorter middle bar that ends well clear of the node, and a node
// about a quarter of the tile across, so the F and the dot each read at 1x
// instead of merging into a speck. 48 px and up use the exact artwork (the
// website mark).

import { crc32, deflateSync } from "node:zlib";

const SUPERSAMPLE = 4;
const TILE = 512;
const TILE_RADIUS = 112;
const BACKGROUND = [0x0c, 0x0d, 0x0f];
const STROKE = [0xe8, 0xe6, 0xe3];
const AMBER = [0xf5, 0xb8, 0x3d];

// The mark, in its 32-unit space (mapped by translate(64) scale(12) into the tile).
const MARK_OFFSET = 64;
const MARK_SCALE = 12;
const SEGMENTS = [
  [9, 26, 9, 11],
  [14, 6, 26, 6],
  [9, 16.5, 18, 16.5]
];
// The small-size variant: the middle bar stops at x 12.5 and the node moves out to x 26.5.
const SMALL_SEGMENTS = [SEGMENTS[0], [14, 6, 24, 6], [9, 16.5, 12.5, 16.5]];
const SMALL_NODE = { x: 26.5, y: 17 };
const ARC = { cx: 14, cy: 11, r: 5 }; // the quarter from (9,11) to (14,6): the top-left quadrant
const NODE = { x: 23.5, y: 16.5, r: 3 };
const STROKE_HALF_WIDTH = 1.75;

/** Small sizes (up to 32 px) get their own drawing: heavier strokes, a short middle bar, a node a quarter of the tile wide (r 5 of the mark's 42.7 units across the tile). */
function markWeights(size) {
  if (size <= 16) return { half: 2.7, node: 5, node_at: SMALL_NODE, segments: SMALL_SEGMENTS };
  if (size <= 32) return { half: 2.4, node: 5, node_at: SMALL_NODE, segments: SMALL_SEGMENTS };
  return { half: STROKE_HALF_WIDTH, node: NODE.r, node_at: NODE, segments: SEGMENTS };
}

/**
 * @param {number} size  edge length in pixels
 * @returns {Buffer} a PNG (RGBA, 8-bit)
 */
export function renderIconPng(size) {
  if (!Number.isInteger(size) || size < 8 || size > 1024) throw new Error(`icon: unsupported size ${size}`);
  const weights = markWeights(size);
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      let covered = 0;
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const tx = ((x + (sx + 0.5) / SUPERSAMPLE) / size) * TILE;
          const ty = ((y + (sy + 0.5) / SUPERSAMPLE) / size) * TILE;
          if (!insideTile(tx, ty)) continue;
          covered += 1;
          const color = sampleColor((tx - MARK_OFFSET) / MARK_SCALE, (ty - MARK_OFFSET) / MARK_SCALE, weights);
          for (let channel = 0; channel < 3; channel += 1) sum[channel] += color[channel];
        }
      }
      const offset = y * stride + 1 + x * 4;
      for (let channel = 0; channel < 3; channel += 1) raw[offset + channel] = covered === 0 ? 0 : Math.round(sum[channel] / covered);
      raw[offset + 3] = Math.round((covered / samples) * 255);
    }
  }
  return encodePng(size, size, raw);
}

function insideTile(x, y) {
  const lo = TILE_RADIUS;
  const hi = TILE - TILE_RADIUS;
  const cx = Math.min(Math.max(x, lo), hi);
  const cy = Math.min(Math.max(y, lo), hi);
  return (x - cx) ** 2 + (y - cy) ** 2 <= TILE_RADIUS ** 2;
}

/** The colour at a point of the mark's 32-unit space (inside the tile). */
function sampleColor(mx, my, weights) {
  if ((mx - weights.node_at.x) ** 2 + (my - weights.node_at.y) ** 2 <= weights.node ** 2) return AMBER;
  return strokeDistance(mx, my, weights.segments) <= weights.half ? STROKE : BACKGROUND;
}

function strokeDistance(x, y, segments) {
  let best = Infinity;
  for (const [x0, y0, x1, y1] of segments) best = Math.min(best, distanceToSegment(x, y, x0, y0, x1, y1));
  return Math.min(best, distanceToArc(x, y));
}

function distanceToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.min(1, Math.max(0, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

/** Distance to the top-left quarter arc; outside that quadrant the nearest point is an end of the arc. */
function distanceToArc(px, py) {
  const dx = px - ARC.cx;
  const dy = py - ARC.cy;
  if (dx <= 0 && dy <= 0) return Math.abs(Math.hypot(dx, dy) - ARC.r);
  return Math.min(Math.hypot(px - (ARC.cx - ARC.r), py - ARC.cy), Math.hypot(px - ARC.cx, py - (ARC.cy - ARC.r)));
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
