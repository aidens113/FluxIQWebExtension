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
import { WEB_AUTOMATION_EXTRACT_LIST_DESCRIPTION, WEB_AUTOMATION_EXTRACT_LIST_GRAMMAR } from "../catalog-text";

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
  assert.equal(grammar.length <= 600, true, `${grammar.length} characters`);
  for (const term of ['handle: "extraction.N"', 'fields?: {key: "detectedKey" | "detectedKey@href"}', "paginate?: false (this page only)", "renamed", "absolute URL", "raw href"]) {
    assert.equal(grammar.includes(term), true, `the grammar does not say ${term}`);
  }
  assert.equal(grammar.indexOf("handle") < grammar.indexOf("item: css"), true, "the handle form comes before the literal request");
  assert.match(grammar, /Both take minItems \(default 1; 0 allows none\), maxItems/u);
});
