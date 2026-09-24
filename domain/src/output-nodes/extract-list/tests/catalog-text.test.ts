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
  for (const term of ['handle: "extraction.N"', 'fields?: {yourKey: "colKey"|"colKey@href"}', "paginate?: false", "absolute URL", "raw href"]) {
    assert.equal(grammar.includes(term), true, `the grammar does not say ${term}`);
  }
  assert.equal(grammar.indexOf("handle") < grammar.indexOf("item: css"), true, "the handle form comes before the literal request");
  assert.match(grammar, /minItems \(default 1, 0 = none\), maxItems/u);
  // Pagination is described once, for both branches. It was described twice
  // until 2026-09-24, and the second copy is what paid for the clause below.
  assert.equal(grammar.split("paginate?:").length - 1, 2, "paginate appears as the detected switch and as the literal shape, and not a third time");
});

test("the grammar says filtering is optional before it says how to filter", () => {
  // The fault the product owner named on 2026-09-24, after conditions a sharper
  // vocabulary made writable rejected every row and a run returned 0 records
  // where 13 were wanted (`run-mug3tnti-9ab80b85`): this text had made narrowing
  // look compulsory on a first attempt, at the point the model is least certain.
  // Creation writes the least it needs; the repair narrows it later.
  const grammar = WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR;
  assert.equal(grammar.includes("where is optional"), true, "the grammar says filtering is optional");
  assert.match(grammar, /omit it, keep every item, narrow later/u);
  assert.equal(
    grammar.indexOf("where is optional") < grammar.indexOf("atMost"),
    true,
    "optional comes before the vocabulary that makes a read narrower"
  );
});

test("the shape a model copies shows a mark and a bound over a column under the plan's own key", () => {
  // Both first-page reads of the 2026-09-23 campaign wrote the one condition
  // this text showed -- the advertisement mark -- and no bound at all, under
  // instructions asking for items rated 4.0 or higher and priced under $50.
  // The everything-store run of 2026-09-24 then wrote no condition at all under
  // an instruction carrying five (`run-mug1z9k9-ef625d8b`), two of which were
  // exclusions by wording that this grammar could not express.
  const grammar = WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR;
  assert.equal(grammar.includes('{field: "colKey", is: "absent"}'), true, "the mark condition is still shown");
  assert.equal(grammar.includes('{field: "yourKey", atLeast: 4, lessThan: 50}'), true, "a bound is shown, over a column under the plan's own key");
  assert.equal(grammar.indexOf("where?:") < grammar.indexOf("item: css"), true, "the conditions belong to the handle form, before the literal request");
  // The comparisons no shape shows are still named, or they are not writable.
  // `contains` and `not` lost their shape here on 2026-09-24 to pay for the
  // optionality clause, and keep it in the detect tool's description, which has
  // room (`runtime/llm-evidence/tools.ts`).
  for (const term of ["atMost", "greaterThan", "equals", "contains", "startsWith", "endsWith", "matches", "list = any", "not: true"]) {
    assert.equal(grammar.includes(term), true, `the grammar does not name ${term}`);
  }

  // The example is the least a read needs, plus the one exclusion that is nearly
  // always right. It showed four conditions for a day, and the run after that
  // wrote conditions rejecting every row (`run-mug3tnti-9ab80b85`): an example is
  // the only complete request a model sees, so it models how much to write as
  // well as what. `where` stays present because a key the example omits is a key
  // the model is refused for writing beside `extractList`.
  const where = WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE.where as ReadonlyArray<Record<string, unknown>>;
  assert.deepEqual(where, [{ read: ".sponsored-label", is: "absent" }]);
  assert.equal(Object.hasOwn(WEB_AUTOMATION_EXTRACT_LIST_EXAMPLE, "where"), true, "the example declares where, or a model cannot write it beside extractList");
});
