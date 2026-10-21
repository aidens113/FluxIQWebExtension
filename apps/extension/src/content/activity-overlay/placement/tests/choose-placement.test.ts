// Coverage of choose-placement.ts against synthetic pages: fixed rectangles
// (banners, chat widgets, sticky headers) and ordinary controls and content,
// probed the way the live page is probed -- one point at a time. However busy
// the page, the answer is a pill that carries the status text, never a
// text-less dot (U3 of lane D's run-murdouox-c5294247 UI review), always in a
// top or bottom band of the viewport, never its vertical middle. How long a
// better place must stay better before the pill moves is the keeper's
// (`placement-keeper.test.ts`).

import assert from "node:assert/strict";
import test from "node:test";

import { anchorStyle, choosePlacement, type OverlayPlacement, type PlacementInput, type PointCover } from "../index";

type Rect = { left: number; top: number; width: number; height: number };

const VIEWPORT = { width: 1280, height: 720 };
const BOX = { width: 384, height: 66 };
const NARROW = { width: 280, height: 66 };
const MARGIN = 16;

/** A page of fixed boxes over ordinary controls and content (text, images); fixed is on top, then controls, then content. */
function page(fixed: Rect[], controls: Rect[] = [], content: Rect[] = []): (x: number, y: number) => PointCover {
  const inside = (rect: Rect, x: number, y: number) => x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
  return (x, y) => (fixed.some((rect) => inside(rect, x, y)) ? "fixed" : controls.some((rect) => inside(rect, x, y)) ? "control" : content.some((rect) => inside(rect, x, y)) ? "content" : null);
}

function place(probe: PlacementInput["probe"], current?: OverlayPlacement): OverlayPlacement {
  return choosePlacement({ viewport: VIEWPORT, box: BOX, narrow: NARROW, margin: MARGIN, probe, current });
}

