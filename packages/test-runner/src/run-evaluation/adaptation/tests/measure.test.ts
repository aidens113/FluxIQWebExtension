import assert from "node:assert/strict";
import test from "node:test";
import { measureRunAdaptations, adaptationIdsToRead, type RunAdaptationFacts } from "../measure.js";

const stamped = (id: string, adaptationIds: string[]) => ({ id, definitionId: "web.click", metadata: { adaptationIds } });
const stored = (status: string, fields: Record<string, unknown> = {}) => ({ status, riskLevel: "low", validationResults: [], metadata: { phase9: { baseRevision: 3, appliedRevision: status === "applied" ? 4 : undefined } }, ...fields });
const succeeded = (kind: "trial" | "replay", checkedAt: number) => ({ status: "succeeded", kind, checkedAt });

/** A replay of a Flow carrying one applied repair: its node ran, Core counted no call, and the run changed nothing. */
function replayFacts(overrides: Partial<RunAdaptationFacts> = {}, detail: Record<string, unknown> = {}): RunAdaptationFacts {
  return {
    runDetail: { summary: { runId: "run-2", projectId: "p" }, actionAttempts: [{ nodeId: "open" }, { nodeId: "save" }], interventions: [], adaptationIds: [], metadata: { llmGate: { costAccounting: { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 } } }, ...detail },
    graphs: [{ nodes: [{ id: "open", definitionId: "web.navigate" }, stamped("save", ["adaptation.repair-1"])] }],
    adaptations: new Map([["adaptation.repair-1", stored("applied", { validationResults: [succeeded("trial", 1), succeeded("replay", 2)] })]]),
    ...overrides,
  };
}

test("a run that executed an applied repair's stamped node with no call and no intervention records that reuse, graded by Core's own rule", () => {
  const measured = measureRunAdaptations(replayFacts());
  assert.deepEqual(measured.adaptationReuse, { exercisedAdaptationIds: ["adaptation.repair-1"], providerCalls: 0, interventions: 0, resume: null });
  assert.deepEqual(measured.adaptationValidation, { adaptations: [{ adaptationId: "adaptation.repair-1", tier: "provisional", trials: 1, replays: 1, lastFailure: null }] });
  assert.deepEqual(measured.adaptationPersistence, { adaptations: [{ adaptationId: "adaptation.repair-1", status: "applied", baseRevision: 3, appliedRevision: 4 }] });
  assert.deepEqual(measured.adaptationCost, { providerCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, reservedCalls: null });
});

test("a stamp is not reuse unless Core holds the change applied, and a change the run created itself is not reuse of it", () => {
  const stale = measureRunAdaptations(replayFacts({ adaptations: new Map([["adaptation.repair-1", stored("reverted")]]) }));
  assert.deepEqual(stale.adaptationReuse?.exercisedAdaptationIds, []);
  const own = measureRunAdaptations(replayFacts({}, { adaptationIds: ["adaptation.repair-1"] }));
  assert.deepEqual(own.adaptationReuse?.exercisedAdaptationIds, []);
  // Created, so still graded and still read from the store.
  assert.equal(own.adaptationPersistence?.adaptations.length, 1);
});

test("a run Core kept no accounting for states no provider count and no cost, which certifies nothing", () => {
  const measured = measureRunAdaptations(replayFacts({}, { metadata: {} }));
  assert.equal(measured.adaptationReuse?.providerCalls, null);
  assert.equal(measured.adaptationCost, null);
});

test("reserved calls are counted only when Core itemized every call", () => {
  const gate = (providerCalls: unknown[], omitted: number) => ({ metadata: { llmGate: { costAccounting: { calls: 2, inputTokens: 10, outputTokens: 5, totalTokens: 15, estimatedCostUsd: 0.01 }, providerCalls, providerCallsOmitted: omitted } } });
  const calls = [{ charged: { tokens: "reported", cost: "reported" } }, { charged: { tokens: "reserved", cost: "reported" } }];
  assert.equal(measureRunAdaptations(replayFacts({}, gate(calls, 0))).adaptationCost?.reservedCalls, 1);
  assert.equal(measureRunAdaptations(replayFacts({}, gate(calls.slice(1), 1))).adaptationCost?.reservedCalls, null);
});

test("a resumed run names the one point its resumable attempts agree on and the changes trialled there", () => {
  const detail = {
    adaptationIds: ["adaptation.trial-1"],
    metadata: {
      adaptiveRetry: { attempted: true, status: "succeeded", attemptCount: 3 },
      runtimePatchAttempts: [{ resumable: true, resumeFrom: { nodeId: "save", route: "main" }, adaptationId: "adaptation.trial-1" }, { resumable: false }],
    },
  };
  const adaptations = new Map([["adaptation.trial-1", stored("validated", { validationResults: [succeeded("trial", 1)] })]]);
  const measured = measureRunAdaptations(replayFacts({ graphs: [{ nodes: [] }], adaptations }, detail));
  assert.deepEqual(measured.adaptationReuse?.resume, { fromNodeId: "save", fromRoute: "main", status: "succeeded", attemptCount: 3, adaptationIds: ["adaptation.trial-1"] });
  assert.deepEqual(measured.adaptationPersistence?.adaptations, [{ adaptationId: "adaptation.trial-1", status: "validated", baseRevision: 3, appliedRevision: null }]);

  const disagreeing = { ...detail, metadata: { ...detail.metadata, runtimePatchAttempts: [...detail.metadata.runtimePatchAttempts, { resumable: true, resumeFrom: { nodeId: "other", route: "main" } }] } };
  assert.equal(measureRunAdaptations(replayFacts({ graphs: [{ nodes: [] }], adaptations }, disagreeing)).adaptationReuse?.resume, null);
});

test("persistence is unmeasured, not guessed, when a stored record states no base revision or an unknown status", () => {
  const noRevision = measureRunAdaptations(replayFacts({ adaptations: new Map([["adaptation.repair-1", { status: "applied", riskLevel: "low", metadata: {} }]]) }));
  assert.equal(noRevision.adaptationPersistence, null);
  // Validation still grades it: its results are Core's whether or not the revision was kept.
  assert.equal(noRevision.adaptationValidation?.adaptations.length, 1);
});

test("the ids to read are the created, the stamped on attempted nodes, and the trialled, each once", () => {
  const facts = replayFacts({}, { adaptationIds: ["adaptation.new"], actionAttempts: [{ nodeId: "save" }, { nodeId: "save" }] });
  assert.deepEqual(adaptationIdsToRead(facts.runDetail, facts.graphs), ["adaptation.new", "adaptation.repair-1"]);
});
