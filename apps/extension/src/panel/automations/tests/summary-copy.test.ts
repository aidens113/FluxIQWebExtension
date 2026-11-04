// Summary copy (plan 3.9): plain lines, only for what is known.

import assert from "node:assert/strict";
import test from "node:test";
import { runSummaryLines } from "../summary-copy";
import type { RunFacts } from "../types";

test("ended unknown and unkept changes never assert ongoing checks or page-specific learning", () => {
  const unknown = runSummaryLines({ outcome: "completed", changesTried: 1 });
  assert.deepEqual(unknown, ["Completed"], "what is not known is left out, not warned about");
  assert.ok(!unknown.some(line => /Checking|Learned|page variation/.test(line)));
  const unkept = runSummaryLines({ outcome: "completed", changesTried: 1, validated: true, futureRunsUpdated: false });
  assert.ok(unkept.some(line => line.includes("Nothing from this run was saved")));
  assert.ok(!unkept.some(line => /Checking|Learned|page variation/.test(line)));
});

test("the plan's example reads as written", () => {
  assert.deepEqual(
    runSummaryLines({ outcome: "completed", durationMs: 14_200, aiActivations: 1, aiUsed: true, learned: 1, futureRunsUpdated: true }),
    ["Completed in 14.2s", "AI activated once", "This run kept a change for future runs"]
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

test("retention is generic and never guessed from counts or current statuses", () => {
  assert.deepEqual(runSummaryLines({ learned: 2, changesTried: 2, futureRunsUpdated: true }), ["This run kept a change for future runs"]);
  assert.deepEqual(runSummaryLines({ learned: 1 }), []);
  assert.deepEqual(runSummaryLines({ learned: 0 }), []);
  assert.deepEqual(runSummaryLines({ futureRunsUpdated: true }), ["This run kept a change for future runs"]);
  assert.deepEqual(runSummaryLines({ learned: 9, futureRunsUpdated: false }), ["Nothing from this run was saved for next time"]);
});

// A change the run tried and Core has not applied is never "learned" (item 24):
// it is still being checked, or it did not hold.
test("ended change counts and validation never invent retention or ongoing checking", () => {
  assert.deepEqual(runSummaryLines({ learned: 0, changesTried: 2 }), []);
  assert.deepEqual(runSummaryLines({ changesTried: 1, validated: true }), []);
  assert.deepEqual(runSummaryLines({ learned: 0, changesTried: 1, validated: false }), []);
  assert.deepEqual(runSummaryLines({ changesTried: 0 }), []);
});

// A re-author Core kept after a judged re-run (item 24): runFacts gives
// learned 1 and future runs updated, with no adaptation id behind it.
test("a kept re-author reads as learned, and a rejected change as not held", () => {
  assert.deepEqual(
    runSummaryLines({ outcome: "completed", durationMs: 14_200, aiActivations: 2, learned: 1, changesTried: 0, futureRunsUpdated: true }),
    ["Completed in 14.2s", "AI activated 2 times", "This run kept a change for future runs"]
  );
  assert.deepEqual(
    runSummaryLines({ outcome: "completed", learned: 0, changesTried: 1, validated: false, futureRunsUpdated: false }),
    ["Completed", "Nothing from this run was saved for next time"]
  );
});

test("no line carries an id, selector or trace", () => {
  const runs: RunFacts[] = [{ outcome: "completed", durationMs: 1, aiActivations: 2, learned: 3, futureRunsUpdated: true }, { changesTried: 2 }, { changesTried: 1, validated: false }];
  for (const facts of runs) {
    for (const line of runSummaryLines(facts)) assert.doesNotMatch(line, /[#[\]{}<>=_]|run-|flow-|adapt/i);
  }
});
