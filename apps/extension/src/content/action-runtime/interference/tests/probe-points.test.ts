// Where the defence hit-tests the viewport for a layer (`probe-points.ts`).
//
// The corner rows are bigbox's: its product page opens a support card
// bottom-right three seconds after load, 360 by 210 px and 16 px in from the
// right and bottom edges (`scenarios/bigbox-retail/shell/support-chat.ts`),
// over the pinned Add to cart. Lane t174's run 20 died on it because none of
// the seven points probed then lay inside it (row R1).

import assert from "node:assert/strict";
import test from "node:test";
import { probePoints } from "../probe-points";

type Box = { left: number; top: number; right: number; bottom: number };

/** Bigbox's support card, as its stylesheet places it in a viewport of this size. */
function supportCard(width: number, height: number): Box {
  return { left: width - 16 - 360, top: height - 16 - 210, right: width - 16, bottom: height - 16 };
}

function hits(box: Box, points: ReadonlyArray<{ x: number; y: number }>): boolean {
  return points.some((point) => point.x >= box.left && point.x < box.right && point.y >= box.top && point.y < box.bottom);
}

/** The seven points probed before the corners were added: centre, edge middles, and two on the centre line. */
function sevenPointProbe(width: number, height: number): Array<{ x: number; y: number }> {
  return ([[0.5, 0.5], [0.5, 0.08], [0.5, 0.92], [0.08, 0.5], [0.92, 0.5], [0.5, 0.25], [0.5, 0.75]] as const)
    .map(([fx, fy]) => ({ x: Math.floor(width * fx), y: Math.floor(height * fy) }));
}

test("the probe includes all four corners, inset from the edges", () => {
  const points = probePoints(1000, 800);
  for (const corner of [{ x: 940, y: 752 }, { x: 60, y: 752 }, { x: 940, y: 48 }, { x: 60, y: 48 }]) {
    assert.ok(points.some((point) => point.x === corner.x && point.y === corner.y), `no probe at ${corner.x},${corner.y}`);
  }
  // Inset: nothing is probed on the outermost pixels, where a scrollbar or the window's edge is what is hit.
  for (const point of points) {
    assert.ok(point.x >= 50 && point.x <= 950 && point.y >= 40 && point.y <= 760, `probe ${point.x},${point.y} sits on an edge`);
  }
});

test("bigbox's support card in the bottom-right corner is probed at every common viewport, which seven points never did", () => {
  for (const [width, height] of [[1280, 720], [1366, 768], [1440, 900], [1920, 1080], [1024, 768], [800, 600]] as const) {
    const card = supportCard(width, height);
    assert.equal(hits(card, sevenPointProbe(width, height)), false, `the old probe already reached the card at ${width}x${height}`);
    assert.equal(hits(card, probePoints(width, height)), true, `no probe lands inside the support card at ${width}x${height}`);
  }
});

test("the centre and edge-middle probes are kept, and come first, so a centred modal is still found first", () => {
  const points = probePoints(1280, 720);
  assert.deepEqual(points.slice(0, 7), sevenPointProbe(1280, 720));
});

test("the probe stays bounded: eleven fixed points, twelve with the blocked point", () => {
  assert.equal(probePoints(1280, 720).length, 11);
  assert.equal(probePoints(1280, 720, { x: 1100, y: 690 }).length, 12);
});

test("the point the blocked target sits at, when known, is probed first", () => {
  const points = probePoints(1280, 720, { x: 1100.6, y: 690.2 });
  assert.deepEqual(points[0], { x: 1100, y: 690 });
});

test("a blocked point that is one of the fixed points is not probed twice", () => {
  const points = probePoints(1280, 720, { x: 640, y: 360 });
  assert.equal(points.length, 11);
  assert.deepEqual(points[0], { x: 640, y: 360 });
});

test("a blocked point outside the viewport, or not a number, is ignored", () => {
  for (const blockedAt of [{ x: -1, y: 10 }, { x: 10, y: 720 }, { x: 1280, y: 10 }, { x: Number.NaN, y: 10 }]) {
    assert.equal(probePoints(1280, 720, blockedAt).length, 11, JSON.stringify(blockedAt));
  }
});

test("a viewport with no area is not probed at all", () => {
  assert.deepEqual(probePoints(0, 720), []);
  assert.deepEqual(probePoints(1280, 0), []);
  assert.deepEqual(probePoints(Number.NaN, 720), []);
});