/** The pill's box for `placement` in `viewport`, as the host's offsets put it. */
function boxOf(placement: OverlayPlacement, viewport = VIEWPORT): Rect {
  const size = placement.shape === "pill" ? BOX : NARROW;
  const left = placement.anchor.endsWith("right") ? viewport.width - MARGIN - size.width : MARGIN;
  const offset = placement.offset ?? 0;
  const top = placement.anchor.startsWith("top") ? MARGIN + offset : viewport.height - MARGIN - offset - size.height;
  return { left, top, width: size.width, height: size.height };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/** The pill sits in the top or the bottom 40% of the viewport, never across its middle. */
function assertInEdgeBand(placement: OverlayPlacement, viewport = VIEWPORT): void {
  const box = boxOf(placement, viewport);
  assert.ok(["bottom-left", "top-left", "bottom-right", "top-right"].includes(placement.anchor), `a corner: ${placement.anchor}`);
  const inTop = box.top + box.height <= viewport.height * 0.4;
  const inBottom = box.top >= viewport.height * 0.6;
  assert.ok(inTop || inBottom, `in an edge band, not the middle: top ${box.top}, bottom ${box.top + box.height}`);
}

const COOKIE_BANNER: Rect = { left: 0, top: 560, width: 1280, height: 160 };
const CHAT_WIDGET: Rect = { left: 1204, top: 644, width: 60, height: 60 };
const STICKY_HEADER: Rect = { left: 0, top: 0, width: 1280, height: 72 };

test("an empty page gets the bottom-left corner", () => {
  assert.deepEqual(place(page([])), { shape: "pill", anchor: "bottom-left" });
});

test("thin readable lines between coarse grid points are covered content", () => {
  const line = { left: 0, top: 650, width: 440, height: 14 };
  const placement = place(page([STICKY_HEADER], [], [line]));
  assert.equal(overlaps(boxOf(placement), line), false, "the clear band below the header is available instead");
});

test("an occupied page does not pay for finer sampling of already occupied places", () => {
  let probes = 0;
  choosePlacement({ viewport: VIEWPORT, box: { width: 384, height: 84 }, narrow: { width: 280, height: 84 }, margin: MARGIN,
    probe: () => {
      probes += 1;
      return "content";
    } });
  assert.ok(probes <= 1_000, `bounded work on an occupied page: ${probes} probes`);
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
  const bottomLinks: Rect = { left: 0, top: 560, width: 200, height: 160 };
  const between = place(page([], [logoAndNav, bottomLinks]));
  assert.ok(!overlaps(boxOf(between), logoAndNav) && !overlaps(boxOf(between), bottomLinks), `both left corners over controls: moved in from an edge, clear of both (${JSON.stringify(between)})`);
  assertInEdgeBand(between);
  const tallNav: Rect = { left: 0, top: 0, width: 700, height: 300 };
  const tallFooter: Rect = { left: 0, top: 420, width: 200, height: 300 };
  assert.equal(place(page([], [tallNav, tallFooter])).anchor, "bottom-left", "no clear place within reach: the corner over fewer controls");
});

// Round 5 of the breadth reruns: with the bottom-left corner busy, the pill sat
// at top-left over the site's logo and header -- a page header that scrolls is
// not fixed, so it only broke ties, and a corner clear of fixed parts won
// whatever it covered.
test("the page's own header, logo and navigation are not covered while a place clear of them exists", () => {
  const logo: Rect = { left: 24, top: 12, width: 160, height: 48 };
  const nav: Rect = { left: 200, top: 20, width: 600, height: 32 };
  const headerText: Rect = { left: 0, top: 0, width: 1280, height: 80 };
  const backToTop: Rect = { left: 20, top: 670, width: 36, height: 36 };
  const placement = place(page([backToTop], [nav], [logo, headerText]));
  const box = boxOf(placement);
  assertInEdgeBand(placement);
  for (const [name, rect] of [["the logo", logo], ["the navigation", nav], ["the header", headerText], ["the fixed button", backToTop]] as const) {
    assert.ok(!overlaps(box, rect), `the pill (${JSON.stringify(box)}) covers ${name}`);
  }
});

test("a header the pill would cover ranks behind a place farther down the order that covers nothing", () => {
  const headerControls: Rect = { left: 0, top: 0, width: 1280, height: 90 };
  const cookieBanner: Rect = { left: 0, top: 600, width: 1280, height: 120 };
  const placement = place(page([cookieBanner], [headerControls]));
  const box = boxOf(placement);
  assert.ok(!overlaps(box, headerControls) && !overlaps(box, cookieBanner), `clear of the header and the banner: ${JSON.stringify(placement)}`);
  assertInEdgeBand(placement);
});

// Screenshot 00004 of the run-murwd8le-79e735a8 UI review: a cookie banner
// across the bottom, a sticky header, and a sticky category column on the left
// sent the pill to the right midpoint -- under the side panel, which in the
// Lab's emulated viewport covers the right of the page without narrowing it.
test("every corner busy and the left edge partly fixed: the pill stays on the left, where the side panel cannot hide it", () => {
  const stickyCategories: Rect = { left: 36, top: 110, width: 220, height: 450 };
  const placement = place(page([COOKIE_BANNER, STICKY_HEADER, stickyCategories]));
  assert.ok(["top-left", "bottom-left"].includes(placement.anchor), `on the left: ${placement.anchor}`);
  assertInEdgeBand(placement);
});

test("only a left edge fixed from top to bottom sends the pill to the right", () => {
  const leftRail: Rect = { left: 0, top: 0, width: 480, height: 720 };
  assert.deepEqual(place(page([leftRail])), { shape: "pill", anchor: "bottom-right" });
});

test("a corner held over controls gives way to a clear one: what the pill covers ranks ahead of where it was", () => {
  const links: Rect = { left: 0, top: 600, width: 400, height: 120 };
  assert.deepEqual(place(page([], [links]), { shape: "pill", anchor: "bottom-left" }), { shape: "pill", anchor: "top-left" });
  assert.deepEqual(place(page([], [links])), { shape: "pill", anchor: "top-left" }, "a fresh choice avoids the controls");
});

test("a corner that becomes busy is left for a clear one", () => {
  assert.deepEqual(place(page([COOKIE_BANNER]), { shape: "pill", anchor: "bottom-left" }), { shape: "pill", anchor: "top-left" });
});

// Round 5: the pill sat at the vertical middle of the left edge (y 318) between
// spells at the top (y 16) and the bottom (y 620).
test("every corner busy: the pill docks just past the fixed band, text and all, never at the middle of the edge", () => {
  const placement = place(page([COOKIE_BANNER, STICKY_HEADER]));
  assert.equal(placement.shape, "pill");
  assertInEdgeBand(placement);
  const box = boxOf(placement);
  assert.ok(!overlaps(box, COOKIE_BANNER) && !overlaps(box, STICKY_HEADER), `clear of the header and the banner: ${JSON.stringify(placement)}`);
});

/** Bands too deep to dock past within the reach: a tall header and a tall banner. */
const DEEP_HEADER: Rect = { left: 0, top: 0, width: 1280, height: 220 };
const DEEP_BANNER: Rect = { left: 0, top: 480, width: 1280, height: 240 };

test("bands too deep to clear: the pill covers the least of them from an edge band, never the middle", () => {
  const sideCard: Rect = { left: 300, top: 300, width: 300, height: 120 };
  const rightRail: Rect = { left: 1180, top: 0, width: 100, height: 720 };
  const placement = place(page([DEEP_BANNER, DEEP_HEADER, sideCard, rightRail]));
  assertInEdgeBand(placement);
  const docked = place(page([COOKIE_BANNER, STICKY_HEADER, sideCard, rightRail]));
  assert.equal(docked.shape, "pill", "a full pill docked past a shallow band beats the narrow one");
  assertInEdgeBand(docked);
});

test("every place busy: the pill goes where the least of it is fixed, and keeps its text", () => {
  const leftRail: Rect = { left: 0, top: 0, width: 80, height: 720 };
  const narrowRightRail: Rect = { left: 1250, top: 0, width: 30, height: 720 };
  const placement = place(page([COOKIE_BANNER, STICKY_HEADER, leftRail, narrowRightRail]));
  assert.ok(["pill", "narrow"].includes(placement.shape));
  assert.ok(placement.anchor.endsWith("left"), "a left place over part of a rail, rather than a clearer one the side panel may cover");
  assertInEdgeBand(placement);
});

test("a held place is kept unless another covers clearly less: a point or two of text is no reason to move", () => {
  const nearlyAsBusy = page([], [], [{ left: 0, top: 560, width: 1280, height: 160 }, { left: 0, top: 0, width: 220, height: 160 }]);
  const held = place(nearlyAsBusy);
  assert.deepEqual(place(nearlyAsBusy, held), held, "the place held now is the best: kept");
  const heldBottom: OverlayPlacement = { shape: "pill", anchor: "bottom-left" };
  // Text over the whole page but a sliver at the top-left: every place covers
  // text, the top-left corner a little less of it.
  const slightlyLess = page([], [], [{ left: 0, top: 100, width: 1280, height: 620 }, { left: 60, top: 0, width: 1220, height: 100 }]);
  assert.deepEqual(place(slightlyLess, heldBottom), heldBottom, "a place a little less busy does not take the pill");
  const clearElsewhere = page([], [], [{ left: 0, top: 600, width: 1280, height: 120 }]);
  assert.notDeepEqual(place(clearElsewhere, heldBottom), heldBottom, "a place that covers nothing does");
});

test("a narrow or docked pill comes back to the full pill in its corner once the corner clears", () => {
  assert.deepEqual(place(page([]), { shape: "narrow", anchor: "bottom-left" }), { shape: "pill", anchor: "bottom-left" });
  assert.deepEqual(place(page([]), { shape: "pill", anchor: "bottom-left", offset: 120 }), { shape: "pill", anchor: "bottom-left" });
});

// D5 of the run-musp4h2f-72e8ed99 UI review: on every product page a sticky
// header (0-93) and a fixed Add to cart bar (630-705) made both left corners
// busy, and the left midpoint put the pill on the product image (x 198-651, y
// 80-523). The page's free band between the image and the bar is where it
// covers nothing a person reads.
const PRODUCT_HEADER: Rect = { left: 0, top: 0, width: 1240, height: 93 };
const ADD_TO_CART_BAR: Rect = { left: 0, top: 630, width: 1264, height: 75 };
const PRODUCT_IMAGE: Rect = { left: 198, top: 80, width: 453, height: 443 };
const PRODUCT_PAGE_VIEWPORT = { width: 1264, height: 705 };

test("every corner busy and the image near the top: the pill docks above the fixed bar, clear of the image", () => {
  const placement = choosePlacement({ viewport: PRODUCT_PAGE_VIEWPORT, box: BOX, narrow: NARROW, margin: MARGIN, probe: page([PRODUCT_HEADER, ADD_TO_CART_BAR], [], [PRODUCT_IMAGE]) });
  assert.equal(placement.shape, "pill");
  assert.equal(placement.anchor, "bottom-left");
  const bottom = PRODUCT_PAGE_VIEWPORT.height - MARGIN - (placement.offset ?? 0);
  assert.ok(bottom <= ADD_TO_CART_BAR.top, `the pill ends above the bar: bottom ${bottom}`);
  assert.ok(bottom - BOX.height >= PRODUCT_IMAGE.top + PRODUCT_IMAGE.height, `and starts below the image: top ${bottom - BOX.height}`);
  assert.ok(ADD_TO_CART_BAR.top - bottom <= 24, `docked against the bar, not floating: gap ${ADD_TO_CART_BAR.top - bottom}`);
  assert.deepEqual(anchorStyle(placement.anchor, MARGIN, placement.offset), { left: "16px", right: "auto", top: "auto", bottom: `${MARGIN + (placement.offset ?? 0)}px` });
});

test("a docked place already held is kept while it stays clear", () => {
  const probe = page([PRODUCT_HEADER, ADD_TO_CART_BAR], [], [PRODUCT_IMAGE]);
  const first = choosePlacement({ viewport: PRODUCT_PAGE_VIEWPORT, box: BOX, narrow: NARROW, margin: MARGIN, probe });
  assert.deepEqual(choosePlacement({ viewport: PRODUCT_PAGE_VIEWPORT, box: BOX, narrow: NARROW, margin: MARGIN, probe, current: first }), first);
});

test("among clear corners, the one over the least readable content wins", () => {
  const bottomText: Rect = { left: 0, top: 560, width: 600, height: 160 };
  assert.deepEqual(place(page([], [], [bottomText])), { shape: "pill", anchor: "top-left" });
});

test("the anchor's offsets pin two edges and free the other two", () => {
  assert.deepEqual(anchorStyle("bottom-left", 16), { left: "16px", right: "auto", top: "auto", bottom: "16px" });
  assert.deepEqual(anchorStyle("top-right", 16), { left: "auto", right: "16px", top: "16px", bottom: "auto" });
  assert.deepEqual(anchorStyle("top-left", 16, 72), { left: "16px", right: "auto", top: "88px", bottom: "auto" });
});

test("a held place that a fixed part of the page comes over is left", () => {
  const held: OverlayPlacement = { shape: "pill", anchor: "bottom-left" };
  const popup: Rect = { left: 0, top: 600, width: 500, height: 120 };
  assert.notDeepEqual(place(page([popup]), held), held);
});
