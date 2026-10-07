// What a call changed, in the page view's line terms (t174/F37), from two
// hand-built packets: which entries, in what order, how many, and where none
// is said at all.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webNodePageChangeStatement, webPageChangeWalk } from "../change";
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

// t285 (week report W1): the same walk states to Core, on the draft statement,
// what a press changed -- so Core reads which step did an act from what it did
// (the cart count rose, "Added to cart" appeared) and not from the model's
// label. Run `run-muqiho5c-e830ce01` named its add-to-cart act on "Not now".
const CART_BEFORE: FixtureElement[] = [
  { tag: "button", target: "t1", text: "Cart (2)" },
  { tag: "span", target: "t2", text: "Only 3 left" },
  { tag: "div", target: "t3", text: "Space Grey", cursor: "pointer", marked: true },
  { tag: "span", target: "t4", text: "1 item" },
  { tag: "span", target: "t5", text: "Ships Monday" },
  { tag: "span", target: "t8", text: "Unchanged" }
];
const CART_AFTER: FixtureElement[] = [
  { tag: "button", target: "t1", text: "Cart (3)" },
  { tag: "div", target: "t3", text: "Space Grey", cursor: "pointer" },
  { tag: "span", target: "t4", text: "2 items" },
  { tag: "span", target: "t5", text: "Ships Tuesday" },
  { tag: "span", target: "t6", text: "Added to cart" },
  { tag: "span", target: "t8", text: "Unchanged" }
];

test("one walk yields every changed line in page order, whatever kind it is", () => {
  const walked = webPageChangeWalk(CLICK, bound(CART_BEFORE), bound(CART_AFTER))!;
  assert.deepEqual(walked.map((change) => change.kind === "both" ? [change.kind, change.now.handle] : [change.kind, change.line.handle]), [
    ["both", "t1"], ["went", "t2"], ["both", "t3"], ["both", "t4"], ["both", "t5"], ["appeared", "t6"]
  ]);
});

test("the outcome and the statement are read from that one walk: the outcome as before, the statement in Core's terms", () => {
  assert.deepEqual(webNodePageChanges(CLICK, bound(CART_BEFORE), bound(CART_AFTER)), [
    "t2 \"Only 3 left\" gone",
    "t3 \"Space Grey\" no longer marked",
    "t4 \"2 items\" was \"1 item\"",
    "t5 \"Ships Tuesday\" was \"Ships Monday\"",
    "t6 \"Added to cart\" appeared"
  ]);
  // A control's words count here: the cart button rose. A state change never does.
  assert.deepEqual(webNodePageChangeStatement(CLICK, bound(CART_BEFORE), bound(CART_AFTER)), [
    { words: "Cart (3)", how: "rose" },
    { words: "Only 3 left", how: "went" },
    { words: "2 items", how: "rose" },
    { words: "Ships Tuesday", how: "reads" },
    { words: "Added to cart", how: "appeared" }
  ]);
});

test("rose only when the words differ in one number and it went up; otherwise the line reads otherwise", () => {
  const rose: Array<[string, string]> = [["Cart (2)", "Cart (3)"], ["1 item", "2 items"], ["Subtotal $1,299.00", "Subtotal $1,349.50"], ["Qty 9", "Qty 10"]];
  const reads: Array<[string, string]> = [["Cart (3)", "Cart (2)"], ["2 of 5", "3 of 6"], ["Cart", "Cart (1)"], ["Qty 2 in cart", "Qty 3 in bag"], ["Cart (2)", "Cart (2) ready"]];
  for (const [was, now] of [...rose, ...reads]) {
    const statement = webNodePageChangeStatement(TYPE, bound([{ tag: "span", target: "t1", text: was }]), bound([{ tag: "span", target: "t1", text: now }]));
    assert.deepEqual(statement, [{ words: now, how: rose.some(([a, b]) => a === was && b === now) ? "rose" : "reads" }], `${was} -> ${now}`);
  }
});

test("a line with no words, a state change alone, or a control that appeared or went is never stated", () => {
  const before = bound([
    { tag: "input", target: "t1", inputType: "checkbox", name: "Gift wrap", checked: false },
    { tag: "button", target: "t2", text: "Open" },
    { tag: "div", target: "t4", cursor: "pointer" }
  ]);
  const after = bound([
    { tag: "input", target: "t1", inputType: "checkbox", name: "Gift wrap", checked: true },
    { tag: "button", target: "t3", text: "Close" },
    { tag: "div", target: "t4", cursor: "pointer", marked: true }
  ]);
  assert.equal(webNodePageChangeStatement(CLICK, before, after), undefined);
});

test("the statement quotes the outcome's cut words, holds sixteen lines past the outcome's eight, and the outcome is unchanged", () => {
  const before = bound([{ tag: "span", target: "t1", text: "Top" }]);
  const appeared: FixtureElement[] = Array.from({ length: 20 }, (_, index) => ({ tag: "span", target: `t${index + 2}`, text: `Notice ${index + 2} ${"word ".repeat(60)}` }));
  const after = bound([{ tag: "span", target: "t1", text: "Top" }, ...appeared]);
  const outcome = webNodePageChanges(CLICK, before, after)!;
  const statement = webNodePageChangeStatement(CLICK, before, after)!;
  assert.equal(outcome.length, 9);
  assert.equal(outcome[8], "and 12 more changes");
  assert.equal(statement.length, 16);
  assert.deepEqual(statement.map((line) => line.how), Array.from({ length: 16 }, () => "appeared"));
  for (const [index, entry] of outcome.slice(0, 8).entries()) assert.equal(entry, `t${index + 2} "${statement[index]!.words}" appeared`);
  assert.match(statement[0]!.words, /…$/u);
});

test("a moved page, a missing page, or a node that does not change the page in place states nothing", () => {
  const before = bound(CART_BEFORE);
  const after = bound(CART_AFTER);
  assert.ok(webNodePageChangeStatement(CLICK, before, after) !== undefined);
  assert.equal(webNodePageChangeStatement(CLICK, before, bound(CART_AFTER, { location: "https://shop.test/cart" })), undefined);
  assert.equal(webPageChangeWalk(CLICK, before, bound(CART_AFTER, { location: "https://shop.test/cart" })), undefined);
  assert.equal(webNodePageChangeStatement(CLICK, undefined, after), undefined);
  assert.equal(webNodePageChangeStatement(CLICK, before, undefined), undefined);
  assert.equal(webNodePageChangeStatement(NAVIGATE, before, after), undefined);
  assert.equal(webNodePageChangeStatement(EXTRACT, before, after), undefined);
  assert.equal(webNodePageChangeStatement(CLICK, before, bound(CART_BEFORE)), undefined);
});
