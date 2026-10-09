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
  assert.equal(runFacts({ run: base, createdAdaptationIds: ["a1"], durableBehaviorChanged: true }).learned, 1, "Core said the stored Flow changed");
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

// A re-author Core kept after a judged re-run is a Flow Bootstrap adaptation, so
// no adaptation id of the run names it; Core's durableBehaviorChanged does (item 24).
test("a kept re-author is learned once, from durableBehaviorChanged", () => {
  const statuses = (entries: [string, string][]) => new Map(entries);
  const kept = { run: base, durableBehaviorChanged: true };
  assert.equal(runFacts(kept).learned, 1, "no ids");
  assert.equal(runFacts({ ...kept, createdAdaptationIds: [] }).learned, 1, "empty ids");
  assert.equal(runFacts({ ...kept, createdAdaptationIds: [], adaptationStatuses: statuses([]) }).learned, 1, "statuses known and empty");
  assert.equal(runFacts({ ...kept, adaptationIds: [], adaptationStatuses: statuses([]) }).futureRunsUpdated, true);
  assert.equal(
    runFacts({ ...kept, createdAdaptationIds: ["a1"], adaptationStatuses: statuses([["a1", "rejected"]]) }).learned, 1,
    "a rejected patch beside the kept re-author"
  );
});

test("an applied patch is counted once when durableBehaviorChanged is also true", () => {
  const statuses = new Map([["a1", "applied"]]);
  assert.equal(runFacts({ run: base, createdAdaptationIds: ["a1"], adaptationStatuses: statuses, durableBehaviorChanged: true }).learned, 1);
  assert.equal(
    runFacts({ run: base, createdAdaptationIds: ["a1", "a2"], adaptationStatuses: new Map([["a1", "applied"], ["a2", "applied"]]), durableBehaviorChanged: true }).learned, 2
  );
});

test("a rejected change with nothing durable is not learned", () => {
  const facts = runFacts({ run: base, createdAdaptationIds: ["a1"], adaptationStatuses: new Map([["a1", "rejected"]]), durableBehaviorChanged: false });
  assert.deepEqual([facts.learned, facts.validated, facts.futureRunsUpdated], [0, false, false]);
  assert.equal(runFacts({ run: base, createdAdaptationIds: [], adaptationStatuses: new Map(), durableBehaviorChanged: false }).learned, 0);
  assert.equal(runFacts({ run: base, createdAdaptationIds: ["a1"], adaptationStatuses: new Map([["a1", "proposed"]]) }).learned, 0, "unapplied is never learned");
});
