// What a call changed, in the page view's line terms (t174/F37), from two
// hand-built packets: which entries, in what order, how many, and where none
// is said at all.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webNodePageChanges } from "../page-changes";

const CLICK = webRunnableNode("web.output.dom-click")!;
const TYPE = webRunnableNode("web.output.dom-type")!;
const NAVIGATE = webRunnableNode("web.output.browser-navigate")!;
const EXTRACT = webRunnableNode("web.output.dom-extract_list")!;

function bound(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmSnapshotBinding {
  return { evidence: fixturePacket(elements, page), selectors: new Map(), records: new Map(), shadowHosts: new Map() } as WebLlmSnapshotBinding;
}

const SWATCHES: FixtureElement[] = [
  { tag: "span", target: "t1", text: "Color:" },
  { tag: "span", target: "t2", text: "Space Grey" },
  { tag: "div", target: "t3", text: "Space Grey", cursor: "pointer", marked: true },
  { tag: "div", target: "t4", text: "Silver", cursor: "pointer" },
  { tag: "span", target: "t5", text: "186 pieces available" }
];

test("an undone choice: the line that lost its mark and the text that went, in page order", () => {
  const after = bound([SWATCHES[0]!, { ...SWATCHES[2]!, marked: undefined }, SWATCHES[3]!]);
  assert.deepEqual(webNodePageChanges(CLICK, bound(SWATCHES), after), [
    "t2 \"Space Grey\" gone",
    "t3 \"Space Grey\" no longer marked",
    "t5 \"186 pieces available\" gone"
  ]);
});

test("the page's answer: a text line that appeared is named where it stands", () => {
  const before = bound([{ tag: "button", target: "t6", text: "Add to cart" }, { tag: "span", target: "t9", text: "Ships free" }]);
  const after = bound([{ tag: "button", target: "t6", text: "Add to cart" }, { tag: "span", target: "t7", text: "Please select a Color." }, { tag: "span", target: "t9", text: "Ships free" }]);
  assert.deepEqual(webNodePageChanges(CLICK, before, after), ["t7 \"Please select a Color.\" appeared"]);
});

test("a choice made: now marked, and a paired state says only where it now stands", () => {
  const before = bound([
    { tag: "div", target: "t1", text: "7-in-1", cursor: "pointer" },
    { tag: "input", target: "t2", inputType: "checkbox", name: "Gift wrap", checked: false },
    { tag: "button", target: "t3", text: "Buy", attributes: [["disabled", ""]] }
  ]);
  const after = bound([
    { tag: "div", target: "t1", text: "7-in-1", cursor: "pointer", marked: true },
    { tag: "input", target: "t2", inputType: "checkbox", name: "Gift wrap", checked: true },
    { tag: "button", target: "t3", text: "Buy" }
  ]);
  assert.deepEqual(webNodePageChanges(CLICK, before, after), [
    "t1 \"7-in-1\" now marked",
    "t2 \"Gift wrap\" now checked",
    "t3 \"Buy\" no longer disabled"
  ]);
});

test("a text line that reads otherwise says what it was", () => {
  const before = bound([{ tag: "span", target: "t1", text: "Cart (0)" }]);
  const after = bound([{ tag: "span", target: "t1", text: "Cart (1)" }]);
  assert.deepEqual(webNodePageChanges(TYPE, before, after), ["t1 \"Cart (1)\" was \"Cart (0)\""]);
});

test("a control line that appears or goes is not a change said here: only text and states are", () => {
  const before = bound([{ tag: "button", target: "t1", text: "Open" }]);
  const after = bound([{ tag: "button", target: "t2", text: "Close" }]);
  assert.equal(webNodePageChanges(CLICK, before, after), undefined);
});

test("past eight changes the rest are counted, and every entry stays short", () => {
  const before = bound([{ tag: "span", target: "t1", text: "Top" }]);
  const appeared: FixtureElement[] = Array.from({ length: 11 }, (_, index) => ({ tag: "span", target: `t${index + 2}`, text: `Notice ${index + 2} ${"word ".repeat(60)}` }));
  const changed = webNodePageChanges(CLICK, before, bound([{ tag: "span", target: "t1", text: "Top" }, ...appeared]))!;
  assert.equal(changed.length, 9);
  assert.equal(changed[8], "and 3 more changes");
  assert.match(changed[0]!, /^t2 "Notice 2 word word .*…" appeared$/u);
  for (const entry of changed) assert.ok(entry.length <= 125, entry);
});

test("nothing is said where it was not compared, the page moved, or the node does not change a page in place", () => {
  const before = bound(SWATCHES);
  const after = bound(SWATCHES.slice(0, 2));
  assert.ok(webNodePageChanges(CLICK, before, after) !== undefined);
  assert.equal(webNodePageChanges(CLICK, undefined, after), undefined);
  assert.equal(webNodePageChanges(CLICK, before, undefined), undefined);
  assert.equal(webNodePageChanges(CLICK, before, bound(SWATCHES.slice(0, 2), { location: "https://shop.test/cart" })), undefined);
  assert.equal(webNodePageChanges(NAVIGATE, before, after), undefined);
  assert.equal(webNodePageChanges(EXTRACT, before, after), undefined);
  assert.equal(webNodePageChanges(CLICK, before, bound(SWATCHES)), undefined);
});
