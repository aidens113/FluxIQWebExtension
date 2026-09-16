import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractValidationError,
  CANDIDATE_COMPARISON_SCHEMA_VERSION,
  EVALUATION_SCHEMA_VERSION,
  assertRunEvaluation,
  evaluationLanes,
  extractionMeasurementStatuses,
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
  schemaVersion: "0.3", runId: "run-w26-no-context-2", verdict: "passed", facilityFailure: null,
  invariants: [{ id: "failure-classified", passed: true, expected: "target_ambiguous", actual: "target_ambiguous", evidenceSequences: [3] }], metrics: {},
  scenarioId: "ambiguous-targets", workflowId: null, variantId: "no-context", repeatIndex: 1, lane: "flow", flowCreated: true,
  oracleVerdict: "failed", reportedVerdict: "failed",
  automationFailureReported: { category: "target_ambiguous", code: "multiple-candidates" },
  automationFailureExpected: { category: "target_ambiguous" },
  harnessActivations: 0, durationMs: 1840.5,
  actions: [{ actionType: "web.dom.click", durationMs: 120 }, { actionType: "web.dom.extract", durationMs: 35.25 }],
  evidence: { sanitizedPacketBytes: [2048, 1024], rawSnapshotBytes: [65536], truncationCount: 0 },
  llm: disabledLlm, extraction: null, ...week2,
});
// A paginated list extraction step, judged: 24 of 24 expected records read over three pages, every one of them compared, every expected field present.
const measurement = (overrides = {}) => ({
  stepIndex: 2, status: "judged", expectedRecords: 24, observedRecords: 24, recordsListed: true, countStated: true, comparedRecords: 24, matchedRecords: 24,
  expectedFields: 3, presentFields: 3, unexpectedFields: 0, expectedPages: 3, pagesFollowed: 3, truncated: false, durationMs: 412.5, nonStringValues: 0, ...overrides,
});
const extractionRun = (measurements = [measurement()]) => ({ ...flowRun(), extraction: measurements });
// A card number: the kind of page value D6 keeps out of every evaluation.
const PLANTED = "4242424242424242";
// The recording lane of W01: the Testing Lab drove the script; no Flow exists and FluxIQ reported nothing.
const recordingRun = () => ({
  ...flowRun(), runId: "run-basic-form-0", scenarioId: "basic-form", variantId: null, repeatIndex: 0, lane: "recording", flowCreated: null,
  invariants: [{ id: "final-state", passed: true, expected: "submitted", actual: "submitted", evidenceSequences: [] }],
  oracleVerdict: "passed", reportedVerdict: null, automationFailureReported: null, automationFailureExpected: null, actions: [],
});
const without = (value, key) => { const copy = { ...value }; delete copy[key]; return copy; };
const issuesOf = (value) => { const checked = validateRunEvaluation(value); return checked.valid ? [] : checked.issues.map((issue) => issue.path); };
const messagesAt = (value, path) => { const checked = validateRunEvaluation(value); return checked.valid ? [] : checked.issues.filter((issue) => issue.path === path).map((issue) => issue.message); };
const rejects = (value, label) => assert.equal(validateRunEvaluation(value).valid, false, label);
const facilityRun = (facilityFailure = { boundary: "no-final-bundle", stage: "scenario.execute", reason: "unclassified" }) => ({
  ...flowRun(), verdict: "inconclusive", failureCategory: "unknown", facilityFailure,
  flowCreated: false, oracleVerdict: null, reportedVerdict: null, automationFailureReported: null, actions: [],
});

test("run evaluations write schema 0.3 while CandidateComparison remains 0.1", () => {
  assert.equal(EVALUATION_SCHEMA_VERSION, "0.3");
  assert.equal(flowRun().schemaVersion, "0.3");
  assert.equal(CANDIDATE_COMPARISON_SCHEMA_VERSION, "0.1");
  assert.doesNotThrow(() => assertRunEvaluation(flowRun()));
  // Schema 0.3 carries one counts-only measurement per extraction step, and round-trips.
  const notRun = measurement({ stepIndex: 5, status: "not_run", observedRecords: 0, comparedRecords: 0, matchedRecords: 0, presentFields: 0, pagesFollowed: null, truncated: null, durationMs: null });
  const measured = extractionRun([measurement(), notRun]);
  assert.doesNotThrow(() => assertRunEvaluation(measured));
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(measured)), measured);
  // Measured, with no extraction step, is an empty list; null is unmeasured.
  assert.equal(validateRunEvaluation(extractionRun([])).valid, true);
  rejects({ ...flowRun(), schemaVersion: "0.4" }, "a schema after 0.3");
});

