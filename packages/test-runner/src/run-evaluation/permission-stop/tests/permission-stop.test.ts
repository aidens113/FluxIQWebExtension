import assert from "node:assert/strict";
import test from "node:test";
import type { RunManifest } from "@fluxiq-web-extension/test-contracts";
import { flowLaneObservation } from "../../../flow-lane/index.js";
import { singleRunEvaluation, type SingleRunInput } from "../../single-run-evaluation.js";
import { honestRunVerdict, passStreak, PERMISSION_STOP_INVARIANT, verdictTotals, type HonestRunVerdict } from "../index.js";

const manifest = { startedAt: "2026-09-30T02:00:00.000Z", finishedAt: "2026-09-30T02:01:00.000Z", automationFailure: null, actions: [] } as unknown as RunManifest;
const noFlow = flowLaneObservation({ flowCreated: false, oracleVerdict: null, run: undefined, automationFailureExpected: null });
const createdFlow = flowLaneObservation({
  flowCreated: true, oracleVerdict: "passed", automationFailureExpected: null,
  run: { runId: "core-run.1", status: "succeeded", harnessActivations: 0, harnessRecovery: { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] }, failure: null, resultVerification: "confirmed", extracted: [], extractedNonStringValues: 0, extractionDurationsByNode: new Map(), route: null, actions: [{ actionType: "web.dom.click", nodeId: "node-1", attemptIndex: 0, status: "succeeded", startedAt: "2026-09-30T02:00:10.000Z", durationMs: 210, failure: null }] },
});
const input = (fields: Partial<SingleRunInput>): SingleRunInput => ({
  runId: "run-stop", verdict: "passed", failureCategory: undefined, facilityFailure: null, scenarioId: "bigbox-retail", workflowId: "pickup-order", variantId: undefined,
  observation: createdFlow, manifest, metrics: { steps: 1 }, events: [{ sequence: 9, trigger: "final" }], wallClockMs: 60_000, ...fields,
});

test("a permission stop with no Flow is stopped_for_permission in evaluation.json, never passed", () => {
  // What the runner hands the evaluator for lane D's bigbox pickup-order stop, now that the lane rule fails it.
  const evaluation = singleRunEvaluation(input({
    verdict: "failed", failureCategory: "runtime.behavior", observation: noFlow, events: [{ sequence: 12, trigger: "error" }],
    permissionStop: { consequence: "move_money", control: "matched" },
  }));
  assert.equal(evaluation.verdict, "failed");
  assert.equal(evaluation.flowCreated, false);
  assert.equal(honestRunVerdict(evaluation), "stopped_for_permission");
  const invariant = evaluation.invariants.find((each) => each.id === PERMISSION_STOP_INVARIANT);
  assert.ok(invariant && !invariant.passed);
  assert.match(invariant.actual, /^stopped_for_permission: asked permission to move_money at the task's declared control \(control matched\)/u);
  assert.deepEqual(invariant.evidenceSequences, [12]);
});

test("a permission stop cannot pass even if the runner's own verdict said passed", () => {
  // The defect this replaces: the runner passed the stop, and the evaluation copied that verdict.
  const evaluation = singleRunEvaluation(input({ observation: noFlow, permissionStop: { consequence: "delete", control: "unnamed" } }));
  assert.equal(evaluation.verdict, "failed");
  assert.equal(evaluation.failureCategory, "runtime.behavior");
  assert.equal(honestRunVerdict(evaluation), "stopped_for_permission");
});

test("a created Flow that met the task's goal passes", () => {
  const evaluation = singleRunEvaluation(input({}));
  assert.equal(evaluation.verdict, "passed");
  assert.equal(evaluation.flowCreated, true);
  assert.equal(honestRunVerdict(evaluation), "passed");
  assert.equal(evaluation.invariants.some((each) => each.id === PERMISSION_STOP_INVARIANT), false);
});

test("a pass streak and the summary totals never count a permission stop", () => {
  const verdicts: HonestRunVerdict[] = ["passed", "stopped_for_permission", "passed", "passed"];
  assert.equal(passStreak(verdicts), 2);
  assert.equal(passStreak(["passed", "passed", "stopped_for_permission"]), 0, "a stop ends a streak like a failure");
  assert.equal(passStreak(Array<HonestRunVerdict>(12).fill("stopped_for_permission")), 0, "twelve stops are not twelve passes");
  assert.deepEqual(verdictTotals([...verdicts, "failed", "inconclusive"]), { runs: 6, passed: 3, failed: 1, stoppedForPermission: 1, inconclusive: 1 });
  assert.deepEqual(verdictTotals(Array<HonestRunVerdict>(12).fill("stopped_for_permission")), { runs: 12, passed: 0, failed: 0, stoppedForPermission: 12, inconclusive: 0 });
});
