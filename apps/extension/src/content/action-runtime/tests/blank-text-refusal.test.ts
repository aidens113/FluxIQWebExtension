// The one rule for a text expectation that names nothing: shared by the assert
// evaluator (`assertion-evaluation.ts`) and the text waits (`wait-conditions.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { blankTextRefusal } from "../blank-text-refusal";

test("a missing, empty or whitespace text is refused, saying what was expected and what the command named", () => {
  for (const text of [undefined, null, "", " \t\n ", 7, {}]) {
    assert.deepEqual(blankTextRefusal(text, "assertion"), {
      expected: "a nonblank text expectation",
      actual: "the assertion named no meaningful text"
    }, JSON.stringify(text) ?? String(text));
  }
  assert.equal(blankTextRefusal("", "wait")?.actual, "the wait named no meaningful text");
});

test("any text with a character in it is an expectation, the literal word null included", () => {
  for (const text of ["null", "0", " x ", "Cart (3)"]) assert.equal(blankTextRefusal(text, "wait"), undefined, text);
});
