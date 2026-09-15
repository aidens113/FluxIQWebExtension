import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractValidationError,
  CANDIDATE_COMPARISON_SCHEMA_VERSION,
  assertRunEvaluation,
  evaluationLanes,
  facilityFailureBoundaries,
  facilityFailureCauseCodes,
  facilityFailureOperationStages,
  facilityFailureReasons,
  facilityFailureStages,
  llmUsageModes,
  parseRunEvaluationJson,
  validateLlmUsage,
  validateRunEvaluation,
} from "../dist/index.js";

const week2 = { harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null };
const disabledLlm = { mode: "disabled", profileId: null, calls: 0 };

// A Flow-lane replay of W26 `no-context`: FluxIQ failed, as the variant expects, and classified the failure correctly.
const flowRun = () => ({
  schemaVersion: "0.2", runId: "run-w26-no-context-2", verdict: "passed", facilityFailure: null,
  invariants: [{ id: "failure-classified", passed: true, expected: "target_ambiguous", actual: "target_ambiguous", evidenceSequences: [3] }], metrics: {},
  scenarioId: "ambiguous-targets", workflowId: null, variantId: "no-context", repeatIndex: 1, lane: "flow", flowCreated: true,
  oracleVerdict: "failed", reportedVerdict: "failed",
  automationFailureReported: { category: "target_ambiguous", code: "multiple-candidates" },
  automationFailureExpected: { category: "target_ambiguous" },
  harnessActivations: 0, durationMs: 1840.5,
  actions: [{ actionType: "web.dom.click", durationMs: 120 }, { actionType: "web.dom.extract", durationMs: 35.25 }],
  evidence: { sanitizedPacketBytes: [2048, 1024], rawSnapshotBytes: [65536], truncationCount: 0 },
  llm: disabledLlm, ...week2,
});
// The recording lane of W01: the Testing Lab drove the script; no Flow exists and FluxIQ reported nothing.
const recordingRun = () => ({
  ...flowRun(), runId: "run-basic-form-0", scenarioId: "basic-form", variantId: null, repeatIndex: 0, lane: "recording", flowCreated: null,
  invariants: [{ id: "final-state", passed: true, expected: "submitted", actual: "submitted", evidenceSequences: [] }],
  oracleVerdict: "passed", reportedVerdict: null, automationFailureReported: null, automationFailureExpected: null, actions: [],
});
const without = (value, key) => { const copy = { ...value }; delete copy[key]; return copy; };
const issuesOf = (value) => { const checked = validateRunEvaluation(value); return checked.valid ? [] : checked.issues.map((issue) => issue.path); };
const rejects = (value, label) => assert.equal(validateRunEvaluation(value).valid, false, label);
const facilityRun = (facilityFailure = { boundary: "no-final-bundle", stage: "scenario.execute", reason: "unclassified" }) => ({
  ...flowRun(), verdict: "inconclusive", failureCategory: "unknown", facilityFailure,
  flowCreated: false, oracleVerdict: null, reportedVerdict: null, automationFailureReported: null, actions: [],
});

test("run evaluations write schema 0.2 while CandidateComparison remains 0.1", () => {
  assert.equal(flowRun().schemaVersion, "0.2");
  assert.equal(CANDIDATE_COMPARISON_SCHEMA_VERSION, "0.1");
});

test("the JSON reader explicitly normalizes legacy schema 0.1 evaluations", () => {
  const legacy = without({ ...flowRun(), schemaVersion: "0.1" }, "facilityFailure");
  assert.deepEqual(validateRunEvaluation(legacy), { valid: true, value: { ...legacy, schemaVersion: "0.2", facilityFailure: null } });
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(legacy)), { ...legacy, schemaVersion: "0.2", facilityFailure: null });
  assert.throws(() => assertRunEvaluation(legacy), ContractValidationError);
  assert.throws(() => parseRunEvaluationJson(JSON.stringify({ ...legacy, facilityFailure: null })), ContractValidationError);
});

