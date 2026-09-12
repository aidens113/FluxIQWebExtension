// T1 coverage of the snapshot diff: which descriptors are reported as changed
// between two captures of the same frame, and which as recently interacted
// with.
//
// The rule is deliberately off the DOM -- it reads the descriptor, which is what
// a consumer compares -- so it can be exercised here without a browser. The
// elements are only identities: `markElementActivity` never touches them, it
// only asks whether the recency ledger holds them, so a plain object standing
// in for one proves exactly what the content script does.

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { forgetElementActivity, markElementActivity, type SnapshotElementEntry } from "../changes";
import type { DomElementDescriptor } from "../../types";

let nextElement = 0;

function entry(descriptor: Partial<DomElementDescriptor> & { xpath: string }): SnapshotElementEntry {
  nextElement += 1;
  return {
    element: { id: `element-${nextElement}` } as unknown as Element,
    descriptor: { tagName: "button", selector: `#${descriptor.xpath}`, ...descriptor }
  };
}

beforeEach(() => {
  forgetElementActivity();
});

test("the first capture of a frame marks nothing: there is nothing to have changed from", () => {
  const first = entry({ xpath: "/html/body/button", text: "Save" });
  const counts = markElementActivity([first], new Set());
  assert.deepEqual(counts, { changed: 0, recentlyInteracted: 0 });
  assert.equal(first.descriptor.changed, undefined);
  assert.equal(first.descriptor.recentlyInteracted, undefined);
});

test("an identical descriptor on the next capture is not a change", () => {
  markElementActivity([entry({ xpath: "/html/body/button", text: "Save" })], new Set());
  const second = entry({ xpath: "/html/body/button", text: "Save" });
  assert.deepEqual(markElementActivity([second], new Set()), { changed: 0, recentlyInteracted: 0 });
  assert.equal(second.descriptor.changed, undefined);
});

test("text, value presence, classes, state attributes and position each count as a change", () => {
  const base: Partial<DomElementDescriptor> & { xpath: string } = {
    xpath: "/html/body/button",
    text: "Save",
    hasValue: false,
    classNames: ["btn"],
    attributes: { disabled: "" },
    documentBounds: { x: 10, y: 20, width: 80, height: 30 }
  };
  const drifts: Array<[string, Partial<DomElementDescriptor>]> = [
    ["text", { text: "Saved" }],
    ["value presence", { hasValue: true }],
    ["classes", { classNames: ["btn", "btn-busy"] }],
    ["state attributes", { attributes: {} }],
    ["position", { documentBounds: { x: 10, y: 220, width: 80, height: 30 } }]
  ];
  for (const [what, drift] of drifts) {
    forgetElementActivity();
    markElementActivity([entry({ ...base })], new Set());
    const after = entry({ ...base, ...drift, xpath: base.xpath });
    assert.deepEqual(markElementActivity([after], new Set()), { changed: 1, recentlyInteracted: 0 }, what);
    assert.equal(after.descriptor.changed, true, what);
  }
});

test("sub-pixel layout noise is not a change", () => {
  const bounds = { x: 10.4, y: 20.2, width: 80.1, height: 30.4 };
  markElementActivity([entry({ xpath: "/html/body/button", documentBounds: bounds })], new Set());
  const after = entry({ xpath: "/html/body/button", documentBounds: { x: 10.3, y: 19.8, width: 80.4, height: 29.6 } });
  assert.deepEqual(markElementActivity([after], new Set()), { changed: 0, recentlyInteracted: 0 });
});

test("two fields cannot run together into a third value", () => {
  // "Save" + no classes must not fingerprint the same as no text + class "Save".
  markElementActivity([entry({ xpath: "/html/body/button", text: "Save" })], new Set());
  const after = entry({ xpath: "/html/body/button", classNames: ["Save"] });
  assert.deepEqual(markElementActivity([after], new Set()), { changed: 1, recentlyInteracted: 0 });
});

test("an element absent from the previous capture is reported as changed", () => {
  markElementActivity([entry({ xpath: "/html/body/button" })], new Set());
  const appeared = entry({ xpath: "/html/body/div/p", text: "Saved" });
  assert.deepEqual(markElementActivity([appeared], new Set()), { changed: 1, recentlyInteracted: 0 });
  assert.equal(appeared.descriptor.changed, true);
});

test("recency is membership of the ledger, and is reported whether or not the element changed", () => {
  const touched = entry({ xpath: "/html/body/button", text: "Save" });
  const untouched = entry({ xpath: "/html/body/a", text: "Home" });
  const counts = markElementActivity([touched, untouched], new Set([touched.element]));
  assert.deepEqual(counts, { changed: 0, recentlyInteracted: 1 });
  assert.equal(touched.descriptor.recentlyInteracted, true);
  assert.equal(untouched.descriptor.recentlyInteracted, undefined);
});

test("descriptors sharing one key are left undiffed rather than reported as changing for ever", () => {
  // Two rows of a list with no xpath fall back to the same selector. Only one
  // fingerprint can be held under a key, so whichever row lost would read as
  // changed on every capture from then on; neither is diffed instead.
  const rows = (): SnapshotElementEntry[] => [
    { element: {} as unknown as Element, descriptor: { tagName: "li", selector: "[data-testid='row']", text: "One" } },
    { element: {} as unknown as Element, descriptor: { tagName: "li", selector: "[data-testid='row']", text: "Two" } }
  ];
  markElementActivity(rows(), new Set());
  const second = rows();
  assert.deepEqual(markElementActivity(second, new Set()), { changed: 0, recentlyInteracted: 0 });
  for (const row of second) assert.equal(row.descriptor.changed, undefined);
});
