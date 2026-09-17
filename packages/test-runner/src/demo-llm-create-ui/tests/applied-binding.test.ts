// The applied Flow's execution binding, watched for a short while after
// apply. A live run applied an exploration proposal, reported success, and the
// very next step found the Flow's current execution digest no longer equal to
// the one Core recorded at apply. The watcher makes the apply step itself
// fail, and say when the two parted, instead of leaving it to the next step.

import assert from "node:assert/strict";
import test from "node:test";
import { watchAppliedBinding } from "../applied-binding.js";

function clock() {
  let now = 0;
  return { now: () => now, pause: async (ms: number) => { now += ms; } };
}

test("a binding that stays equal for the whole window reports no drift", async () => {
  const time = clock();
  let reads = 0;
  const result = await watchAppliedBinding(async () => { reads += 1; return { applied: "a1", current: "a1" }; }, { settleMs: 2_000, intervalMs: 500, ...time });
  assert.equal(result.driftedAtMs, undefined);
  assert.equal(result.reads, reads);
  assert.ok(result.reads >= 4);
});

test("a binding that parts after apply reports when, and stops reading", async () => {
  const time = clock();
  const values = [{ applied: "a1", current: "a1" }, { applied: "a1", current: "a1" }, { applied: "a1", current: "c2" }];
  let reads = 0;
  const result = await watchAppliedBinding(async () => values[Math.min(reads++, values.length - 1)]!, { settleMs: 5_000, intervalMs: 500, ...time });
  assert.equal(result.driftedAtMs, 1_000);
  assert.equal(result.reads, 3);
});

test("a binding with no applied digest, or one unequal from the first read, drifts at zero", async () => {
  const time = clock();
  assert.equal((await watchAppliedBinding(async () => ({ current: "c1" }), { settleMs: 1_000, intervalMs: 500, ...time })).driftedAtMs, 0);
  assert.equal((await watchAppliedBinding(async () => ({ applied: "a1", current: "c1" }), { settleMs: 1_000, intervalMs: 500, ...time })).driftedAtMs, 0);
});

test("an applied digest that differs from the one apply returned is drift too", async () => {
  const time = clock();
  const result = await watchAppliedBinding(async () => ({ applied: "a1", current: "a1" }), { settleMs: 1_000, intervalMs: 500, expectedApplied: "other", ...time });
  assert.equal(result.driftedAtMs, 0);
});
