// Coverage of choose-placement.ts against synthetic pages: fixed rectangles
// (banners, chat widgets, sticky headers) and ordinary controls, probed the
// way the live page is probed -- one point at a time. However busy the page,
// the answer is a pill that carries the status text, never a text-less dot
// (U3 of lane D's run-murdouox-c5294247 UI review).

import assert from "node:assert/strict";
import test from "node:test";

import { anchorStyle, choosePlacement, type OverlayPlacement, type PlacementInput, type PointCover } from "../index";

type Rect = { left: number; top: number; width: number; height: number };

const VIEWPORT = { width: 1280, height: 720 };
const BOX = { width: 384, height: 66 };
const NARROW = { width: 280, height: 66 };

/** A page of fixed boxes over ordinary controls; a later fixed box is on top, and fixed is always over a control. */
function page(fixed: Rect[], controls: Rect[] = []): (x: number, y: number) => PointCover {
  const inside = (rect: Rect, x: number, y: number) => x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
  return (x, y) => (fixed.some((rect) => inside(rect, x, y)) ? "fixed" : controls.some((rect) => inside(rect, x, y)) ? "control" : null);
}

function place(probe: PlacementInput["probe"], current?: OverlayPlacement): OverlayPlacement {
  return choosePlacement({ viewport: VIEWPORT, box: BOX, narrow: NARROW, margin: 16, probe, current });
}

const COOKIE_BANNER: Rect = { left: 0, top: 560, width: 1280, height: 160 };
const CHAT_WIDGET: Rect = { left: 1204, top: 644, width: 60, height: 60 };
const STICKY_HEADER: Rect = { left: 0, top: 0, width: 1280, height: 72 };

test("an empty page gets the bottom-left corner", () => {
  assert.deepEqual(place(page([])), { shape: "pill", anchor: "bottom-left" });
});

test("a chat widget bottom-right leaves the pill bottom-left", () => {
  assert.deepEqual(place(page([CHAT_WIDGET])), { shape: "pill", anchor: "bottom-left" });
});

test("a cookie banner across the bottom moves the pill to a top corner", () => {
  assert.deepEqual(place(page([COOKIE_BANNER, CHAT_WIDGET])), { shape: "pill", anchor: "top-left" });
});

test("a fixed box in the bottom-left corner only, however small, makes it busy", () => {
  const backToTop: Rect = { left: 20, top: 670, width: 36, height: 36 };
  assert.deepEqual(place(page([backToTop])), { shape: "pill", anchor: "top-left" });
});

test("among clear corners, the one over the fewest controls wins, on the left side first", () => {
  const logoAndNav: Rect = { left: 0, top: 0, width: 700, height: 90 };
  const leftLinks: Rect = { left: 0, top: 0, width: 400, height: 720 };
  assert.deepEqual(place(page([], [leftLinks])), { shape: "pill", anchor: "bottom-left" }, "controls never send it to the right while a left corner is clear");
  assert.deepEqual(place(page([COOKIE_BANNER], [logoAndNav])), { shape: "pill", anchor: "top-left" }, "the clear left corner, controls and all");
  const bottomLinks: Rect = { left: 0, top: 560, width: 200, height: 160 };
  assert.deepEqual(place(page([], [logoAndNav, bottomLinks])), { shape: "pill", anchor: "bottom-left" }, "between two left corners over controls, the fewer");
});

// Screenshot 00004 of the run-murwd8le-79e735a8 UI review: a cookie banner
// across the bottom, a sticky header, and a sticky category column on the left
// sent the pill to the right midpoint -- under the side panel, which in the
// Lab's emulated viewport covers the right of the page without narrowing it.
test("every corner busy and the left edge partly fixed: the pill stays on the left, where the side panel cannot hide it", () => {
  const stickyCategories: Rect = { left: 36, top: 110, width: 220, height: 450 };
  const placement = place(page([COOKIE_BANNER, STICKY_HEADER, stickyCategories]));
  assert.ok(["left", "top-left", "bottom-left"].includes(placement.anchor), `on the left: ${placement.anchor}`);
});

test("only a left edge fixed from top to bottom sends the pill to the right", () => {
  const leftRail: Rect = { left: 0, top: 0, width: 480, height: 720 };
  assert.deepEqual(place(page([leftRail])), { shape: "pill", anchor: "bottom-right" });
});

test("a corner already held is kept while nothing fixed is under it, whatever controls scroll past", () => {
  const links: Rect = { left: 0, top: 600, width: 400, height: 120 };
  assert.deepEqual(place(page([], [links]), { shape: "pill", anchor: "bottom-left" }), { shape: "pill", anchor: "bottom-left" });
  assert.deepEqual(place(page([], [links])), { shape: "pill", anchor: "top-left" }, "a fresh choice avoids the controls");
});

test("a corner that becomes busy is left for a clear one", () => {
  assert.deepEqual(place(page([COOKIE_BANNER]), { shape: "pill", anchor: "bottom-left" }), { shape: "pill", anchor: "top-left" });
});

test("every corner busy: the pill, text and all, at the least-busy edge -- never a dot", () => {
  assert.deepEqual(place(page([COOKIE_BANNER, STICKY_HEADER])), { shape: "pill", anchor: "left" }, "the side midpoint is the only place clear of the header and the banner");
});

test("every corner busy and the full pill over a fixed card: the narrower pill, where it covers nothing fixed", () => {
  const sideCard: Rect = { left: 300, top: 300, width: 300, height: 120 };
  const rightRail: Rect = { left: 1180, top: 0, width: 100, height: 720 };
  assert.deepEqual(place(page([COOKIE_BANNER, STICKY_HEADER, sideCard, rightRail])), { shape: "narrow", anchor: "left" });
});

test("every place busy: the pill goes where the least of it is fixed, and keeps its text", () => {
  const leftRail: Rect = { left: 0, top: 0, width: 80, height: 720 };
  const narrowRightRail: Rect = { left: 1250, top: 0, width: 30, height: 720 };
  const placement = place(page([COOKIE_BANNER, STICKY_HEADER, leftRail, narrowRightRail]));
  assert.notEqual(placement.shape, "dot");
  assert.equal(placement.anchor, "left", "a left place over part of a rail, rather than a clearer one the side panel may cover");
});

test("a fallback place already held is kept while no place is less busy", () => {
  const busy = page([COOKIE_BANNER, STICKY_HEADER, { left: 300, top: 300, width: 300, height: 120 }, { left: 1180, top: 0, width: 100, height: 720 }]);
  const held: OverlayPlacement = { shape: "narrow", anchor: "left" };
  assert.deepEqual(place(busy, held), held);
});

test("a fallback pill comes back to a corner once one clears", () => {
  assert.deepEqual(place(page([]), { shape: "narrow", anchor: "left" }), { shape: "pill", anchor: "bottom-left" });
  assert.deepEqual(place(page([]), { shape: "pill", anchor: "left" }), { shape: "pill", anchor: "bottom-left" });
});

test("the anchor's offsets pin two edges and free the other two", () => {
  assert.deepEqual(anchorStyle("bottom-left", 16, 66), { left: "16px", right: "auto", top: "auto", bottom: "16px" });
  assert.deepEqual(anchorStyle("top-right", 16, 66), { left: "auto", right: "16px", top: "16px", bottom: "auto" });
  assert.deepEqual(anchorStyle("left", 16, 30), { left: "16px", right: "auto", top: "calc(50% - 15px)", bottom: "auto" });
});
