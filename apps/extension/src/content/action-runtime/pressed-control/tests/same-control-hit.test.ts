// When a point that missed a target still reaches the control the target is
// part of (`../same-control-hit.ts`), and what the actionability gate does with
// it (`../../actionability.ts`).
//
// The geometry is photo-social's profile grid cell as the live run met it
// (`run-mvdi88yz-e444d594`, t756): a 310 px square link whose picture fills it,
// and over the picture, inside the same link, the cell's like and comment
// counts as an `inset: 0` list. Every point of the picture lands on that list.

import assert from "node:assert/strict";
import test from "node:test";
import { checkActionability } from "../../actionability";
import { sameControlHit } from "../same-control-hit";

type Box = { left: number; top: number; width: number; height: number };

/** The least of an element the predicate and the gate read; `control` says whether it matches the pressable-host selector. */
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
  /** The gate asks `:disabled` and `[inert]`; the predicate asks the pressable-host selector. */
  matches(selector: string): boolean {
    return selector.includes("a[href]") && this.control;
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
  within(parent: FakeElement): this {
    this.parentNode = parent;
    return this;
  }
}

/** A viewport whose hit test answers the topmost painted element holding the point, topmost listed first. */
class FakePage {
  readonly painted: FakeElement[] = [];
  readonly view = {
    innerWidth: 1280,
    innerHeight: 720,
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1", position: "static" })
  };
  readonly document = {
    defaultView: this.view,
    body: null,
    documentElement: null,
    elementFromPoint: (x: number, y: number): FakeElement | null => this.painted.find((element) => element.holds(x, y)) ?? null
  };
}

const CELL: Box = { left: 286, top: 205, width: 310, height: 310 };

/** The grid cell: link > picture, and over the picture, inside the link, the counts list; `nestedButton` adds a control of its own inside the list. */
function gridCell(options: { nestedButton?: boolean; dialogOver?: boolean } = {}) {
  const page = new FakePage();
  const grid = new FakeElement(page, "div", "grid", { left: 286, top: 0, width: 940, height: 2000 });
  const link = new FakeElement(page, "a", "cell", CELL, true).within(grid);
  const picture = new FakeElement(page, "img", "cell-img", CELL).within(link);
  const counts = new FakeElement(page, "ul", "xodf1f4", CELL).within(link);
  const button = options.nestedButton ? new FakeElement(page, "div", "quick-like", CELL, true).within(counts) : undefined;
  const dialog = options.dialogOver ? new FakeElement(page, "div", "consent", { left: 0, top: 0, width: 1280, height: 720 }) : undefined;
  page.painted.push(...[dialog, button, counts, picture, link, grid].filter((element): element is FakeElement => element !== undefined));
  return { page, link, picture, counts, button, dialog };
}

const asElement = (element: FakeElement): Element => element as unknown as Element;

test("a hit on the cell's own overlay, inside the link the picture is in, reaches that link", () => {
  const { link, picture, counts } = gridCell();
  assert.equal(sameControlHit(asElement(picture), asElement(counts)), link);
});

test("a hit on a control nested in the link is a different press, and is no reach", () => {
  const { picture, button } = gridCell({ nestedButton: true });
  assert.equal(sameControlHit(asElement(picture), asElement(button!)), undefined);
});

test("a hit outside the link -- a dialog over the page -- is no reach", () => {
  const { picture, dialog } = gridCell({ dialogOver: true });
  assert.equal(sameControlHit(asElement(picture), asElement(dialog!)), undefined);
});

test("a target that is itself the control is never reached through another element", () => {
  const { link, counts } = gridCell();
  assert.equal(sameControlHit(asElement(link), asElement(counts)), undefined);
});

test("the gate accepts the picture at its centre through its cell's overlay, naming the link the press reaches", () => {
  const { picture } = gridCell();
  const report = checkActionability(asElement(picture));
  assert.ok(report.actionable, report.detail);
  assert.deepEqual(report.point, { x: 441, y: 360 });
  assert.equal(report.detail, "the point 441,360 landed on ul.xodf1f4, part of a.cell, the control the target is in, so a press there reaches the same control");
});

test("the gate still refuses the picture as covered when a control nested in the link, or a dialog, is what every point lands on", () => {
  for (const options of [{ nestedButton: true }, { dialogOver: true }]) {
    const { picture } = gridCell(options);
    const report = checkActionability(asElement(picture));
    assert.equal(report.actionable, false, JSON.stringify(options));
    assert.ok(!report.actionable);
    assert.equal(report.code, "covered");
    assert.match(report.detail, /^the point 441,360 landed on div\.(?:quick-like|consent), which covers the target/u);
  }
});