test("facility failures use only the closed diagnostic vocabulary", () => {
  for (const boundary of facilityFailureBoundaries) assert.equal(validateRunEvaluation(facilityRun({ boundary, stage: "scenario.execute", reason: "unclassified" })).valid, true);
  for (const stage of facilityFailureStages) assert.equal(validateRunEvaluation(facilityRun({ boundary: "no-final-bundle", stage, reason: "unclassified" })).valid, true);
  const reasonExamples = {
    "readiness.timeout": { operationStage: "scenario.health", timeoutMs: 60_000 },
    "http.timeout": { operationStage: "auth.login", timeoutMs: 30_000 },
    "http.abort": { operationStage: "project.select" },
    "http.transport": { operationStage: "control.request", causeCode: "ECONNRESET" },
    "module.missing": { causeCode: "ERR_MODULE_NOT_FOUND" },
    "path.missing": { causeCode: "ENOENT" },
    "path.denied": { causeCode: "EACCES" },
    unclassified: {},
  };
  for (const reason of facilityFailureReasons) assert.equal(validateRunEvaluation(facilityRun({ boundary: "no-final-bundle", stage: "scenario.load", reason, ...reasonExamples[reason] })).valid, true, reason);
  for (const operationStage of facilityFailureOperationStages) {
    const readiness = operationStage === "scenario.health" || operationStage === "core.health";
    const diagnostic = { boundary: "finalized-bundle", stage: "scenario.execute", reason: readiness ? "readiness.timeout" : "http.abort", operationStage, ...(readiness ? { timeoutMs: 1 } : {}) };
    assert.equal(validateRunEvaluation(facilityRun(diagnostic)).valid, true, operationStage);
  }
  for (const causeCode of facilityFailureCauseCodes) {
    const diagnostic = causeCode === "ENOENT" ? { boundary: "no-final-bundle", stage: "scenario.load", reason: "path.missing", causeCode }
      : causeCode === "EACCES" || causeCode === "EPERM" ? { boundary: "no-final-bundle", stage: "scenario.load", reason: "path.denied", causeCode }
      : causeCode.startsWith("ERR_") || causeCode === "MODULE_NOT_FOUND" ? { boundary: "no-final-bundle", stage: "scenario.load", reason: "module.missing", causeCode }
      : { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.transport", operationStage: "control.request", causeCode };
    assert.equal(validateRunEvaluation(facilityRun(diagnostic)).valid, true, causeCode);
  }
  rejects(facilityRun({ boundary: "no-final-bundle", stage: "scenario.load", reason: "module.missing", causeCode: "ECONNRESET" }), "transport code paired as missing module");
  rejects(facilityRun({ boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.transport", operationStage: "control.request", causeCode: "ERR_MODULE_NOT_FOUND" }), "module code paired as HTTP transport");
});

test("facility diagnostics reject raw shapes, unknown values, and invalid pairings", () => {
  const base = facilityRun().facilityFailure;
  for (const mutation of [
    { ...base, boundary: "partial-bundle" }, { ...base, stage: "private.stage" }, { ...base, reason: "raw-error" },
    { ...base, operationStage: "private.request" }, { ...base, causeCode: "RAW_SENTINEL" },
    { ...base, timeoutMs: 0 }, { ...base, timeoutMs: 300_001 }, { ...base, timeoutMs: 1.5 },
    { ...base, message: "RAW_SENTINEL" }, { ...base, path: "RAW_SENTINEL" }, { ...base, url: "RAW_SENTINEL" },
    { ...base, body: "RAW_SENTINEL" }, { ...base, password: "RAW_SENTINEL" },
  ]) rejects(facilityRun(mutation), JSON.stringify(mutation));
  rejects({ ...flowRun(), facilityFailure: facilityRun().facilityFailure }, "pass with facility failure");
  rejects(without(flowRun(), "facilityFailure"), "missing required nullable field");
  rejects({ ...facilityRun(), failureCategory: undefined }, "diagnostic without facility category");
  rejects({ ...facilityRun(), reportedVerdict: "failed", automationFailureReported: { category: "timeout" } }, "facility diagnostic with automation result");
  rejects({ ...facilityRun(), facilityFailure: null }, "synthetic inconclusive evaluation without diagnostic");
});

test("a Flow-lane evaluation carries every per-run measurement the Metrics table needs", () => {
  assert.deepEqual([...evaluationLanes], ["recording", "flow"]);
  assert.deepEqual([...llmUsageModes], ["disabled", "deterministic-dry", "live"]);
  const run = flowRun();
  assert.doesNotThrow(() => assertRunEvaluation(run));
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(run)), run);
  // Failure classification accuracy compares the reported and expected automation failures.
  assert.equal(run.automationFailureReported.category, run.automationFailureExpected.category);
});

test("the recording lane creates no Flow; the Flow lane records whether it did", () => {
  assert.equal(validateRunEvaluation(recordingRun()).valid, true);
  rejects({ ...recordingRun(), flowCreated: true }, "recording lane with a Flow");
  rejects({ ...flowRun(), flowCreated: null }, "flow lane without flowCreated");
  rejects({ ...flowRun(), flowCreated: "yes" }, "non-boolean flowCreated");
  const notCreated = { ...flowRun(), flowCreated: false, reportedVerdict: null, automationFailureReported: null, actions: [] };
  assert.equal(validateRunEvaluation(notCreated).valid, true);
  rejects({ ...notCreated, reportedVerdict: "failed", automationFailureReported: { category: "ambiguous_or_unknown" } }, "a FluxIQ verdict without a Flow");
});

test("false failure and false success are derivable from the oracle and FluxIQ verdicts", () => {
  const falseFailure = {
    ...flowRun(), variantId: null, verdict: "failed", failureCategory: "runtime.behavior",
    invariants: [{ id: "reported-success", passed: false, expected: "passed", actual: "failed", evidenceSequences: [4] }],
    oracleVerdict: "passed", reportedVerdict: "failed", automationFailureReported: { category: "timeout" }, automationFailureExpected: null,
  };
  const falseSuccess = { ...falseFailure, oracleVerdict: "failed", reportedVerdict: "passed", automationFailureReported: null };
  for (const run of [falseFailure, falseSuccess]) assert.equal(validateRunEvaluation(run).valid, true);
  const classify = (run) => run.oracleVerdict === "passed" && run.reportedVerdict === "failed" ? "false-failure"
    : run.oracleVerdict === "failed" && run.reportedVerdict === "passed" ? "false-success" : "agreed";
  assert.deepEqual([falseFailure, falseSuccess, flowRun()].map(classify), ["false-failure", "false-success", "agreed"]);
});

test("the automation failure and the test-rig failure use separate taxonomies", () => {
  assert.deepEqual(issuesOf({ ...flowRun(), automationFailureReported: { category: "action.targeting" } }), ["$.automationFailureReported.category"]);
  assert.deepEqual(issuesOf({ ...flowRun(), automationFailureExpected: { category: "runtime.behavior" } }), ["$.automationFailureExpected.category"]);
  const rigFailure = { ...flowRun(), verdict: "failed", invariants: [{ id: "gateway-up", passed: false, expected: "connected", actual: "refused", evidenceSequences: [] }] };
  assert.deepEqual(issuesOf({ ...rigFailure, failureCategory: "target_not_found" }), ["$.failureCategory"]);
  assert.equal(validateRunEvaluation({ ...rigFailure, failureCategory: "gateway.connection" }).valid, true);
  rejects({ ...flowRun(), automationFailureReported: { category: "timeout", code: "" } }, "empty failure code");
  rejects({ ...flowRun(), automationFailureReported: { category: "timeout", detail: "x" } }, "unknown failure property");
});

test("FluxIQ's reported verdict and reported failure agree", () => {
  assert.deepEqual(issuesOf({ ...flowRun(), automationFailureReported: null }), ["$.automationFailureReported"]);
  assert.deepEqual(issuesOf({ ...flowRun(), reportedVerdict: "passed" }), ["$.automationFailureReported"]);
  assert.deepEqual(issuesOf({ ...flowRun(), reportedVerdict: null }), ["$.automationFailureReported"]);
  rejects({ ...flowRun(), reportedVerdict: "succeeded" }, "unknown reported verdict");
  rejects({ ...flowRun(), oracleVerdict: "inconclusive" }, "unknown oracle verdict");
});

test("identity, repeat index, lane, and measurements are bounded", () => {
  for (const [label, mutation] of Object.entries({
    "scenario id": { scenarioId: "Ambiguous Targets" },
    "workflow id": { workflowId: "" },
    "variant id": { variantId: 3 },
    "negative repeat": { repeatIndex: -1 },
    "fractional repeat": { repeatIndex: 0.5 },
    "unknown lane": { lane: "llm" },
    "fractional activations": { harnessActivations: 1.5 },
    "negative duration": { durationMs: -1 },
    "unnamed action": { actions: [{ actionType: "", durationMs: 1 }] },
    "infinite action": { actions: [{ actionType: "web.dom.click", durationMs: Number.POSITIVE_INFINITY }] },
    "extra action property": { actions: [{ actionType: "web.dom.click", durationMs: 1, selector: "#save" }] },
    "fractional packet": { evidence: { sanitizedPacketBytes: [1.5], rawSnapshotBytes: [], truncationCount: 0 } },
    "negative snapshot": { evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [-1], truncationCount: 0 } },
    "negative truncation": { evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: -1 } },
    "extra evidence property": { evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0, rawHtml: "<p>" } },
    "unknown property": { corpusRowId: "W26" },
  })) rejects({ ...flowRun(), ...mutation }, label);
  for (const key of [
    "scenarioId", "workflowId", "variantId", "repeatIndex", "lane", "flowCreated", "oracleVerdict", "reportedVerdict",
    "automationFailureReported", "automationFailureExpected", "harnessActivations", "durationMs", "actions", "evidence", "llm",
  ]) rejects(without(flowRun(), key), `missing ${key}`);
  // A harness activation with the provider disabled is a measured Week 1 failure, so the contract must be able to record one.
  assert.equal(validateRunEvaluation({ ...flowRun(), harnessActivations: 2 }).valid, true);
});

