// Coverage of placement-keeper.ts against a synthetic page and a hand-moved
// clock: once placed, the pill stays put unless a clearly better place stays
// better for a sustained time. A change that comes and goes, and anything
// that happens while the page scrolls, never moves it (round 5 of the breadth
// reruns: the pill jumped between the top, the middle and the bottom of the
// left edge, sometimes within three seconds). A new page starts from the
// place the last one held, while that place is still clear.

import assert from "node:assert/strict";
import test from "node:test";

import { PlacementKeeper, type OverlayPlacement, type PlacementPage, type PointCover } from "../index";
import { withFakeClock } from "../../tests/fake-clock";

type Rect = { left: number; top: number; width: number; height: number };

const VIEWPORT = { width: 1280, height: 720 };
const BOTTOM_BANNER: Rect = { left: 0, top: 560, width: 1280, height: 160 };
const TOP_BANNER: Rect = { left: 0, top: 0, width: 1280, height: 160 };
const BOTTOM_TEXT: Rect = { left: 0, top: 560, width: 1280, height: 160 };

/** A page whose fixed boxes and text the test changes as it goes; `measurable` false is a document with no layout yet. */
function fakePage(): PlacementPage & { fixed: Rect[]; content: Rect[]; measurable: boolean } {
  const inside = (rect: Rect, x: number, y: number) => x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
  const state = {
    fixed: [] as Rect[],
    content: [] as Rect[],
    measurable: true,
    viewport: () => (state.measurable ? VIEWPORT : undefined),
    probe: () => (x: number, y: number): PointCover => (state.fixed.some((rect) => inside(rect, x, y)) ? "fixed" : state.content.some((rect) => inside(rect, x, y)) ? "content" : null)
  };
  return state;
}

function keeper(page: PlacementPage, remembered: OverlayPlacement[] = []) {
  const placed: OverlayPlacement[] = [];
  const instance = new PlacementKeeper({
    sizes: () => ({ box: { width: 384, height: 84 }, narrow: { width: 288, height: 84 }, margin: 16 }),
    place: (placement) => placed.push(placement),
    page,
    remember: (placement) => remembered.push(placement)
  });
  return { instance, placed };
}

test("the first check places the pill at once", () => {
  withFakeClock(() => {
    const page = fakePage();
    page.fixed = [BOTTOM_BANNER];
    const { instance, placed } = keeper(page);
    instance.start();
    assert.deepEqual(placed, [{ shape: "pill", anchor: "top-left" }]);
  });
});

test("a better place must stay better for a sustained time before the pill moves; a change that comes and goes never moves it", () => {
  withFakeClock((clock) => {
    const page = fakePage();
    const { instance, placed } = keeper(page);
    instance.start();
    assert.deepEqual(placed, [{ shape: "pill", anchor: "bottom-left" }]);
    page.fixed = [BOTTOM_BANNER];
    instance.pageChanged();
    clock.advance(900);
    page.fixed = [];
    instance.pageChanged();
    clock.advance(5_000);
    assert.equal(placed.length, 1, `a banner that came and went within a second: ${JSON.stringify(placed)}`);
    page.fixed = [BOTTOM_BANNER];
    instance.pageChanged();
    clock.advance(1_000);
    assert.equal(placed.length, 1, "not yet: the banner has been there a second");
    clock.advance(1_500);
    assert.deepEqual(placed.at(-1), { shape: "pill", anchor: "top-left" }, "a banner that stays: the pill moves off it");
    instance.stop();
  });
});

test("scrolling never moves the pill, and neither does text left under it: only the page's fixed layers do", () => {
  withFakeClock((clock) => {
    const page = fakePage();
    const { instance, placed } = keeper(page);
    instance.start();
    for (let at = 0; at < 6_000; at += 100) {
      page.content = at % 300 === 0 ? [] : [BOTTOM_TEXT];
      instance.scrolled();
      instance.pageChanged();
      clock.advance(100);
    }
    assert.deepEqual(placed, [{ shape: "pill", anchor: "bottom-left" }], "six seconds of scrolling text under it: no move");
    page.content = [BOTTOM_TEXT];
    clock.advance(1_000);
    clock.advance(10_000);
    assert.equal(placed.length, 1, "the text stayed under it: no move");
    instance.stop();
  });
});

test("a page load keeps the last page's place while it is still clear, and leaves it at once when it is not", () => {
  withFakeClock(() => {
    const page = fakePage();
    const remembered: OverlayPlacement[] = [];
    const first = keeper(page, remembered);
    first.instance.start({ shape: "pill", anchor: "top-left" });
    assert.deepEqual(first.placed, [{ shape: "pill", anchor: "top-left" }], "an empty page: the last place, not the first corner");
    first.instance.stop();
    page.fixed = [TOP_BANNER];
    const second = keeper(page, remembered);
    second.instance.start({ shape: "pill", anchor: "top-left" });
    assert.deepEqual(second.placed, [{ shape: "pill", anchor: "bottom-left" }], "the last place is under a banner here");
    assert.deepEqual(remembered.at(-1), { shape: "pill", anchor: "bottom-left" }, "the place taken is remembered for the next page");
  });
});

test("a document with no layout yet keeps the pill where it starts, and the first measured check places it at once", () => {
  withFakeClock((clock) => {
    const page = fakePage();
    page.measurable = false;
    const { instance, placed } = keeper(page);
    instance.start();
    assert.deepEqual(placed, [{ shape: "pill", anchor: "bottom-left" }]);
    page.measurable = true;
    page.fixed = [BOTTOM_BANNER];
    instance.pageChanged();
    // One check interval: the keeper checks at most once per interval.
    clock.advance(800);
    assert.deepEqual(placed.at(-1), { shape: "pill", anchor: "top-left" }, "no settling wait: the first place was never measured");
    instance.stop();
  });
});

// t774: a banner that appears mid-run moves the pill once, to a free corner, and it then stays there.
test("a banner appearing mid-run moves the pill once, and it is stable after", () => {
  withFakeClock((clock) => {
    const page = fakePage();
    const { instance, placed } = keeper(page);
    instance.start();
    assert.deepEqual(placed, [{ shape: "pill", anchor: "bottom-left" }], "a plain page: the bottom");
    clock.advance(5_000);
    page.fixed = [BOTTOM_BANNER];
    for (let at = 0; at < 20_000; at += 100) {
      instance.pageChanged();
      clock.advance(100);
    }
    assert.equal(placed.length, 2, "one move");
    assert.notDeepEqual(placed[1], placed[0]);
    page.content = [BOTTOM_TEXT];
    for (let at = 0; at < 10_000; at += 100) {
      instance.pageChanged();
      clock.advance(100);
    }
    assert.equal(placed.length, 2, "stable after");
    instance.stop();
  });
});
