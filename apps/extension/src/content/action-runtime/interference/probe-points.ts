// Where the viewport is hit-tested for a layer when the defence is not told
// where the blocked target was -- and, when it is told, that point too.
//
// **Why the corners.** Until 2026-09-30 the probe was seven points: the centre,
// the middle of each edge, and two more on the vertical centre line. That finds
// a centred modal, a consent bar and a promotion strip, and it misses every
// widget that lives in a corner -- which is where a support chat, a cookie
// "manage" pill and a "rate us" card are drawn. Live, bigbox's product page
// opens its support card bottom-right three seconds after load, over the pinned
// Add to cart (lane t174, run 20, row R1): the refusal named it as the layer
// over the target, and the defence, probing seven points none of which lay in
// it, pressed nothing and spent its ladder. So the four corners are probed too.
//
// **Why inset.** A corner pixel is the scrollbar, the window's own edge, or the
// few pixels a card's rounded border and its `right: 16px` leave uncovered.
// Six per cent in from each edge lands inside any card a real page draws in a
// corner -- bigbox's is 360 by 210 px, 16 px from the edges, and the inset point
// is inside it from an 800 by 600 viewport up -- and still well clear of the
// middle-edge probes, so no two points ask the same question.
//
// **Bounded.** At most twelve points: the eleven fixed ones and the one blocked
// point when it is known. Each costs one hit test, and the classification each
// hit then goes through (`overlays.ts`) is unchanged: a layer counts only as a
// declared dialog or a fixed overlay with its own way out (`way-out.ts`).
//
// A pure function of the viewport's size, so the geometry is tested without a
// DOM.

import type { Point } from "./overlays";

/** Fractions of the viewport's width and height that are probed, in the order their layers are collected. */
const PROBE_FRACTIONS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  // The centre, then the middle of each edge.
  [0.5, 0.5],
  [0.5, 0.08],
  [0.5, 0.92],
  [0.08, 0.5],
  [0.92, 0.5],
  [0.5, 0.25],
  [0.5, 0.75],
  // The four corners, inset so a scrollbar or an edge pixel is not what is hit.
  // Bottom-right first: it is where a chat widget or a proactive card is drawn.
  [0.94, 0.94],
  [0.06, 0.94],
  [0.94, 0.06],
  [0.06, 0.06]
] as const);

/**
 * The viewport points to hit-test for a covering layer: the blocked point
 * first when it is known and inside the viewport, then the fixed fractions.
 * Empty for a viewport with no area.
 */
export function probePoints(width: number, height: number, blockedAt?: Point): Point[] {
  if (!(width > 0) || !(height > 0)) return [];
  const points: Point[] = [];
  if (blockedAt && inside(blockedAt, width, height)) points.push({ x: Math.floor(blockedAt.x), y: Math.floor(blockedAt.y) });
  for (const [fx, fy] of PROBE_FRACTIONS) {
    const point = { x: Math.floor(width * fx), y: Math.floor(height * fy) };
    if (!points.some((seen) => seen.x === point.x && seen.y === point.y)) points.push(point);
  }
  return points;
}

function inside(point: Point, width: number, height: number): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
}
