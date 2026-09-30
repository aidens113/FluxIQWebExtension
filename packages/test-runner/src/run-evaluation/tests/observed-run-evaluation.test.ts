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
  const evidence: FlowLaneEvidence = {
    sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], truncationCount: 1,
    packets: [{ actionPosition: 1, point: "beforeAction", bytes: 2_048, truncated: false }, { actionPosition: 1, point: "afterAction", bytes: 4_096, truncated: true }],
  };
  const evaluation = evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, evidence });
  // Only the contract's fields: the located packets are the budget check's input, not evaluation output.
  assert.deepEqual(evaluation.evidence, { sanitizedPacketBytes: [2_048, 4_096], rawSnapshotBytes: [], truncationCount: 1 });
  evidence.sanitizedPacketBytes.push(8_192);
  assert.deepEqual(evaluation.evidence.sanitizedPacketBytes, [2_048, 4_096]);
});

test("a run that passes no evidence sizes, as every recording-lane run does, records empty lists and no truncation", () => {
  assert.deepEqual(evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: recording }).evidence, { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 });
});

test("a size the evaluation contract rejects is refused, never published", () => {
  assert.throws(() => evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, evidence: { sanitizedPacketBytes: [-1], rawSnapshotBytes: [], truncationCount: 0, packets: [] } }), /sanitizedPacketBytes/u);
});

const measuredReplay = {
  adaptationReuse: { exercisedAdaptationIds: ["adaptation.a"], providerCalls: 0, interventions: 0, resume: null },
  adaptationValidation: { adaptations: [{ adaptationId: "adaptation.a", tier: "provisional" as const, trials: 1, replays: 0, lastFailure: null }] },
  adaptationPersistence: { adaptations: [{ adaptationId: "adaptation.a", status: "applied" as const, baseRevision: 2, appliedRevision: 3 }] },
  adaptationCost: { providerCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, reservedCalls: null },
};

test("a Flow that ran records the adaptation measurements its lane read from Core; any other run records them unmeasured", () => {
  const evaluation = evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, adaptation: measuredReplay });
  assert.deepEqual([evaluation.adaptationReuse, evaluation.adaptationValidation, evaluation.adaptationPersistence, evaluation.adaptationCost], [measuredReplay.adaptationReuse, measuredReplay.adaptationValidation, measuredReplay.adaptationPersistence, measuredReplay.adaptationCost]);
  for (const observation of [recording, { ...flow, flowCreated: false, reportedVerdict: null }]) {
    const unmeasured = evaluateObservedRun({ identity, facilityFailure: null, outcome, observation, adaptation: measuredReplay });
    assert.deepEqual([unmeasured.adaptationReuse, unmeasured.adaptationValidation, unmeasured.adaptationPersistence, unmeasured.adaptationCost], [null, null, null, null]);
  }
});

test("a provider count on a run that configured no live provider contradicts the run, so the two records stating it are left unmeasured instead of failing it", () => {
  const contradicted = { ...measuredReplay, adaptationReuse: { ...measuredReplay.adaptationReuse, providerCalls: 2 }, adaptationCost: { ...measuredReplay.adaptationCost, providerCalls: 2 } };
  const evaluation = evaluateObservedRun({ identity, facilityFailure: null, outcome, observation: flow, adaptation: contradicted });
  assert.deepEqual([evaluation.adaptationReuse, evaluation.adaptationCost], [null, null]);
  assert.deepEqual(evaluation.adaptationPersistence, measuredReplay.adaptationPersistence);
});
