// Where a misclick lands (W2 H4, `before.ts`): just beside the target,
// as a hand that slipped past an edge, and only where the point is inert
// (`inert-point.ts`).
//
// Each try draws an edge, a place along it and a gap beyond it, three draws of
// the misclick's generator; the first inert point is used, and when no try of
// `TRIES` finds one there is no misclick.

import type { ClickPoint } from "../../click-gesture";
import { inertHitAt } from "./inert-point";

/** How many points are tried before the misclick is given up. */
const TRIES = 8;

/** The nearest a misclick lands to the target's edge, in pixels. */
const GAP_MIN_PX = 6;

/** How much farther than that it may land, in pixels. */
const GAP_SPAN_PX = 18;

/** An inert point beside `target` and the element there, or `undefined` when no try found one. */
export function misclickPoint(target: Element, random: () => number, document: Document): { point: ClickPoint; hit: Element } | undefined {
  const box = target.getBoundingClientRect();
  for (let attempt = 0; attempt < TRIES; attempt += 1) {
    const edge = Math.floor(random() * 4);
    const along = random();
    const gap = GAP_MIN_PX + random() * GAP_SPAN_PX;
    const x = box.left + along * (box.right - box.left);
    const y = box.top + along * (box.bottom - box.top);
    const point = edge === 0 ? { x, y: box.top - gap } : edge === 1 ? { x, y: box.bottom + gap } : edge === 2 ? { x: box.left - gap, y } : { x: box.right + gap, y };
    const hit = inertHitAt(point, target, document);
    if (hit) return { point, hit };
  }
  return undefined;
}
