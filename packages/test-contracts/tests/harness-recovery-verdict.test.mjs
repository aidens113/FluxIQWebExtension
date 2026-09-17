import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { assertRunEvaluation, parseRunEvaluationJson, validateRunEvaluation, validateRunHarnessRecovery } = contracts;

const ADAPTATION = "adaptation.run-mu4nxysj-3234c535.temporary_target_override.1789000000000";
const PROPOSAL = "proposal.adaptation.run-mu4nxysj-3234c535.temporary_target_override.1789000000001";
// A card number: the kind of page value no evaluation may carry, and no refusal may quote.
const PLANTED = "4242424242424242";

// Lab proof 1: a repair naming the renamed Save, executed and verified by the scenario's later assert step;
// a repair naming Discard, contradicted by that assert; and a target override Core only proposed.
const recovered = () => ({
  attempted: true,
  interventions: [
    { kind: "diagnosis", validationOk: true, validationCodes: [] },
    { kind: "runtime_patch", validationOk: true, validationCodes: [] },
  ],
  runtimePatchAttempts: [
    { kind: "temporary_target_override", proposalOnly: false, executed: null, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: false, verdict: { outcome: "verified", basis: ["downstream_assertion"] } },
    { kind: "temporary_target_override", proposalOnly: false, executed: null, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: false, verdict: { outcome: "contradicted", basis: [] } },
    { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: false, changeProposalCreated: true, verdict: { outcome: "not_executed", basis: [] } },
    { kind: null, proposalOnly: null, executed: null, preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], adaptationCreated: false, changeProposalCreated: false, verdict: null },
  ],
  adaptationIds: [ADAPTATION],
  changeProposalIds: [PROPOSAL],
});
const flowRun = (harnessRecovery) => ({
  schemaVersion: "0.3", runId: "run-identity-drift-renamed-redesign-0", verdict: "passed", facilityFailure: null,
  invariants: [{ id: "final-state", passed: true, expected: "saved", actual: "saved", evidenceSequences: [4] }], metrics: {},
  scenarioId: "identity-drift", workflowId: null, variantId: "renamed-redesign", repeatIndex: 0, lane: "flow", flowCreated: true,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 2, durationMs: 9120, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: { mode: "live", profileId: "deepseek-lab", calls: 3 }, extraction: null,
  harnessRecovery, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null,
});
const issuesOf = (recovery) => { const checked = validateRunHarnessRecovery(recovery); return checked.valid ? [] : checked.issues.map((issue) => issue.path); };
const withAttempt = (index, change) => { const recovery = recovered(); change(recovery.runtimePatchAttempts[index]); return recovery; };

test("the verdict outcomes and the evidence a verified change may rest on are exported", () => {
  assert.deepEqual(contracts.harnessChangeVerdictOutcomes, ["verified", "contradicted", "unverifiable", "not_executed"]);
  assert.deepEqual(contracts.harnessChangeVerdictBases, ["expected_state", "expected_route", "expected_outputs", "records", "downstream_assertion"]);
});

test("each patch attempt carries Core's verdict on its trial, and the record round-trips", () => {
  assert.deepEqual(validateRunHarnessRecovery(recovered()), { valid: true, value: recovered() });
  const evaluation = flowRun(recovered());
  assert.doesNotThrow(() => assertRunEvaluation(evaluation));
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
  assert.deepEqual(evaluation.harnessRecovery.runtimePatchAttempts.map((attempt) => attempt.verdict?.outcome ?? null), ["verified", "contradicted", "not_executed", null]);
});

test("a record written before the verdict existed still reads, with the verdict unmeasured", () => {
  const older = recovered();
  for (const attempt of older.runtimePatchAttempts) delete attempt.verdict;
  assert.deepEqual(issuesOf(older), []);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(flowRun(older))).harnessRecovery, older);
  assert.equal(Object.hasOwn(parseRunEvaluationJson(JSON.stringify(flowRun(older))).harnessRecovery.runtimePatchAttempts[0], "verdict"), false);
});

