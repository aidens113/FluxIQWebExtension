import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { WEB_STATE_DIFF_SCHEMA_VERSION, webAutomationStateDiff, webStateSummaryLines } from "..";

function view(location: string, title: string, lines: string[], base?: string): JsonObject {
  const header = [`PAGE "${title}"`, ...(base === undefined ? [] : [`URL ~/   (~ = ${base})`]), `VIEW · ${lines.length} elements with visible words or a control, in page order · find_on_page searches the rest`];
  return { schemaVersion: "web-llm-page.v3", trust: "untrusted-page-evidence", location, truncated: false, page: [...header, "", ...lines].join("\n") };
}

test("the diff reports the move, the title, the counts, and the lines that came and went, as the view's own words", () => {
  const before = view("https://shop.test/cart", "Cart", ["[main]", "t1 button \"Pay\"", "t2 link \"Edit\" https://shop.test/cart/edit"]);
  const after = view("https://shop.test/thanks", "Thanks", ["[main]", "t1 link \"Edit\" https://shop.test/cart/edit", "t2 link \"Receipt\" https://shop.test/receipt"]);
  assert.deepEqual(webAutomationStateDiff(before, after, "web.state.1@a:before_action", "web.state.2@a:after_action"), {
    schemaVersion: WEB_STATE_DIFF_SCHEMA_VERSION,
    beforeStateRef: "web.state.1@a:before_action",
    afterStateRef: "web.state.2@a:after_action",
    beforeLocation: "https://shop.test/cart",
    afterLocation: "https://shop.test/thanks",
    locationChanged: true,
    documentChanged: true,
    titleChanged: true,
    beforeLineCount: 2,
    afterLineCount: 2,
    addedCount: 1,
    removedCount: 1,
    added: "link \"Receipt\" https://shop.test/receipt",
    removed: "button \"Pay\""
  });
});

test("a handle is positional, so a control that only moved is no change; a handle inside quoted words is the page's own", () => {
  const before = view("https://shop.test/a", "A", ["t1 button \"Go\"", "t2 link \"Item\" https://shop.test/i", "t3 link \"Item\" same href as t2", "t4 \"Model t5 speaker\""]);
  const after = view("https://shop.test/a", "A", ["t7 \"Banner\"", "t8 button \"Go\" covered-by t7", "t9 link \"Item\" https://shop.test/i", "t10 link \"Item\" same href as t9", "t11 \"Model t5 speaker\""]);
  const diff = webAutomationStateDiff(before, after);
  assert.equal(diff.added, "\"Banner\"\nbutton \"Go\" covered-by t*");
  assert.equal(diff.removed, "button \"Go\"");
  assert.equal(diff.titleChanged, false);
  assert.deepEqual(webStateSummaryLines(after).lines.at(-1), "\"Model t5 speaker\"");
});

test("lines are compared as a multiset, and a link on the page's base is written out so two bases compare", () => {
  const before = view("https://shop.test/s", "S", ["t1 button \"Add to cart\"", "t2 button \"Add to cart\"", "t3 link \"Next\" ~/s?page=2"], "https://shop.test");
  const after = view("https://shop.test/s/x", "S", ["t1 button \"Add to cart\"", "t3 link \"Next\" ~/s?page=2"], "https://shop.test/s");
  const diff = webAutomationStateDiff(before, after);
  assert.equal(diff.removed, "button \"Add to cart\"\nlink \"Next\" https://shop.test/s?page=2");
  assert.equal(diff.added, "link \"Next\" https://shop.test/s/s?page=2");
});

test("a structured summary stored before t223 is written as the view first, so a run recorded either side still diffs", () => {
  const legacy = { schemaVersion: "web-llm-evidence.v2", location: "https://shop.test/cart", title: "Cart", elements: [{ target: "t1", tag: "button", name: "Pay" }, { selector: "#not-an-element" }] };
  const now = view("https://shop.test/cart", "Cart", ["t4 button \"Pay\"", "t5 button \"Edit\""]);
  const diff = webAutomationStateDiff(legacy, now);
  assert.equal(diff.beforeLineCount, 1);
  assert.equal(diff.removedCount, 0);
  assert.equal(diff.added, "button \"Edit\"");
  assert.equal(diff.titleChanged, false);
  assert.doesNotMatch(JSON.stringify(diff), /"tag"|"elements"|selector/u);
});

test("every line that came is listed, with exact counts, and nothing is capped", () => {
  const grown = webAutomationStateDiff(view("https://shop.test/l", "L", []), view("https://shop.test/l", "L", Array.from({ length: 300 }, (_, index) => `t${index + 1} "Item ${index}"`)));
  assert.equal(grown.addedCount, 300);
  assert.equal(String(grown.added).split("\n").length, 300);
  assert.equal(grown.locationChanged, false);
  assert.equal(grown.beforeLineCount, 0);
});

// Run `run-muw5zv4m-52d83027`: the fixture's size buttons rewrite the address
// in place (`history.replaceState`), and Core's finished-run check dropped the
// step's change lines because the address differed. The document identity
// (`performance.timeOrigin`, one per document) says the page never moved.
function inDocument(summary: JsonObject, documentTimeOrigin: number): JsonObject {
  return { ...summary, documentTimeOrigin };
}

test("an address rewritten in place is a location change in the same document, and its lines are diffed", () => {
  const before = inDocument(view("https://shop.test/p/rolls?size=6", "Rolls", ["t1 option \"6 Double Rolls\" (chosen)", "t2 option \"12 Double Rolls\""]), 1_759_000_000_123.4);
  const after = inDocument(view("https://shop.test/p/rolls?size=12", "Rolls", ["t1 option \"6 Double Rolls\"", "t2 option \"12 Double Rolls\" (chosen)"]), 1_759_000_000_123.4);
  const diff = webAutomationStateDiff(before, after);
  assert.equal(diff.locationChanged, true);
  assert.equal(diff.documentChanged, false);
  assert.equal(diff.added, "option \"6 Double Rolls\"\noption \"12 Double Rolls\" (chosen)");
  assert.equal(diff.removed, "option \"6 Double Rolls\" (chosen)\noption \"12 Double Rolls\"");
  assert.doesNotMatch(JSON.stringify(diff), /1759000000123/u);
});

test("a new document is a document change, even at the same address (a reload)", () => {
  const before = inDocument(view("https://shop.test/cart", "Cart", ["t1 \"Qty 1\""]), 1_759_000_000_123.4);
  const after = inDocument(view("https://shop.test/cart", "Cart", ["t1 \"Qty 1\""]), 1_759_000_004_567.8);
  const diff = webAutomationStateDiff(before, after);
  assert.equal(diff.locationChanged, false);
  assert.equal(diff.documentChanged, true);
});

test("with the document identity missing on either side, a document change is a location change, as before", () => {
  const plain = view("https://shop.test/a", "A", []);
  const moved = view("https://shop.test/b", "B", []);
  assert.equal(webAutomationStateDiff(inDocument(plain, 5), moved).documentChanged, true);
  assert.equal(webAutomationStateDiff(plain, inDocument(moved, 5)).documentChanged, true);
  assert.equal(webAutomationStateDiff(plain, moved).documentChanged, true);
  assert.equal(webAutomationStateDiff(plain, inDocument(plain, 5)).documentChanged, false);
  // Only a finite number is an identity.
  assert.equal(webAutomationStateDiff({ ...plain, documentTimeOrigin: "5" }, { ...moved, documentTimeOrigin: "5" }).documentChanged, true);
});
