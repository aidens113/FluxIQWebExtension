// Where a press is aimed above humanness 0 (`../aim-press.ts`, through the
// gate's `aimWithinTarget` in `../../actionability.ts`). The safety lines:
// a drawn point is used only for a target the gate accepted at its centre, only
// inside the target's visible box, only where the gate's own hit test lands on
// the target, and only on the same control as the centre's hit. Anything else
// leaves the gate's own point -- today's -- in use.

import assert from "node:assert/strict";
import test from "node:test";
import { aimWithinTarget, checkActionability, type ActionabilityReport } from "../../actionability";
import { aimPress } from "../aim-press";
import { commandHumanness, type CommandHumanness } from "../command-humanness";

type Box = { left: number; top: number; width: number; height: number };
type Actionable = Extract<ActionabilityReport, { actionable: true }>;

/** The least of an element the gate reads: a box in the viewport, a parent, and whether it is a control a press goes to. */
class FakeElement {
  readonly nodeType = 1;
  readonly shadowRoot = null;
  readonly id = "";
  parentNode: FakeElement | null = null;

  constructor(readonly page: FakePage, readonly tag: string, readonly className: string, readonly box: Box, readonly control = false) {}

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
  /** Only the control selectors (`PRESSABLE_HOST`, which leads with `button,`) match, and only a control. */
  matches(selector: string): boolean {
    return this.control && selector.includes("button,");
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
}

/** A viewport whose hit test answers the topmost painted element holding the point, topmost listed first. */
class FakePage {
  readonly painted: FakeElement[] = [];
  readonly hitTests: Array<{ x: number; y: number }> = [];
  readonly view = {
    innerWidth: 1000,
    innerHeight: 800,
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

  add(element: FakeElement, parent?: FakeElement): FakeElement {
    element.parentNode = parent ?? null;
    return element;
  }
}

/** A 120 by 40 "Add to cart" button at 100,200 with its words in a span at its middle; `sticker` paints a badge over its right end. */
function cartButton(sticker = false): { page: FakePage; button: FakeElement; words: FakeElement; badge: FakeElement | undefined } {
  const page = new FakePage();
  const card = page.add(new FakeElement(page, "div", "card", { left: 0, top: 0, width: 1000, height: 800 }));
  const button = page.add(new FakeElement(page, "button", "add-to-cart", { left: 100, top: 200, width: 120, height: 40 }, true), card);
  const words = page.add(new FakeElement(page, "span", "label", { left: 130, top: 212, width: 60, height: 16 }), button);
  const badge = sticker ? page.add(new FakeElement(page, "div", "promo-badge", { left: 170, top: 200, width: 50, height: 40 }), card) : undefined;
  page.painted.push(...(badge ? [badge] : []), words, button, card);
  return { page, button, words, badge };
}

function human(level: number, commandId: string): CommandHumanness {
  const found = commandHumanness({ commandId, humanness: level });
  assert.ok(found);
  return found;
}

function gateFor(element: FakeElement): Actionable {
  const report = checkActionability(element as unknown as Element);
  assert.ok(report.actionable, report.actionable ? "" : report.detail);
  return report;
}

test("at level 80 a press accepted at the centre is aimed near it, inside the visible box and on the target", () => {
  const { page, button } = cartButton();
  const gate = gateFor(button);
  assert.deepEqual(gate.point, { x: 160, y: 220 });
  let moved = 0;
  for (let index = 0; index < 300; index += 1) {
    const aimed = aimPress(button as unknown as Element, gate, human(80, `cmd-${index}`));
    assert.ok(aimed, "a point on the same button is always accepted");
    const { x, y } = aimed.point;
    assert.ok(x > 100 && x < 220 && y > 200 && y < 240, `${x},${y} lies outside the button's box`);
    const hit = page.document.elementFromPoint(x, y);
    assert.ok(hit === button || hit?.parentNode === button, `${x},${y} landed on ${hit?.className}`);
    assert.match(aimed.detail, /^the point \d+,\d+ landed on (the target|span\.label, inside the target)$/u);
    if (x !== gate.point.x || y !== gate.point.y) moved += 1;
  }
  assert.ok(moved > 250, `only ${moved} of 300 presses moved off the centre`);
});

test("the same command id aims at the same point", () => {
  const { button } = cartButton();
  const gate = gateFor(button);
  assert.deepEqual(aimPress(button as unknown as Element, gate, human(80, "cmd-same")), aimPress(button as unknown as Element, gate, human(80, "cmd-same")));
});

test("a drawn point another element covers is not used: the centre stands", () => {
  const { button, badge } = cartButton(true);
  assert.ok(badge);
  const gate = gateFor(button);
  assert.deepEqual(gate.point, { x: 160, y: 220 });
  assert.equal(aimWithinTarget(button as unknown as Element, gate, () => ({ x: 190, y: 220 })), undefined);
  // Drawn at random too: a point that is used never lies on the badge.
  let kept = 0;
  for (let index = 0; index < 300; index += 1) {
    const aimed = aimPress(button as unknown as Element, gate, human(100, `cmd-${index}`));
    if (!aimed) kept += 1;
    else assert.equal(badge.holds(aimed.point.x, aimed.point.y), false, `${aimed.point.x},${aimed.point.y} is under the badge`);
  }
  assert.ok(kept > 0, "no draw reached the badge, so the fallback went untested");
});

test("a drawn point on a different control inside the target is not used, nor one on the box's edge or outside it", () => {
  const page = new FakePage();
  const row = page.add(new FakeElement(page, "div", "cart-row", { left: 100, top: 100, width: 400, height: 60 }));
  const title = page.add(new FakeElement(page, "span", "title", { left: 250, top: 120, width: 100, height: 20 }), row);
  const remove = page.add(new FakeElement(page, "button", "remove", { left: 440, top: 110, width: 50, height: 40 }, true), row);
  page.painted.push(remove, title, row);
  const gate = gateFor(row);
  assert.deepEqual(gate.point, { x: 300, y: 130 });
  const target = row as unknown as Element;
  assert.equal(aimWithinTarget(target, gate, () => ({ x: 460, y: 130 })), undefined, "the row's Remove button is a different press");
  assert.equal(aimWithinTarget(target, gate, () => ({ x: 100, y: 130 })), undefined, "a point on the box's edge");
  assert.equal(aimWithinTarget(target, gate, () => ({ x: 300, y: 170 })), undefined, "a point below the box");
  assert.deepEqual(aimWithinTarget(target, gate, () => ({ x: 280, y: 125 }))?.point, { x: 280, y: 125 }, "a point on the row's own words is used");
});

test("a target accepted at a probed point, not its centre, is never re-aimed", () => {
  const { button } = cartButton();
  const probed: Actionable = { actionable: true, point: { x: 120, y: 205 }, detail: "the point 120,205 landed on the target; its centre 160,220 landed on p.price" };
  let drawn = 0;
  const aimed = aimWithinTarget(button as unknown as Element, probed, (_area, centre) => {
    drawn += 1;
    return centre;
  });
  assert.equal(aimed, undefined);
  assert.equal(drawn, 0, "no point is drawn for a target the gate did not accept at its centre");
});

test("the box a point is drawn in is the target's visible part, not the part off-screen", () => {
  const page = new FakePage();
  const banner = page.add(new FakeElement(page, "a", "banner", { left: -200, top: 700, width: 600, height: 300 }, true));
  page.painted.push(banner);
  const gate = gateFor(banner);
  assert.deepEqual(gate.point, { x: 200, y: 750 });
  let box: { left: number; top: number; right: number; bottom: number } | undefined;
  aimWithinTarget(banner as unknown as Element, gate, (area, centre) => {
    box = area;
    return centre;
  });
  assert.deepEqual(box, { left: 0, top: 700, right: 400, bottom: 800 });
});
