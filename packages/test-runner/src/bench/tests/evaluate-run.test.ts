import assert from "node:assert/strict";
import test from "node:test";
import type { RunManifest } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { evaluateFailedAttempt, evaluateRecordingRun, type RecordingRunInput } from "../evaluate-run.js";

type ActionStatus = NonNullable<RunManifest["actions"]>[number]["status"];
const identity = { scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, expectedFailure: null };
// Only the fields an evaluation reads; the bench reads real manifests through parseRunManifestJson.
const manifest = (fields: Partial<RunManifest> = {}): RunManifest => ({ startedAt: "2026-09-11T10:00:00.000Z", finishedAt: "2026-09-11T10:00:42.500Z", automationFailure: null, actions: [], ...fields }) as RunManifest;
const action = (actionType: string, durationMs: number | undefined, status: ActionStatus = "succeeded") => ({ actionType, startedAt: "2026-09-11T10:00:10.000Z", ...(durationMs === undefined ? {} : { durationMs }), status });
const input = (fields: Partial<RecordingRunInput> = {}): RecordingRunInput => ({ ...identity, result: { runId: "run-a", verdict: "passed" }, manifest: manifest(), metrics: { steps: 5 }, finalSequence: 17, errorSequence: undefined, wallClockMs: 50_000, ...fields });

test("a passing recording-lane run: oracle passed, FluxIQ's probe succeeded, finished actions timed, provider-free", () => {
  const evaluation = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.browser.navigate", 1911), action("web.dom.type", 1553), action("web.dom.click", undefined, "running")] }) }));
  assert.equal(evaluation.verdict, "passed");
  assert.equal("failureCategory" in evaluation, false);
  assert.deepEqual(evaluation.invariants, [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [17] }]);
  assert.deepEqual([evaluation.lane, evaluation.flowCreated, evaluation.oracleVerdict], ["recording", null, "passed"]);
  assert.equal(evaluation.durationMs, 42_500);
  assert.deepEqual(evaluation.actions, [{ actionType: "web.browser.navigate", durationMs: 1911 }, { actionType: "web.dom.type", durationMs: 1553 }]);
  assert.deepEqual(evaluation.llm, { mode: "disabled", profileId: null, calls: 0 });
  assert.equal(evaluation.harnessActivations, 0);
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 });
  assert.deepEqual(evaluation.metrics, { steps: 5 });
  assert.deepEqual([evaluation.harnessRecovery, evaluation.adaptationCost, evaluation.adaptationValidation, evaluation.adaptationPersistence, evaluation.adaptationReuse], [null, null, null, null, null]);
});

test("an assertion failure is an oracle failure; a failure before the oracle leaves it unconsulted", () => {
  const oracle = evaluateRecordingRun(input({ result: { runId: "run-b", verdict: "failed", failureCategory: "runtime.behavior" }, errorSequence: 9 }));
  assert.deepEqual([oracle.verdict, oracle.failureCategory, oracle.oracleVerdict], ["failed", "runtime.behavior", "failed"]);
  assert.deepEqual(oracle.invariants, [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: runtime.behavior", evidenceSequences: [9] }]);
  const rig = evaluateRecordingRun(input({ result: { runId: "run-c", verdict: "failed", failureCategory: "gateway.pairing" } }));
  assert.deepEqual([rig.failureCategory, rig.oracleVerdict], ["gateway.pairing", null]);
  const unclassified = evaluateRecordingRun(input({ result: { runId: "run-d", verdict: "failed", failureCategory: "not-a-category" } }));
  assert.equal(unclassified.failureCategory, "unknown");
});

test("the test-rig category and the automation's own failure stay on separate axes", () => {
  // `failureCategory` says why the facility could not produce a trustworthy run. Core's adaptive
  // failure classes and the domain's `web.*` codes describe the automation instead, and reach the
  // evaluation only through `automationFailureReported`; arriving here, either reads as `unknown`.
  for (const foreign of ["target_not_found", "web.target.not_found", "ambiguous_or_unknown"]) {
    assert.equal(evaluateRecordingRun(input({ result: { runId: "run-e", verdict: "failed", failureCategory: foreign } })).failureCategory, "unknown");
  }
  const both = evaluateRecordingRun(input({
    result: { runId: "run-f", verdict: "failed", failureCategory: "runtime.behavior" },
    manifest: manifest({ actions: [action("web.dom.click", 12, "failed")], automationFailure: { category: "target_not_found", code: "web.target.not_found" } }),
  }));
  assert.deepEqual([both.failureCategory, both.automationFailureReported], ["runtime.behavior", { category: "target_not_found", code: "web.target.not_found" }]);
});

test("FluxIQ's reported verdict comes from the probe's actions and automation failure", () => {
  const categorised = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.dom.type", 10, "failed")], automationFailure: { category: "target_not_found", code: "web.target.not_found" } }) }));
  assert.deepEqual([categorised.reportedVerdict, categorised.automationFailureReported], ["failed", { category: "target_not_found", code: "web.target.not_found" }]);
  const uncategorised = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.dom.type", 10, "timed_out")] }) }));
  assert.deepEqual([uncategorised.reportedVerdict, uncategorised.automationFailureReported], ["failed", { category: "ambiguous_or_unknown" }]);
  const succeeded = evaluateRecordingRun(input({ manifest: manifest({ actions: [action("web.dom.type", 10)] }) }));
  assert.deepEqual([succeeded.reportedVerdict, succeeded.automationFailureReported], ["passed", null]);
  const nothingRan = evaluateRecordingRun(input({ manifest: manifest({ actions: [] }) }));
  assert.deepEqual([nothingRan.reportedVerdict, nothingRan.automationFailureReported], [null, null]);
  const unobserved = manifest({ actions: [action("web.dom.type", 10)] });
  delete (unobserved as { automationFailure?: unknown }).automationFailure;
  assert.equal(evaluateRecordingRun(input({ manifest: unobserved })).reportedVerdict, null);
});

test("without run.json the bench's wall clock is the duration and FluxIQ's verdict is unknown", () => {
  const evaluation = evaluateRecordingRun(input({ manifest: undefined }));
  assert.deepEqual([evaluation.durationMs, evaluation.reportedVerdict, evaluation.actions], [50_000, null, []]);
});

test("an expected failure travels with the run; a runner that throws is inconclusive, never a pass", () => {
  const negative = evaluateRecordingRun(input({ variantId: "expired", expectedFailure: { category: "auth_required" } }));
  assert.deepEqual([negative.variantId, negative.automationFailureExpected], ["expired", { category: "auth_required" }]);
  const thrown = evaluateFailedAttempt({ ...identity, repeatIndex: 1, attemptId: "bench-x-r1-0", error: new RunnerFailure("environment.missing", "Scenario Lab build is missing"), wallClockMs: 12 });
  assert.deepEqual([thrown.runId, thrown.verdict, thrown.failureCategory, thrown.oracleVerdict, thrown.reportedVerdict, thrown.durationMs, thrown.repeatIndex], ["bench-x-r1-0", "inconclusive", "environment.missing", null, null, 12, 1]);
  assert.equal(thrown.invariants[0]?.passed, false);
});
