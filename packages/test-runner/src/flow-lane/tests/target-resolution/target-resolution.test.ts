import assert from "node:assert/strict";
import test from "node:test";
import { executeRecordedFlowRun } from "../../persisted-flow-run.js";
import { attempt, control } from "../support/index.js";

/**
 * `L-replay` Defect 4: Core records how it resolved each target, the Core store
 * is deleted when the run ends, and the bundle kept none of it. Core's run
 * detail carries the record at `metadata.targetResolution`.
 */
test("Core's target resolution travels with the attempt, rebuilt from its closed fields only", async () => {
  // Core's no-candidates record applied no floor, so it carries none (Core `nodes/contracts.ts`).
  // The candidate id Core takes from a page's own `id` or `testId` attribute,
  // and the signal names, are left behind: only the status and numbers travel.
  const unresolved = { status: "unresolved_no_candidates", candidateCount: 0, candidateId: "email-address", matchedSignals: ["testId"], failedSignals: ["accessibleName"] };
  const { client } = control({}, { actionAttempts: [attempt({ metadata: { regionId: "region.one", targetResolution: unresolved } })] });
  const outcome = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.deepEqual(outcome.actions[0]?.targetResolution, { status: "unresolved_no_candidates", candidateCount: 0 });
  const serialised = JSON.stringify(outcome);
  for (const left of ["email-address", "matchedSignals", "failedSignals", "accessibleName"]) assert.equal(serialised.includes(left), false, `${left} must not travel`);
  // A floor beside a no-candidates status, as Core wrote before `0e6d3ac`, is read past: that variant claims none.
  const { client: floored } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution: { ...unresolved, minimumConfidence: 0.55 } } })] });
  assert.deepEqual((await executeRecordedFlowRun(floored, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).actions[0]?.targetResolution, { status: "unresolved_no_candidates", candidateCount: 0 });

  const noMatcher = { status: "unresolved_no_matcher", candidateCount: 3, confidence: 0.9, minimumConfidence: 0.55, candidateId: "private-target" };
  const { client: delegated } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution: noMatcher } })] });
  assert.deepEqual((await executeRecordedFlowRun(delegated, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).actions[0]?.targetResolution, { status: "unresolved_no_matcher", candidateCount: 3 });

  const matched = { status: "matched", candidateCount: 2, minimumConfidence: 0.55, confidence: 0.884, normalizedScore: 0.94 };
  const below = { status: "below_confidence", candidateCount: 3, minimumConfidence: 0.55, confidence: 0.41 };
  for (const scoredRecord of [matched, below]) {
    const { client: scored } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution: scoredRecord } })] });
    assert.deepEqual((await executeRecordedFlowRun(scored, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" })).actions[0]?.targetResolution, scoredRecord);
  }
});

test("an attempt with no target resolution, or one Core does not write, carries none", async () => {
  const { client: plain } = control();
  const outcome = await executeRecordedFlowRun(plain, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
  assert.equal(Object.hasOwn(outcome.actions[0] ?? {}, "targetResolution"), false);
  const invalid = [
    { status: "guessed", candidateCount: 1, minimumConfidence: 0.5 },
    { status: "matched", minimumConfidence: 0.5 },
    { status: "matched", candidateCount: "2", minimumConfidence: 0.5 },
    // A scored record without its floor, and a no-candidates record that counted some.
    { status: "matched", candidateCount: 1, confidence: 0.9 },
    { status: "unresolved_no_candidates", candidateCount: 2 },
    { status: "unresolved_no_matcher", candidateCount: -1 },
    { status: "unresolved_no_matcher", candidateCount: 1.5 },
    ["matched"],
  ];
  for (const targetResolution of invalid) {
    const { client } = control({}, { actionAttempts: [attempt({ metadata: { targetResolution } })] });
    const read = await executeRecordedFlowRun(client, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });
    assert.equal(read.actions[0]?.targetResolution, undefined, JSON.stringify(targetResolution));
  }
});
