// Whether a press answered a layer that stood in front of the page and was
// gone after it (t174, case (2) of the t174-w60 absent-step-routing report),
// from two hand-built packets. Such a step is the Flow's answer to an
// interruption: a playback that meets no such layer has nothing to answer.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webAnsweredLayer } from "../answered-layer";

const PAGE: FixtureElement[] = [
  { tag: "h1", target: "t10", text: "Kettles", box: { x: 10, y: 600, width: 200, height: 20 } },
  { tag: "button", target: "t11", text: "Confirm", box: { x: 10, y: 640, width: 200, height: 20 } }
];
const CONSENT: FixtureElement[] = [
  { tag: "div", target: "t1", text: "We value your privacy", isDialog: { modal: true, kind: "consent" } },
  { tag: "button", target: "t2", text: "Decline optional cookies", inDialog: "t1" },
  { tag: "button", target: "t3", text: "Manage options", inDialog: "t1" }
];
const CHAT: FixtureElement[] = [
  { tag: "div", target: "t5", text: "Chat with us", kind: "assistant", frontLayer: true, covers: ["t11"], box: { x: 0, y: 0, width: 400, height: 400 } },
  { tag: "button", target: "t6", text: "Close chat", box: { x: 10, y: 10, width: 40, height: 20 } }
];

function page(elements: readonly FixtureElement[], location?: string): WebLlmPageEvidence {
  return fixturePacket(elements, location === undefined ? {} : { location });
}

test("a press of Decline optional cookies inside a consent dialog that is gone after answered a layer", () => {
  assert.equal(webAnsweredLayer(page([...CONSENT, ...PAGE]), page(PAGE), "t2"), true);
});

test("a press of the main page's Confirm answered no layer", () => {
  assert.equal(webAnsweredLayer(page(PAGE), page([...PAGE, { tag: "span", target: "t12", text: "Saved" }]), "t11"), false);
  // Nor when a dialog stood beside it and went: the press was not in it.
  assert.equal(webAnsweredLayer(page([...CONSENT, ...PAGE]), page(PAGE), "t11"), false);
});

test("a press inside a consent dialog that stays open answered no layer", () => {
  const after = page([...CONSENT, { tag: "div", target: "t4", text: "Purposes", inDialog: "t1" }, ...PAGE]);
  assert.equal(webAnsweredLayer(page([...CONSENT, ...PAGE]), after, "t3"), false);
});

test("a press of Close chat inside a covering front layer that is gone after answered a layer", () => {
  assert.equal(webAnsweredLayer(page([...CHAT, ...PAGE]), page(PAGE), "t6"), true);
  // Its layer still described but no longer in front of the page counts as gone.
  const unmarked: FixtureElement[] = [{ ...CHAT[0]!, kind: undefined, frontLayer: undefined, covers: undefined }, ...PAGE];
  assert.equal(webAnsweredLayer(page([...CHAT, ...PAGE]), page(unmarked), "t6"), true);
});

test("nothing is said without both pages, a handle, or on a page that moved elsewhere", () => {
  const before = page([...CONSENT, ...PAGE]);
  assert.equal(webAnsweredLayer(undefined, page(PAGE), "t2"), false);
  assert.equal(webAnsweredLayer(before, undefined, "t2"), false);
  assert.equal(webAnsweredLayer(before, page(PAGE), undefined), false);
  assert.equal(webAnsweredLayer(before, page(PAGE, "https://shop.test/cart"), "t2"), false);
});

// t193, C17 (`run-musp4h2f-72e8ed99`): a layer the build opened itself is a
// step of the Flow, not an interruption. Which layers it opened is handed in.
const CHOOSER: FixtureElement[] = [
  { tag: "div", target: "t20", text: "Stores near Carden Falls", frontLayer: true, box: { x: 0, y: 0, width: 400, height: 300 } },
  { tag: "button", target: "t21", text: "Set as my store", parent: "t20", box: { x: 10, y: 100, width: 100, height: 20 } }
];

test("a press inside a layer this build opened, which closed it, answered no layer", () => {
  const own = (layer: string): boolean => layer === "t20";
  assert.equal(webAnsweredLayer(page([...CHOOSER, ...PAGE]), page(PAGE), "t21", own), false);
  // Not knowing the build opened it, the same press reads as an interruption.
  assert.equal(webAnsweredLayer(page([...CHOOSER, ...PAGE]), page(PAGE), "t21"), true);
});

test("a consent wall the build did not open, answered, is still an interruption whatever else the build opened", () => {
  const own = (layer: string): boolean => layer === "t20";
  assert.equal(webAnsweredLayer(page([...CONSENT, ...PAGE]), page(PAGE), "t2", own), true);
});
