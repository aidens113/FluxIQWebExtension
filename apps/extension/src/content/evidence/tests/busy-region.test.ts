// T1 coverage of the busy-region rule (`busy-region.ts`, with `painted.ts`):
// the one rule the snapshot's loading evidence and the in-place effect watch
// both ask, moved out of `loading.ts` so the two cannot drift (t733). A region
// is busy only when it says `aria-busy="true"` and is painted, so a flag left
// on a hidden or empty container is not read as the page loading.
//
// The unit tests run in Node, so each element is a stand-in that answers the
// few questions the rule asks: its attributes, its parent, its computed style
// and its box.

import assert from "node:assert/strict";
import { test } from "node:test";
import { isBusyRegion } from "../busy-region";

type Style = { display: string; visibility: string; opacity: string };

class FakeElement {
  readonly nodeType = 1;
  parentNode: FakeElement | null = null;
  style: Style = { display: "block", visibility: "visible", opacity: "1" };
  box = { width: 300, height: 120 };
  constructor(readonly attributes: Record<string, string> = {}) {}
  get parentElement(): FakeElement | null {
    return this.parentNode;
  }
  /** Attribute selectors only -- `[name]` and `[name='value']`, comma-separated -- which is all the rule asks. */
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      const match = /^\[([\w-]+)(?:='([^']*)')?\]$/u.exec(part.trim());
      if (!match) return false;
      const value = this.attributes[match[1]!];
      return value !== undefined && (match[2] === undefined || value === match[2]);
    });
  }
  getBoundingClientRect(): { width: number; height: number } {
    return this.box;
  }
}

function within(parent: FakeElement, child: FakeElement): FakeElement {
  child.parentNode = parent;
  return child;
}

/**
 * Asks the rule with `getComputedStyle` answering from the fake, putting the
 * global back after: a top-level hook would run before every test of every
 * file bundled into the same run.
 */
function busy(element: FakeElement): boolean {
  const globals = globalThis as { getComputedStyle?: unknown };
  const previous = Object.getOwnPropertyDescriptor(globals, "getComputedStyle");
  globals.getComputedStyle = (fake: FakeElement) => fake.style;
  try {
    return isBusyRegion(element as unknown as Element);
  } finally {
    if (previous) Object.defineProperty(globals, "getComputedStyle", previous);
    else delete globals.getComputedStyle;
  }
}

test("a painted region marked aria-busy=true is busy", () => {
  assert.equal(busy(new FakeElement({ "aria-busy": "true" })), true);
});

test("aria-busy=false, or no flag at all, is not busy", () => {
  assert.equal(busy(new FakeElement({ "aria-busy": "false" })), false);
  assert.equal(busy(new FakeElement()), false);
});

test("a busy flag inside a hidden or aria-hidden ancestor is not busy", () => {
  assert.equal(busy(within(new FakeElement({ hidden: "" }), new FakeElement({ "aria-busy": "true" }))), false);
  assert.equal(busy(within(new FakeElement({ "aria-hidden": "true" }), new FakeElement({ "aria-busy": "true" }))), false);
});

test("a busy region not displayed, invisible, transparent or without a box is not busy", () => {
  const cases: Array<(element: FakeElement) => void> = [
    (element) => (element.style = { ...element.style, display: "none" }),
    (element) => (element.style = { ...element.style, visibility: "hidden" }),
    (element) => (element.style = { ...element.style, opacity: "0" }),
    (element) => (element.box = { width: 0, height: 0 })
  ];
  for (const unpaint of cases) {
    const element = new FakeElement({ "aria-busy": "true" });
    unpaint(element);
    assert.equal(busy(element), false);
  }
});
