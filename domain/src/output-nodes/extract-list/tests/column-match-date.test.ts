// A date condition claims no column shape (t800): its bound reads the date the
// value states, not a number, so a guessed column name must not lean towards a
// numeric attribute column over the date column it meant. Until t800 a date
// bound asked for a number, as t790 left it.

import assert from "node:assert/strict";
import test from "node:test";
import { webExtractionComparedShape } from "../column-match";

test("a date bound or a within needs no shape, and a number bound still needs a number", () => {
  assert.equal(webExtractionComparedShape({ atLeast: "2026-09-19" }), undefined);
  assert.equal(webExtractionComparedShape({ atLeast: "7 days ago", not: true }), undefined);
  assert.equal(webExtractionComparedShape({ within: "7 days" }), undefined);
  assert.equal(webExtractionComparedShape({ atLeast: 4 }), "number");
  assert.equal(webExtractionComparedShape({ equals: 3 }), "number");
});
