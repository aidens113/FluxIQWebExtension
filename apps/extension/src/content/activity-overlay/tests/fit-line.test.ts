import assert from "node:assert/strict";
import test from "node:test";
import { fitLine } from "../fit-line";

/** Seven pixels a character, as the status pill's own test measures. */
const measure = (text: string): number => text.length * 7;

test("a line that fits is drawn whole, and one that cannot be measured is left whole", () => {
  assert.equal(fitLine("Clicking “Get coupons”", 400, measure), "Clicking “Get coupons”");
  assert.equal(fitLine("Clicking “Get coupons”", 40, () => undefined), "Clicking “Get coupons”");
});

test("a cut never falls inside a control's quoted name; the words before the colon give way first (D6)", () => {
  // run-muylu4pp-f9cb2121 moments 9 and 11: the overlay read "… clicking “Get…”".
  const line = "Checking an earlier step is still done: clicking “Get coupons”";
  const fitted = fitLine(line, 330, measure);
  assert.equal(fitted, "Clicking “Get coupons”");
  assert.doesNotMatch(fitted, /“[^”]*…/u);
});

test("a line whose name already fits is cut after the name, never inside it", () => {
  const line = "Clicking “Get coupons” on the item page while the banner is still open";
  const fitted = fitLine(line, 200, measure);
  assert.ok(fitted.startsWith("Clicking “Get coupons”"), fitted);
  assert.ok(fitted.endsWith("…"), fitted);
});

test("a line with no quoted name is cut where a word ends, as before", () => {
  assert.equal(fitLine("Updating the Flow — that didn't work, trying another way", 22 * 7 + 2, measure), "Updating the Flow…");
});

test("when not even the subject keeps its name whole, the plain word cut is the backstop", () => {
  const line = "Doing an earlier step again first: clicking “A very long control name that never fits”";
  const fitted = fitLine(line, 120, measure);
  assert.ok(measure(fitted) <= 118, fitted);
  assert.ok(fitted.endsWith("…") || fitted.endsWith("…”"), fitted);
});
