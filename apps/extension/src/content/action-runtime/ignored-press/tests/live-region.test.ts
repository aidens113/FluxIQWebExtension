// T1 coverage of the notice-region rule (`live-region.ts`, t743): which
// elements are the page's own notice regions, read from roles and `aria-live`
// only, never from words.

import assert from "node:assert/strict";
import test from "node:test";
import { isLiveRegion } from "../live-region";

/** An element with the attributes given, and nothing else. */
function element(attributes: Record<string, string>, tagName = "DIV"): Element {
  return { tagName, getAttribute: (name: string) => attributes[name] ?? null } as unknown as Element;
}

test("an alert or a status region is a notice region, and so is an assertive live region", () => {
  assert.equal(isLiveRegion(element({ role: "alert" })), true);
  assert.equal(isLiveRegion(element({ role: " Status " })), true);
  assert.equal(isLiveRegion(element({ "aria-live": "assertive" })), true);
});

test("the first role token decides, as a reader takes it", () => {
  assert.equal(isLiveRegion(element({ role: "status button" })), true);
  assert.equal(isLiveRegion(element({ role: "button status" })), false);
});

test("a polite or switched-off live region, an output with no role, and anything else are not notice regions", () => {
  assert.equal(isLiveRegion(element({ "aria-live": "polite" })), false, "content that updates itself, such as a results list");
  assert.equal(isLiveRegion(element({ "aria-live": "off" })), false);
  assert.equal(isLiveRegion(element({}, "OUTPUT")), false, "a computed result is the act, not a notice about it");
  assert.equal(isLiveRegion(element({ role: "log" })), false);
  assert.equal(isLiveRegion(element({ role: "button" })), false);
});

test("something that is not an element is not a notice region", () => {
  assert.equal(isLiveRegion(undefined), false);
  assert.equal(isLiveRegion(null), false);
  assert.equal(isLiveRegion({ nodeType: 3, textContent: "words" }), false);
});