test("Week 2 fields are present and null", () => {
  for (const key of Object.keys(week2)) {
    rejects({ ...flowRun(), [key]: 0 }, `${key} set`);
    rejects(without(flowRun(), key), `${key} missing`);
  }
});

test("LLM usage keeps a disabled provider disabled", () => {
  assert.equal(validateLlmUsage(disabledLlm).valid, true);
  assert.equal(validateLlmUsage({ mode: "live", profileId: "deepseek-lab", calls: 2 }).valid, true);
  assert.equal(validateLlmUsage({ mode: "deterministic-dry", profileId: "deterministic-dry", calls: 0 }).valid, true);
  for (const usage of [
    { ...disabledLlm, profileId: "deepseek-lab" },
    { ...disabledLlm, calls: 1 },
    { mode: "live", profileId: null, calls: 1 },
    { mode: "live", profileId: "DeepSeek Lab", calls: 1 },
    { mode: "deterministic-dry", profileId: "deterministic-dry", calls: 1 },
    { mode: "cloud", profileId: "cloud", calls: 0 },
    { ...disabledLlm, calls: -1 },
    { ...disabledLlm, tokens: 10 },
  ]) assert.equal(validateLlmUsage(usage).valid, false, JSON.stringify(usage));
  assert.deepEqual(issuesOf({ ...flowRun(), llm: { ...disabledLlm, calls: 1 } }), ["$.llm.calls"]);
});

test("the test-rig verdict rules still hold and malformed JSON is a contract error", () => {
  rejects({ ...flowRun(), failureCategory: "unknown" }, "passed verdict with a rig failure");
  rejects({ ...flowRun(), verdict: "failed" }, "failed verdict without a failed invariant or rig failure");
  assert.throws(() => parseRunEvaluationJson("{"), ContractValidationError);
  assert.throws(() => assertRunEvaluation({ ...flowRun(), lane: "llm" }), ContractValidationError);
});