test("the JSON reader explicitly normalizes legacy schema 0.1 evaluations to 0.3", () => {
  const legacy = without(without({ ...flowRun(), schemaVersion: "0.1" }, "facilityFailure"), "extraction");
  const read = { ...legacy, schemaVersion: "0.3", facilityFailure: null, extraction: null };
  assert.deepEqual(validateRunEvaluation(legacy), { valid: true, value: read });
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(legacy)), read);
  assert.throws(() => assertRunEvaluation(legacy), ContractValidationError);
  assert.throws(() => parseRunEvaluationJson(JSON.stringify({ ...legacy, facilityFailure: null })), ContractValidationError);
  assert.throws(() => parseRunEvaluationJson(JSON.stringify({ ...legacy, extraction: null })), ContractValidationError);
});

test("a schema 0.2 evaluation reads back as 0.3 with extraction null: unmeasured, never an empty list", () => {
  const legacy = without({ ...flowRun(), schemaVersion: "0.2" }, "extraction");
  const read = parseRunEvaluationJson(JSON.stringify(legacy));
  assert.deepEqual(read, { ...legacy, schemaVersion: "0.3", extraction: null });
  assert.equal(read.extraction, null);
  assert.deepEqual(validateRunEvaluation(legacy), { valid: true, value: read });
  // Normalized, not valid as written: a producer must write 0.3.
  assert.throws(() => assertRunEvaluation(legacy), ContractValidationError);
  // No 0.2 producer wrote extraction, so a 0.2 stating it is refused rather than upgraded.
  assert.throws(() => parseRunEvaluationJson(JSON.stringify({ ...legacy, extraction: [measurement()] })), ContractValidationError);
  assert.throws(() => parseRunEvaluationJson(JSON.stringify({ ...legacy, extraction: null })), ContractValidationError);
  // Normalization adds only extraction: a 0.2 still states facilityFailure.
  assert.throws(() => parseRunEvaluationJson(JSON.stringify(without(legacy, "facilityFailure"))), ContractValidationError);
});

test("a string planted anywhere in an extraction measurement is refused as a page value (D6)", () => {
  const refusedAsString = (value, path) => messagesAt(value, path).some((message) => message.startsWith("must not be a string"));
  for (const key of [
    "stepIndex", "expectedRecords", "observedRecords", "recordsListed", "countStated", "comparedRecords", "matchedRecords", "expectedFields", "presentFields", "unexpectedFields",
    "expectedPages", "pagesFollowed", "truncated", "durationMs", "nonStringValues", "status",
  ]) {
    const run = extractionRun([measurement(), measurement({ stepIndex: 3, [key]: PLANTED })]);
    assert.equal(validateRunEvaluation(run).valid, false, key);
    assert.equal(refusedAsString(run, `$.extraction[1].${key}`), true, `${key} refused as a string`);
    assert.throws(() => parseRunEvaluationJson(JSON.stringify(run)), ContractValidationError, key);
  }
  // A member the contract never names -- a field name, a sample, a step id -- is refused as a string, not only as unknown.
  for (const key of ["fieldName", "sampleValue", "stepId"]) {
    const run = extractionRun([measurement({ [key]: PLANTED })]);
    assert.equal(refusedAsString(run, `$.extraction[0].${key}`), true, `${key} refused as a string`);
  }
  // The one string a measurement carries is its closed status.
  for (const status of extractionMeasurementStatuses) assert.equal(validateRunEvaluation(extractionRun([measurement({ status })])).valid, true, status);
  assert.deepEqual([...extractionMeasurementStatuses], ["judged", "not_run", "not_expected"]);
  rejects(extractionRun([PLANTED]), "a measurement that is a string");
  rejects({ ...flowRun(), extraction: PLANTED }, "extraction as a string");
});