test("verified names its evidence, and nothing else may", () => {
  // A change whose node merely succeeded is unverifiable, never verified: success is not evidence.
  assert.deepEqual(issuesOf(withAttempt(0, (attempt) => { attempt.verdict.basis = []; })), ["$.runtimePatchAttempts[0].verdict.basis"]);
  assert.deepEqual(issuesOf(withAttempt(1, (attempt) => { attempt.verdict.basis = ["downstream_assertion"]; })), ["$.runtimePatchAttempts[1].verdict.basis"]);
  assert.deepEqual(issuesOf(withAttempt(0, (attempt) => { attempt.verdict = { outcome: "unverifiable", basis: [] }; })), []);
  assert.deepEqual(issuesOf(withAttempt(0, (attempt) => { attempt.verdict.basis = ["records", "expected_route", "downstream_assertion"]; })), []);
  // `changed_node_succeeded` and `continuation` are checks Core runs, never a basis for a verdict.
  for (const check of ["changed_node_succeeded", "continuation"]) {
    assert.deepEqual(issuesOf(withAttempt(0, (attempt) => { attempt.verdict.basis = [check]; })), ["$.runtimePatchAttempts[0].verdict.basis[0]"], check);
  }
  assert.deepEqual(issuesOf(withAttempt(0, (attempt) => { attempt.verdict.basis = ["records", "records"]; })), ["$.runtimePatchAttempts[0].verdict.basis"]);
});

test("a verdict cannot claim a trial that the attempt says never ran, or deny one that did", () => {
  for (const [label, change] of Object.entries({
    "only proposed": (attempt) => { attempt.proposalOnly = true; },
    "not executed": (attempt) => { attempt.executed = false; },
    "refused at preflight": (attempt) => { attempt.preflightOk = false; },
  })) {
    for (const outcome of ["verified", "contradicted", "unverifiable"]) {
      const recovery = withAttempt(0, (attempt) => { change(attempt); attempt.verdict = { outcome, basis: outcome === "verified" ? ["records"] : [] }; });
      assert.deepEqual(issuesOf(recovery), ["$.runtimePatchAttempts[0].verdict.outcome"], `${label}: ${outcome}`);
    }
  }
  assert.deepEqual(issuesOf(withAttempt(2, (attempt) => { attempt.executed = true; attempt.proposalOnly = false; })), ["$.runtimePatchAttempts[2].verdict.outcome"]);
  // Core states `executed` only for a proposal today, so an executed trial reads `executed: null` beside its verdict.
  assert.deepEqual(issuesOf(withAttempt(0, (attempt) => { attempt.executed = true; })), []);
});

test("a verdict carries closed words only, never Core's sentence or page text", () => {
  for (const [path, change] of Object.entries({
    "$.runtimePatchAttempts[0].verdict.outcome": (attempt) => { attempt.verdict.outcome = "recovered"; },
    "$.runtimePatchAttempts[0].verdict.basis[0]": (attempt) => { attempt.verdict.basis[0] = `saw ${PLANTED} on the page`; },
    "$.runtimePatchAttempts[0].verdict.basis": (attempt) => { attempt.verdict.basis = "downstream_assertion"; },
    "$.runtimePatchAttempts[0].verdict.reason": (attempt) => { attempt.verdict.reason = `The Save button read ${PLANTED}`; },
    "$.runtimePatchAttempts[0].verdict.checks": (attempt) => { attempt.verdict.checks = []; },
    "$.runtimePatchAttempts[0].verdict": (attempt) => { attempt.verdict = "verified"; },
  })) {
    const recovery = withAttempt(0, change);
    assert.ok(issuesOf(recovery).includes(path), `${path}: ${JSON.stringify(issuesOf(recovery))}`);
    for (const issue of validateRunEvaluation(flowRun(recovery)).issues) assert.equal(issue.message.includes(PLANTED), false, `${path}: a refusal never quotes the value it refused`);
  }
});

test("the identifier and kind shapes the recovery record checks are shared", () => {
  assert.equal(contracts.isCoreIdentifier(ADAPTATION), true);
  for (const value of ["", `adaptation ${PLANTED}`, "-leading", 7, null, "a".repeat(257)]) assert.equal(contracts.isCoreIdentifier(value), false, JSON.stringify(value));
  assert.equal(contracts.isCoreKind("temporary_target_override"), true);
  for (const value of ["Temporary", "temporary target", "temporary-target", "", 3, "a".repeat(65)]) assert.equal(contracts.isCoreKind(value), false, JSON.stringify(value));
});
