import assert from "node:assert/strict";
import test from "node:test";
import { advanceScenarioCounter } from "../state-counter.js";

test("internal counter advances safely through the last supported value", () => {
  assert.equal(advanceScenarioCounter(0), 1);
  assert.equal(advanceScenarioCounter(Number.MAX_SAFE_INTEGER - 1), Number.MAX_SAFE_INTEGER);
});
for (const value of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, 1.5, NaN, Infinity]) test(`counter refuses ${value} without wrap`, () => {
  assert.throws(() => advanceScenarioCounter(value), /counter_exhausted/);
});
