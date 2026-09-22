// The "Changed fields" oracle mirrors Core's projection: one row per changed
// leaf with a dotted path, Core's display words for absent, null, empty and
// boolean values, JSON for arrays, "Value" for a changed scalar, and a cap.

import assert from "node:assert/strict";
import test from "node:test";
import { adaptationChangedFieldRows } from "../changed-fields.js";

test("a re-pointed target yields one row per changed leaf, in sorted key order", () => {
  assert.deepEqual(adaptationChangedFieldRows(
    { selector: "[data-testid=\"notes\"]", frame: { index: 0 }, kind: "css" },
    { selector: "[data-testid=\"notes\"]:not([data-ui-e2e-never])", frame: { index: 1 }, kind: "css" },
  ), [
    { path: "frame.index", before: "0", after: "1" },
    { path: "selector", before: "[data-testid=\"notes\"]", after: "[data-testid=\"notes\"]:not([data-ui-e2e-never])" },
  ]);
});

test("absent, null, empty and boolean values use Core's display words", () => {
  assert.deepEqual(adaptationChangedFieldRows({ a: null, b: "", c: true }, { a: "x", b: "y", c: false, d: 2 }), [
    { path: "a", before: "None", after: "x" },
    { path: "b", before: "Empty", after: "y" },
    { path: "c", before: "Yes", after: "No" },
    { path: "d", before: "Not set", after: "2" },
  ]);
});

test("arrays are shown as JSON, a changed scalar is the \"Value\" row, and equal values yield nothing", () => {
  assert.deepEqual(adaptationChangedFieldRows({ list: [1] }, { list: [1, 2] }), [{ path: "list", before: "[1]", after: "[1,2]" }]);
  assert.deepEqual(adaptationChangedFieldRows("old", "new"), [{ path: "Value", before: "old", after: "new" }]);
  assert.deepEqual(adaptationChangedFieldRows({ same: { deep: 1 } }, { same: { deep: 1 } }), []);
  assert.deepEqual(adaptationChangedFieldRows(undefined, undefined), []);
});

test("rows stop at the limit", () => {
  const before = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`k${String(index).padStart(2, "0")}`, index]));
  const after = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`k${String(index).padStart(2, "0")}`, index + 1]));
  assert.equal(adaptationChangedFieldRows(before, after).length, 50);
  assert.equal(adaptationChangedFieldRows(before, after, 3).length, 3);
});
