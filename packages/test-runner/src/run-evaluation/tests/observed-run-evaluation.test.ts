import assert from "node:assert/strict";
import test from "node:test";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import { evaluateObservedRun, type ObservedRun } from "../observed-run-evaluation.js";

const identity: ObservedRun["identity"] = { scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, expectedFailure: null };
const outcome: ObservedRun["outcome"] = { runId: "run-a", verdict: "passed", invariants: [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [3] }], metrics: {}, durationMs: 1_000 };
const flow: RunLaneObservation = { lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, actions: [] };
const recording: RunLaneObservation = { ...flow, lane: "recording", flowCreated: null };

test("the evidence sizes a lane measured reach the evaluation, copied rather than shared", () => {
  const evidence = { sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], truncationCount: 1 };
  const evaluation = evaluateObservedRun({ identity, outcome, observation: flow, evidence });
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], truncationCount: 1 });
  evidence.sanitizedPacketBytes.push(8_192);
  assert.deepEqual(evaluation.evidence.sanitizedPacketBytes, [2_048, 4_096]);
});

test("a run that passes no evidence sizes, as every recording-lane run does, records empty lists and no truncation", () => {
  assert.deepEqual(evaluateObservedRun({ identity, outcome, observation: recording }).evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 });
});

test("a size the evaluation contract rejects is refused, never published", () => {
  assert.throws(() => evaluateObservedRun({ identity, outcome, observation: flow, evidence: { sanitizedPacketBytes: [-1], rawSnapshotBytes: [], truncationCount: 0 } }), /sanitizedPacketBytes/u);
});
