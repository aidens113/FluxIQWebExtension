// T1 coverage of the rule that decides whether a press is made once more
// (`press-again.ts`). The row that matters most is the request: a press that
// reached the server is never pressed again, whatever else was or was not seen.
// Make `pressAgain` ignore any sign and its row goes red.

import assert from "node:assert/strict";
import test from "node:test";
import { MAX_EXTRA_PRESSES, pressAgain, type PressSignal } from "../press-again";

const EVERY_SIGNAL: PressSignal[] = ["request", "change", "navigation", "focus"];

test("a press after which the page did nothing at all is pressed once more", () => {
  assert.equal(pressAgain([], 0), true);
});

test("a press that sent a request is never pressed again, alone or with anything else", () => {
  assert.equal(pressAgain(["request"], 0), false);
  assert.equal(pressAgain(["change", "request"], 0), false);
  assert.equal(pressAgain(["request", "navigation", "focus"], 0), false);
});

test("any one sign that the page answered forbids a second press", () => {
  for (const signal of EVERY_SIGNAL) assert.equal(pressAgain([signal], 0), false, `${signal} must forbid a second press`);
});

test("one command makes at most one extra press, even when the second press was ignored too", () => {
  assert.equal(MAX_EXTRA_PRESSES, 1);
  assert.equal(pressAgain([], 1), false);
  assert.equal(pressAgain([], 2), false);
});
