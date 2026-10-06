// Summary copy (plan 3.9): plain lines, only for what is known.

import assert from "node:assert/strict";
import test from "node:test";
import { runSummaryLines } from "../summary-copy";
import type { RunFacts } from "../types";

test("the plan's example reads as written", () => {
  assert.deepEqual(
    runSummaryLines({ outcome: "completed", durationMs: 14_200, aiActivations: 1, aiUsed: true, learned: 1, futureRunsUpdated: true }),
    ["Completed in 14.2s", "AI activated once", "Learned 1 new page variation", "Future runs updated"]
  );
});

test("outcomes", () => {
  assert.deepEqual(runSummaryLines({ outcome: "failed", durationMs: 3_100 }), ["Failed after 3.1s"]);
  assert.deepEqual(runSummaryLines({ outcome: "stopped", durationMs: 3_100 }), ["Stopped"]);
  assert.deepEqual(runSummaryLines({ outcome: "completed" }), ["Completed"]);
  assert.deepEqual(runSummaryLines({ outcome: "failed" }), ["Failed"]);
  assert.deepEqual(runSummaryLines({ outcome: "running" }), ["Running..."]);
  assert.deepEqual(runSummaryLines({}), [], "unknown says nothing");
});

test("durations", () => {
  assert.deepEqual(runSummaryLines({ outcome: "completed", durationMs: 0 }), ["Completed in 0.0s"]);
  assert.deepEqual(runSummaryLines({ outcome: "completed", durationMs: 59_960 }), ["Completed in 1m 0s"]);
  assert.deepEqual(runSummaryLines({ outcome: "completed", durationMs: 125_000 }), ["Completed in 2m 5s"]);
  assert.deepEqual(runSummaryLines({ outcome: "completed", durationMs: 3_780_000 }), ["Completed in 1h 3m"]);
});

test("AI activations", () => {
  assert.deepEqual(runSummaryLines({ aiActivations: 0 }), ["No AI needed"]);
  assert.deepEqual(runSummaryLines({ aiActivations: 1 }), ["AI activated once"]);
  assert.deepEqual(runSummaryLines({ aiActivations: 3 }), ["AI activated 3 times"]);
});

test("learning: only applied changes are learned, and future runs only when known true", () => {
  assert.deepEqual(runSummaryLines({ learned: 2, changesTried: 2, futureRunsUpdated: true }), ["Learned 2 new page variations", "Future runs updated"]);
  assert.deepEqual(runSummaryLines({ learned: 1 }), ["Learned 1 new page variation"]);
  assert.deepEqual(runSummaryLines({ learned: 0 }), []);
  assert.deepEqual(runSummaryLines({ futureRunsUpdated: true }), ["Future runs updated"]);
});

// A change the run tried and Core has not applied is never "learned" (item 24):
// it is still being checked, or it did not hold.
test("a change tried and not applied is being checked, or did not hold", () => {
  assert.deepEqual(runSummaryLines({ learned: 0, changesTried: 2 }), ["Checking the change..."]);
  assert.deepEqual(runSummaryLines({ changesTried: 1, validated: true }), ["Checking the change..."], "passed its trial, not yet kept");
  assert.deepEqual(runSummaryLines({ learned: 0, changesTried: 1, validated: false }), ["The change didn't hold up, so future runs stay the same"]);
  assert.deepEqual(runSummaryLines({ changesTried: 0 }), []);
});

test("no line carries an id, selector or trace", () => {
  const runs: RunFacts[] = [{ outcome: "completed", durationMs: 1, aiActivations: 2, learned: 3, futureRunsUpdated: true }, { changesTried: 2 }, { changesTried: 1, validated: false }];
  for (const facts of runs) {
    for (const line of runSummaryLines(facts)) assert.doesNotMatch(line, /[#[\]{}<>=_]|run-|flow-|adapt/i);
  }
});
