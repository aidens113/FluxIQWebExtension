import assert from "node:assert/strict";
import test from "node:test";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import type { FlowLaneEvidence } from "../flow-lane-evidence-sizes.js";
import { evaluateObservedRun, type ObservedRun } from "../observed-run-evaluation.js";

const identity: ObservedRun["identity"] = { scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, expectedFailure: null };
const outcome: ObservedRun["outcome"] = { runId: "run-a", verdict: "passed", invariants: [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [3] }], metrics: {}, durationMs: 1_000 };
const flow: RunLaneObservation = { lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, actions: [], extraction: null };
const recording: RunLaneObservation = { ...flow, lane: "recording", flowCreated: null };

test("the evidence sizes a lane measured reach the evaluation, copied rather than shared", () => {
  // The second packet counted its composition and the first did not, which is
  // the pair a bundle actually holds while older runs are still being read.
  const composition = { included: { "1": 2, "2": 9 }, dropped: { "1": 14, "6": 220 } };
  const evidence: FlowLaneEvidence = {
    sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], packetComposition: [null, composition], truncationCount: 1,
    packets: [{ actionPosition: 1, point: "beforeAction", bytes: 2_048, truncated: false, composition: null }, { actionPosition: 1, point: "afterAction", bytes: 4_096, truncated: true, composition }],
  };
  const evaluation = evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, evidence });
  // Only the contract's fields: the located packets are the budget check's input, not evaluation output.
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], packetComposition: [null, composition], truncationCount: 1 });
  evidence.sanitizedPacketBytes.push(8_192);
  evidence.packetComposition.push(null);
  assert.deepEqual(evaluation.evidence.sanitizedPacketBytes, [2_048, 4_096]);
  assert.deepEqual(evaluation.evidence.packetComposition, [null, composition]);
});

test("a run that passes no evidence sizes, as every recording-lane run does, records empty lists and no truncation", () => {
  assert.deepEqual(evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: recording }).evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], packetComposition: [], truncationCount: 0 });
});

test("a size the evaluation contract rejects is refused, never published", () => {
  assert.throws(() => evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, evidence: { sanitizedPacketBytes: [-1], rawSnapshotBytes: [], packetComposition: [null], truncationCount: 0, packets: [] } }), /sanitizedPacketBytes/u);
});
