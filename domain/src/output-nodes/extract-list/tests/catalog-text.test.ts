// What a model reads about the list extraction node leads it to a detected
// list before a literal request.
//
// Live, every catalog build that detected the product cards still wrote a
// literal request with guessed selectors, because this text described only CSS
// (`run-mu4wwkbc-df6cfe60`). The rows below hold the text to the handle form
// the plan resolver takes (`runtime/llm-evidence/plan-resolution/`), and the
// grammar's other terms stay pinned in `output-nodes/tests/definitions.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE, WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR } from "../catalog-text";

test("the node says to detect the list, name it by its handle, and that it saves its own rows", () => {
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, /web\.detect_repeating_structure/u);
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, /extractList by its handle/u);
  // Live, a model added a save node after a successful extraction, and the run failed on it (`run-mu4yk4u1-60a1c3a4`).
  assert.match(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, /saves its rows itself: no recordOutput or save node needed/u);
  // Core cuts a node description at 240 characters, and a condensed one at its first sentence.
  assert.equal(WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION.length <= 240, true, `${WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION.length} characters`);
});

test("the grammar leads with the handle form, and says how to keep, rename and read columns and pages", () => {
  const grammar = WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR;
  // 700, with Core's parameter-description bound moved to match. The extra
  // room carries one clause -- what a page budget is for -- and the pair that
  // justifies it: on 2026-09-24 "the products shown on the first page" and
  // "every product, across all of its pages" produced the identical authored
  // node, `paginate: { maxPages: 3 }`, one failing and one passing. Three
  // changes elsewhere left that pair unchanged. A budget is for keeping a
  // prompt honest, not for keeping a term undefined.
  assert.equal(grammar.length <= 700, true, `${grammar.length} characters`);
  assert.equal(grammar.includes("pages to read, not pages present"), true, "the grammar says what a page budget is for");
  for (const term of ['handle: "extraction.N"', 'fields?: {yourKey: "colKey"|"colKey@href"}', "paginate?: false (this page)", "absolute URL", "raw href"]) {
    assert.equal(grammar.includes(term), true, `the grammar does not say ${term}`);
  }
  assert.equal(grammar.indexOf("handle") < grammar.indexOf("item: css"), true, "the handle form comes before the literal request");
  assert.match(grammar, /Both take minItems \(default 1; 0 allows none\), maxItems/u);
});

test("the shape a model copies shows a bound as well as a mark, over a column under the plan's own key", () => {
  // Both first-page reads of the 2026-09-23 campaign wrote the one condition
  // this text showed -- the advertisement mark -- and no bound at all, under
  // instructions asking for items rated 4.0 or higher and priced under $50.
  const grammar = WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR;
  assert.equal(grammar.includes('{field: "colKey", is: "absent"}'), true, "the mark condition is still shown");
  assert.equal(grammar.includes('{field: "yourKey", atLeast: 4, lessThan: 50}'), true, "a bound is shown, over a column under the plan's own key");
  assert.equal(grammar.indexOf("where?:") < grammar.indexOf("item: css"), true, "the conditions belong to the handle form, before the literal request");

  // The example carries one of each too. A key the example omits is a key the
  // model is refused for writing beside `extractList`, and what the example
  // shows inside `where` is the shape a model copies.
  const where = WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE.where as ReadonlyArray<Record<string, unknown>>;
  assert.equal(where.length, 2);
  assert.equal(where[0]?.is, "absent");
  assert.deepEqual(where[1], { field: "price", lessThan: 50 });
  const fields = WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE.fields as Record<string, unknown>;
  assert.equal(Object.hasOwn(fields, String(where[1]?.field)), true, "a literal condition names a column the request reads");
});
