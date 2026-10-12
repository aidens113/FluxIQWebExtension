// The options a failed select names as closest to the value sent (t464).
//
// The select verb itself runs only in a browser; its live proof is the content
// harness. These rows pin the ranking it quotes: lane B round 8 sent `"2"`,
// quote marks included, to a select offering 1 to 12, and the failure must say
// that `2` is the option that differs only by those marks.

import assert from "node:assert/strict";
import test from "node:test";
import { closestOfferedOptions } from "../closest-options";

const quantities = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }));

test("a value sent with its quote marks names the option that differs only by them, first", () => {
  const { closest, sameButQuoting } = closestOfferedOptions("\"2\"", quantities);
  assert.deepEqual(sameButQuoting, { value: "2", label: "2" });
  assert.equal(closest[0]?.value, "2");
  assert.equal(closest.length, 5);
});

test("spaces, single quotes and letter case are the same kind of difference", () => {
  const sizes = [{ value: "s", label: "Small" }, { value: "m", label: "Medium" }, { value: "l", label: "Large" }];
  assert.deepEqual(closestOfferedOptions("  'medium' ", sizes).sameButQuoting, { value: "m", label: "Medium" });
  assert.deepEqual(closestOfferedOptions("LARGE", sizes).sameButQuoting, { value: "l", label: "Large" });
});

test("a value no option matches even loosely ranks the nearest first and claims no sameness", () => {
  const sizes = [{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }];
  const { closest, sameButQuoting } = closestOfferedOptions("mediun", sizes, 2);
  assert.equal(sameButQuoting, undefined);
  assert.deepEqual(closest.map((option) => option.value), ["medium", "small"]);
});

test("an option that contains the value ranks before one that is only near it, and ties keep the page's order", () => {
  const options = [{ value: "x", label: "Twelve pack" }, { value: "y", label: "Pack" }, { value: "z", label: "Twelve" }];
  const { closest } = closestOfferedOptions("twelve", options);
  assert.deepEqual(closest.map((option) => option.value), ["z", "x", "y"]);
});

test("names nothing for a select with no options, and never more than the limit", () => {
  assert.deepEqual(closestOfferedOptions("2", []), { closest: [], sameButQuoting: undefined });
  assert.equal(closestOfferedOptions("2", quantities, 3).closest.length, 3);
});
