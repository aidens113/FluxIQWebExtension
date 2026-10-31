// A control found again among a fresh look's controls by its identity signals,
// never by its handle, selector, xpath or position (t786, D4).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationReacquireTarget, webReacquireElement } from "..";

const STALE: JsonObject = {
  selector: "#feed > article:nth-of-type(2) button.react",
  element: { tagName: "button", accessibleName: "Like Mara's post", testId: "like-button", classNames: ["react"], context: { listPosition: { index: 1, total: 5 } } }
};

test("a renumbered control -- new selector, new handle, new position, same signals -- is found", () => {
  const fresh = { selector: "#feed > article:nth-of-type(4) button.react", handle: "t912", element: { tagName: "button", accessibleName: "Like  mara's post", testId: "like-button", classNames: ["react"], context: { listPosition: { index: 3, total: 5 } } } };
  const other = { selector: "#feed > article:nth-of-type(2) button.react", handle: "t911", element: { tagName: "button", accessibleName: "Like Ilya's post", testId: "like-button", classNames: ["react"] } };
  assert.deepEqual(webReacquireElement({ stale: STALE, candidates: [other, fresh] }), { outcome: "found", value: fresh });
});

test("a control whose words differ is another control, even at the old selector", () => {
  const other = { selector: STALE.selector!, element: { tagName: "button", accessibleName: "Like Ilya's post", testId: "like-button", classNames: ["react"] } };
  assert.deepEqual(webReacquireElement({ stale: STALE, candidates: [other] }), { outcome: "gone" });
});

test("a signal one side carries says nothing; one both carry must agree", () => {
  const noTestId = { element: { tagName: "button", accessibleName: "Like Mara's post" } };
  assert.equal(webReacquireElement({ stale: STALE, candidates: [noTestId] }).outcome, "found");
  const otherTestId = { element: { tagName: "button", accessibleName: "Like Mara's post", testId: "share-button" } };
  assert.equal(webReacquireElement({ stale: STALE, candidates: [otherTestId] }).outcome, "gone");
});

test("two identical candidates are ambiguous, unless only one sits in the stale control's record", () => {
  const stale = { element: { tagName: "button", accessibleName: "Hide post", context: { record: { text: "Mara Quill Kayak trip" } } } };
  const a = { element: { tagName: "button", accessibleName: "Hide post", context: { record: { text: "Ilya Brandt New bakery" } } } };
  const b = { element: { tagName: "button", accessibleName: "Hide post", context: { record: { text: "Mara Quill  kayak trip" } } } };
  const c = { element: { tagName: "button", accessibleName: "Hide post" } };
  assert.deepEqual(webReacquireElement({ stale, candidates: [a, c] }), { outcome: "unmatched", reason: "ambiguous" });
  assert.deepEqual(webReacquireElement({ stale, candidates: [a, b, c] }), { outcome: "found", value: b });
});

test("a control carrying fewer than two signals is unidentifiable", () => {
  assert.deepEqual(webReacquireElement({ stale: { element: { tagName: "div", selector: "#x" } }, candidates: [{ element: { tagName: "div" } }] }), { outcome: "unmatched", reason: "unidentifiable" });
  assert.deepEqual(webReacquireElement({ stale: "Like", candidates: [] }), { outcome: "unmatched", reason: "unidentifiable" });
});

test("the host method matches an output-bound control as a control and a pass's row as a row", () => {
  const source = { id: "read", definitionId: "web.output.dom-extract_list" };
  const fresh = { element: { tagName: "button", accessibleName: "Like Mara's post", testId: "like-button", classNames: ["react"] } };
  assert.deepEqual(webAutomationReacquireTarget({ lineage: { kind: "output", sourceNodeId: "find", outputKey: "element" }, source, stale: STALE, candidates: [fresh] }), { outcome: "found", value: fresh });
  const row = { author: "Mara Quill", text: "Kayak trip", likes: "13 likes" };
  assert.deepEqual(webAutomationReacquireTarget({ lineage: { kind: "row", sourceNodeId: "read", outputKey: "records", loopNodeId: "each" }, source, stale: { author: "Mara Quill", text: "Kayak trip", likes: "12 likes" }, candidates: [row] }), { outcome: "found", value: row });
  assert.deepEqual(webAutomationReacquireTarget({ lineage: { kind: "output", sourceNodeId: "find", outputKey: "url" }, source, stale: "https://x.example.test/", candidates: ["https://x.example.test/"] }), { outcome: "unmatched", reason: "unidentifiable" });
});

test("a sole descriptive match cannot replace a control from a conflicting saved record", () => {
  const records: JsonObject[] = [
    { key: "report-a", keyAttribute: "data-report", text: "Annual report" },
    { text: "Annual report" }
  ];
  for (const record of records) {
    const stale = { element: { tagName: "button", accessibleName: "View report", context: { record } } };
    const other = { element: { tagName: "button", accessibleName: "View report", context: { record: { key: "report-b", keyAttribute: "data-report", text: "Quarterly report" } } } };
    assert.equal(webReacquireElement({ stale, candidates: [other] }).outcome, "unmatched", "conflicting record identity cannot identify another item or prove the original gone");
  }
});

test("a saved stable record key identifies the same control after its record text changes", () => {
  const stale = { element: { tagName: "button", accessibleName: "View report", context: { record: { key: "report-a", keyAttribute: "data-report", text: "Annual report pending" } } } };
  const fresh = { element: { tagName: "button", accessibleName: "View report", context: { record: { key: "report-a", keyAttribute: "data-report", text: "Annual report ready" } } } };
  const other = { element: { tagName: "button", accessibleName: "View report", context: { record: { key: "report-b", keyAttribute: "data-report", text: "Quarterly report ready" } } } };
  assert.deepEqual(webReacquireElement({ stale, candidates: [other, fresh] }), { outcome: "found", value: fresh });
});