test("extraction counts are bounded: matched records by expected and observed ones, present fields by expected ones", () => {
  // At every bound: a short read matched in full, every expected field present.
  assert.equal(validateRunEvaluation(extractionRun([measurement({ observedRecords: 15, comparedRecords: 15, matchedRecords: 15 })])).valid, true);
  assert.equal(validateRunEvaluation(extractionRun([measurement({ observedRecords: 30, matchedRecords: 24, unexpectedFields: 2 })])).valid, true);
  // More matched records than expected, though no more than observed. A Set: the compared bound refuses the same member, and one member refused twice is still one defect.
  assert.deepEqual(new Set(issuesOf(extractionRun([measurement({ observedRecords: 30, matchedRecords: 25 })]))), new Set(["$.extraction[0].matchedRecords"]));
  // More matched records than observed, though no more than expected.
  assert.deepEqual(new Set(issuesOf(extractionRun([measurement({ observedRecords: 15, comparedRecords: 15, matchedRecords: 16 })]))), new Set(["$.extraction[0].matchedRecords"]));
  assert.deepEqual(issuesOf(extractionRun([measurement({ presentFields: 4 })])), ["$.extraction[0].presentFields"]);
  for (const [label, override] of Object.entries({
    "negative step": { stepIndex: -1 },
    "fractional records": { observedRecords: 23.5 },
    "negative unexpected fields": { unexpectedFields: -1 },
    "fractional non-string values": { nonStringValues: 0.5 },
    "numeric status": { status: 1 },
    "negative pages": { pagesFollowed: -1 },
    "fractional pages": { pagesFollowed: 1.5 },
    "negative expected pages": { expectedPages: -1 },
    "fractional expected pages": { expectedPages: 1.5 },
    "numeric truncated": { truncated: 1 },
    "negative duration": { durationMs: -1 },
    "missing member": { nonStringValues: undefined },
    "extra numeric member": { recordBytes: 2048 },
  })) rejects(extractionRun([measurement(override)]), label);
  assert.equal(validateRunEvaluation(extractionRun([measurement({ expectedPages: null, pagesFollowed: null, truncated: null, durationMs: null })])).valid, true);
  // A lane that cannot observe the pages a read covered states the expectation's side alone; the rate built on it then has one side and publishes nothing.
  assert.equal(validateRunEvaluation(extractionRun([measurement({ expectedPages: 3, pagesFollowed: null })])).valid, true);
  rejects({ ...flowRun(), extraction: { 0: measurement() } }, "extraction as an object");
  assert.deepEqual(issuesOf(without(flowRun(), "extraction")), ["$.extraction"]);
});

test("a step that compared nothing has no matches to pool: a count-only measurement cannot report one", () => {
  // The step x5f found: 1,000 records counted, not one value compared, so not one matched.
  const countOnly = measurement({
    recordsListed: false, countStated: true, expectedRecords: 1000, observedRecords: 1000,
    comparedRecords: 0, matchedRecords: 0, expectedFields: 0, presentFields: 0,
  });
  assert.equal(validateRunEvaluation(extractionRun([countOnly])).valid, true);
  // The shape that scored a false 1.0: every counted record claimed as a match.
  assert.deepEqual(issuesOf(extractionRun([{ ...countOnly, matchedRecords: 1000 }])), ["$.extraction[0].matchedRecords"]);
  // A comparison claimed where the expectation listed no record to compare against.
  assert.deepEqual(issuesOf(extractionRun([{ ...countOnly, comparedRecords: 1000 }])), ["$.extraction[0].comparedRecords"]);
  assert.deepEqual(new Set(issuesOf(extractionRun([measurement({ comparedRecords: 25 })]))), new Set(["$.extraction[0].comparedRecords"]));
  assert.deepEqual(issuesOf(extractionRun([measurement({ comparedRecords: 20, matchedRecords: 21 })])), ["$.extraction[0].matchedRecords"]);
  for (const [label, override] of Object.entries({
    "recordsListed as a number": { recordsListed: 1 },
    "countStated as a number": { countStated: 0 },
    "missing recordsListed": { recordsListed: undefined },
    "missing countStated": { countStated: undefined },
    "missing comparedRecords": { comparedRecords: undefined },
    "fractional compared records": { comparedRecords: 23.5 },
  })) rejects(extractionRun([measurement(override)]), label);
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
    "automationFailureReported", "automationFailureExpected", "harnessActivations", "durationMs", "actions", "evidence", "llm", "extraction",
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
