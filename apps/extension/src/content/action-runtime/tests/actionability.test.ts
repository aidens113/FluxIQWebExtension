// Where the actionability gate hits a target whose centre something else's box
// overlaps (`../actionability.ts`).
//
// Live (t707 round 3, defect D2): a phone-case cart in a 543 px tab, the side
// panel open. Every click on the line's "Save for later" link was refused as
// "the point 220,451 landed on p.css-1y6w9q1, which covers the target". That
// paragraph is the line's static price, whose oversized box overlaps the link's
// centre and draws nothing over it; 27 of 63 sampled points on the link hit the
// link, so a person's click on its words works. The gate tested the centre
// alone. These rows rebuild that geometry: the link 80 by 22 px centred at
// 220,451, and the price box ending at y 452, over the link's upper half.

import assert from "node:assert/strict";
import test from "node:test";
import { checkActionability } from "../actionability";
import { dispatchClickGesture } from "../click-gesture";

type Box = { left: number; top: number; width: number; height: number };
type Press = { type: string; x: number; y: number };

const VIEW_WIDTH = 543;
const VIEW_HEIGHT = 900;

/** The least of an element the gate and the press read, with a box in the viewport and a record of what was dispatched on it. */
class FakeElement {
  readonly nodeType = 1;
  readonly shadowRoot = null;
  readonly id = "";
  readonly presses: Press[] = [];
  parentNode: FakeElement | null = null;

  constructor(readonly page: FakePage, readonly tag: string, readonly className: string, readonly box: Box) {}

  get ownerDocument(): FakePage["document"] {
    return this.page.document;
  }
  get tagName(): string {
    return this.tag.toUpperCase();
  }
  get parentElement(): FakeElement | null {
    return this.parentNode;
  }
  get isConnected(): boolean {
    return true;
  }
  getRootNode(): FakePage["document"] {
    return this.page.document;
  }
  getAttribute(): string | null {
    return null;
  }
  hasAttribute(): boolean {
    return false;
  }
  matches(): boolean {
    return false;
  }
  closest(): null {
    return null;
  }
  getBoundingClientRect(): DOMRect {
    const { left, top, width, height } = this.box;
    return { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height } as DOMRect;
  }
  holds(x: number, y: number): boolean {
    const { left, top, width, height } = this.box;
    return x >= left && x < left + width && y >= top && y < top + height;
  }
  scrollIntoView(): void {}
  focus(): void {}
  dispatchEvent(event: Event & { clientX?: number; clientY?: number }): boolean {
    this.presses.push({ type: event.type, x: event.clientX ?? Number.NaN, y: event.clientY ?? Number.NaN });
    return true;
  }
}

/** A viewport whose hit test answers the topmost painted element holding the point, topmost listed first, and the line itself where none does. */
class FakePage {
  readonly painted: FakeElement[] = [];
  readonly hitTests: Array<{ x: number; y: number }> = [];
  readonly view = {
    innerWidth: VIEW_WIDTH,
    innerHeight: VIEW_HEIGHT,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", position: "static" })
  };
  readonly document = {
    defaultView: this.view,
    body: null,
    documentElement: null,
    elementFromPoint: (x: number, y: number): FakeElement | null => {
      this.hitTests.push({ x, y });
      return this.painted.find((element) => element.holds(x, y)) ?? null;
    }
  };
}

/** The cart line: the price paragraph over the "Save for later" link inside it, the price box ending at `priceBottom`. */
function cartLine(priceBottom: number): { page: FakePage; link: FakeElement; price: FakeElement } {
  const page = new FakePage();
  const line = new FakeElement(page, "div", "cart-line", { left: 100, top: 300, width: 300, height: 200 });
  const price = new FakeElement(page, "p", "css-1y6w9q1", { left: 150, top: 300, width: 110, height: priceBottom - 300 });
  const link = new FakeElement(page, "a", "save-for-later", { left: 180, top: 440, width: 80, height: 22 });
  price.parentNode = line;
  link.parentNode = line;
  page.painted.push(price, link, line);
  return { page, link, price };
}

/** Node has `Event` but no `MouseEvent`; the press builds one per step, and these rows read its coordinates. */
function withMouseEvent<T>(run: () => T): T {
  const globals = globalThis as Record<string, unknown>;
  const saved = globals.MouseEvent;
  globals.MouseEvent = class extends Event {
    readonly clientX: number;
    readonly clientY: number;
    constructor(type: string, init: { clientX?: number; clientY?: number } = {}) {
      super(type);
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
    }
  };
  try {
    return run();
  } finally {
    if (saved === undefined) delete globals.MouseEvent;
    else globals.MouseEvent = saved;
  }
}

test("a target whose centre another box overlaps is accepted at a point inside it that hits it, and pressed there", () => {
  const { page, link } = cartLine(452);
  const report = checkActionability(link as unknown as Element);
  assert.equal(report.actionable, true, report.detail);
  assert.ok(report.actionable);
  assert.notDeepEqual(report.point, { x: 220, y: 451 });
  assert.equal(page.document.elementFromPoint(report.point.x, report.point.y), link);
  assert.match(report.detail, /^the point \d+,\d+ landed on the target; its centre 220,451 landed on p\.css-1y6w9q1/u);

  withMouseEvent(() => dispatchClickGesture(link as unknown as Element, report.point));
  const click = link.presses.find((press) => press.type === "click");
  assert.deepEqual(click, { type: "click", x: report.point.x, y: report.point.y });
  for (const press of link.presses) assert.deepEqual({ x: press.x, y: press.y }, report.point, `${press.type} was dispatched elsewhere`);
});

test("a target no probed point reaches is still refused as covered, naming what covers its centre", () => {
  const { page, link } = cartLine(470);
  const report = checkActionability(link as unknown as Element);
  assert.equal(report.actionable, false);
  assert.ok(!report.actionable);
  assert.equal(report.code, "covered");
  assert.deepEqual(report.point, { x: 220, y: 451 });
  assert.match(report.detail, /^the point 220,451 landed on p\.css-1y6w9q1, which covers the target/u);
  // More than the centre was asked before refusing, all of it inside the target.
  const distinct = new Set(page.hitTests.map((point) => `${point.x},${point.y}`));
  assert.ok(distinct.size > 1, `only ${[...distinct].join(" ")} was hit-tested`);
  for (const point of page.hitTests) assert.ok(link.holds(point.x, point.y), `probe ${point.x},${point.y} lies outside the target`);
});

test("a target whose centre hits it is accepted at the centre, with the same words as before", () => {
  const { page, link } = cartLine(420);
  const report = checkActionability(link as unknown as Element);
  assert.ok(report.actionable);
  assert.deepEqual(report.point, { x: 220, y: 451 });
  assert.equal(report.detail, "the point 220,451 landed on the target");
  assert.equal(page.hitTests.length, 1);
});
