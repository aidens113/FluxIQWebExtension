// T1 coverage of pointer-click-filter.ts: a click is paired with the pointerdown
// that produced it by event order in its frame, not by time.

import assert from "node:assert/strict";
import { test } from "node:test";
import { PointerClickFilter } from "../pointer-click-filter";

const BUY = "7|0|#buy|10|20|80|30";
const OTHER = "7|0|#other|10|60|80|30";

test("a click on the pressed control, sent after the press, is that press's click", () => {
  const filter = new PointerClickFilter();
  filter.notePress(7, 0, BUY, 1);
  assert.equal(filter.isClickOfPress(7, 0, BUY, 2), true);
});

test("a press pairs with one click, so each press of the same control pairs with its own", () => {
  const filter = new PointerClickFilter();
  filter.notePress(7, 0, BUY, 1);
  assert.equal(filter.isClickOfPress(7, 0, BUY, 2), true);
  assert.equal(filter.isClickOfPress(7, 0, BUY, 3), false, "a keyboard click after the pair is its own action");
  filter.notePress(7, 0, BUY, 4);
  assert.equal(filter.isClickOfPress(7, 0, BUY, 5), true);
});

test("a click pairs with nothing when there is no press, or the press is another frame's, tab's or control's", () => {
  const filter = new PointerClickFilter();
  assert.equal(filter.isClickOfPress(7, 0, BUY, 1), false, "no press");
  filter.notePress(7, 0, BUY, 5);
  assert.equal(filter.isClickOfPress(7, 1, BUY, 6), false, "another frame");
  assert.equal(filter.isClickOfPress(8, 0, BUY, 6), false, "another tab");
  assert.equal(filter.isClickOfPress(7, 0, OTHER, 6), false, "a release off the control clicks a common ancestor");
  assert.equal(filter.isClickOfPress(7, 0, BUY, 7), false, "and that click spent the press");
});

test("a click sent before the press it would pair with belongs to an earlier document", () => {
  const filter = new PointerClickFilter();
  filter.notePress(7, 0, BUY, 5);
  assert.equal(filter.isClickOfPress(7, 0, BUY, 2), false);
});

test("a later press replaces one whose click never came", () => {
  const filter = new PointerClickFilter();
  filter.notePress(7, 0, OTHER, 1);
  filter.notePress(7, 0, BUY, 3);
  assert.equal(filter.isClickOfPress(7, 0, BUY, 4), true);
});

test("clear forgets every press", () => {
  const filter = new PointerClickFilter();
  filter.notePress(7, 0, BUY, 1);
  filter.notePress(7, 2, BUY, 1);
  filter.clear();
  assert.equal(filter.isClickOfPress(7, 0, BUY, 2), false);
  assert.equal(filter.isClickOfPress(7, 2, BUY, 2), false);
});
