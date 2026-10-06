// Run facts: what is known is read, what is not stays undefined.

import assert from "node:assert/strict";
import test from "node:test";
import type { RunSummary } from "../types";
import { runFacts } from "../facts";

const base: RunSummary = { runId: "r1", flowId: "f1", status: "succeeded", startedAt: 1_000, finishedAt: 15_200, updatedAt: 15_200 };

test("outcome and duration come from the summary", () => {
  assert.equal(runFacts({ run: base }).outcome, "completed");
  assert.equal(runFacts({ run: base }).durationMs, 14_200);
  assert.equal(runFacts({ run: { ...base, status: "failed" } }).outcome, "failed");
  assert.equal(runFacts({ run: { ...base, status: "cancelled" } }).outcome, "stopped");
  assert.equal(runFacts({ run: { ...base, status: "queued" } }).outcome, "running");
  assert.equal(runFacts({ run: { ...base, status: "exploded" } }).outcome, undefined, "an unknown status is not guessed");
  assert.equal(runFacts({ run: { ...base, status: "constructor" } }).outcome, undefined, "no prototype keys");
});

test("nothing is guessed when the summary is silent", () => {
  const facts = runFacts({ run: { runId: "r", flowId: "f", status: "" } });
  assert.deepEqual(facts, {
    outcome: undefined, durationMs: undefined, aiUsed: undefined, aiActivations: undefined,
    learned: undefined, changesTried: undefined, validated: undefined, futureRunsUpdated: undefined
  });
  assert.equal(runFacts({ run: { ...base, finishedAt: 0 } }).durationMs, undefined, "a finish before the start is not a duration");
});

test("AI use is the intervention count", () => {
  assert.equal(runFacts({ run: { ...base, interventionCount: 0 } }).aiUsed, false);
  assert.deepEqual(
    [runFacts({ run: { ...base, interventionCount: 3 } }).aiUsed, runFacts({ run: { ...base, interventionCount: 3 } }).aiActivations],
    [true, 3]
  );
});

test("learned counts only the run's adaptations Core reports applied", () => {
  const statuses = (entries: [string, string][]) => new Map(entries);
  const created = { run: { ...base, adaptationCount: 4 }, createdAdaptationIds: ["a1", "a2", "a3", "a4"] };
  assert.equal(runFacts({ ...created, adaptationStatuses: statuses([["a1", "applied"], ["a2", "validated"], ["a3", "proposed"], ["a4", "testing"]]) }).learned, 1);
  assert.equal(runFacts({ ...created, adaptationStatuses: statuses([["a1", "applied"], ["a4", "applied"], ["other", "applied"]]) }).learned, 2, "another run's adaptation is not counted");
  assert.equal(runFacts({ ...created, adaptationStatuses: statuses([["a2", "validated"], ["a3", "proposed"], ["a4", "testing"]]) }).learned, 0);
  assert.equal(runFacts({ run: base, adaptationIds: ["x"], adaptationStatuses: statuses([["x", "applied"]]) }).learned, 1, "the detail's ids stand in for the reply's");
});

test("learned is 0 when nothing durable changed, and unknown when only creation was reported", () => {
  assert.equal(runFacts({ run: base, createdAdaptationIds: ["a1"], durableBehaviorChanged: false }).learned, 0);
  assert.equal(runFacts({ run: { ...base, adaptationCount: 4 }, durableBehaviorChanged: false }).learned, 0);
  assert.equal(runFacts({ run: base, createdAdaptationIds: ["a1"] }).learned, undefined, "created is not applied");
  assert.equal(runFacts({ run: base, createdAdaptationIds: ["a1"], durableBehaviorChanged: true }).learned, undefined);
  assert.equal(runFacts({ run: { ...base, adaptationCount: 4 } }).learned, undefined, "the summary's created count is not learned");
});

test("changes tried count every adaptation the run made, applied or not", () => {
  assert.equal(runFacts({ run: { ...base, adaptationCount: 4 } }).changesTried, 4);
  assert.equal(runFacts({ run: { ...base, adaptationCount: 4 }, createdAdaptationIds: ["a1"] }).changesTried, 1, "the reply's ids before the summary's count");
  assert.equal(runFacts({ run: base, adaptationIds: ["x", "y"] }).changesTried, 2);
  assert.equal(runFacts({ run: base }).changesTried, undefined);
});

test("validated and future runs follow the adaptations' statuses", () => {
  const statuses = (entries: [string, string][]) => new Map(entries);
  const learnt = { run: base, createdAdaptationIds: ["a1", "a2"] };
  assert.equal(runFacts({ ...learnt, adaptationStatuses: statuses([["a1", "testing"]]) }).validated, undefined);
  assert.equal(runFacts({ ...learnt, adaptationStatuses: statuses([["a1", "validated"]]) }).validated, true);
  assert.equal(runFacts({ ...learnt, adaptationStatuses: statuses([["a1", "rejected"], ["a2", "reverted"]]) }).validated, false);
  assert.equal(runFacts({ ...learnt, adaptationStatuses: statuses([["a1", "rejected"]]) }).validated, undefined, "one still unknown");
  const applied = runFacts({ ...learnt, adaptationStatuses: statuses([["a2", "applied"]]) });
  assert.deepEqual([applied.validated, applied.futureRunsUpdated], [true, true]);
  assert.equal(runFacts({ run: base, adaptationIds: ["x"], adaptationStatuses: statuses([["x", "applied"]]) }).futureRunsUpdated, true);
  assert.equal(runFacts({ run: base, adaptationStatuses: statuses([["x", "applied"]]) }).futureRunsUpdated, undefined, "another run's adaptation is not this run's");
});

test("durableBehaviorChanged is taken as said", () => {
  assert.equal(runFacts({ run: base, durableBehaviorChanged: true }).futureRunsUpdated, true);
  assert.equal(runFacts({ run: base, durableBehaviorChanged: false }).futureRunsUpdated, false);
  assert.equal(runFacts({ run: base }).futureRunsUpdated, undefined);
});
