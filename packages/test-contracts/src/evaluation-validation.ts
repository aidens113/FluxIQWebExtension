import {
  EVALUATION_SCHEMA_VERSION, evaluationLanes, extractionMeasurementStatuses, facilityFailureBoundaries, facilityFailureCauseCodes,
  facilityFailureOperationStages, facilityFailureReasons, facilityFailureStages, failureCategories, llmUsageModes,
  type CandidateComparison, type LlmUsage, type RunEvaluation, type RunExtractionMeasurement,
} from "./evaluation.js";
import { validateRunAdaptationCost, validateRunAdaptationPersistence, validateRunAdaptationReuse, validateRunAdaptationValidation } from "./adaptation-reuse-validation.js";
import { AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES } from "./failure-category.js";
import { validateRunHarnessRecovery } from "./harness-recovery-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, enumeration, finite, isObject, keys, object, optionalText, parseJson, result, text, type JsonObject } from "./runtime-validation.js";

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
/** The Week 2 adaptation measurements, each with its own validator; `harnessRecovery` is checked on its own. */
const adaptationValidators = {
  adaptationCost: validateRunAdaptationCost,
  adaptationValidation: validateRunAdaptationValidation,
  adaptationPersistence: validateRunAdaptationPersistence,
  adaptationReuse: validateRunAdaptationReuse,
} as const satisfies { [Key in keyof RunEvaluation]?: (input: unknown) => ValidationResult<unknown> };
const adaptationKeys = ["adaptationCost", "adaptationValidation", "adaptationPersistence", "adaptationReuse"] as const satisfies readonly (keyof typeof adaptationValidators)[];
const week2Keys = ["harnessRecovery", ...adaptationKeys] as const;
const runEvaluationKeys = [
  "schemaVersion", "runId", "verdict", "failureCategory", "facilityFailure", "invariants", "metrics",
  "scenarioId", "workflowId", "variantId", "repeatIndex", "lane", "flowCreated", "oracleVerdict", "reportedVerdict",
  "automationFailureReported", "automationFailureExpected", "harnessActivations", "durationMs", "actions", "evidence", "llm",
  "extraction", ...week2Keys,
];
/** The whole-number members of a `RunExtractionMeasurement`. */
const extractionCountKeys = [
  "stepIndex", "expectedRecords", "observedRecords", "comparedRecords", "matchedRecords", "expectedFields", "presentFields", "unexpectedFields", "nonStringValues",
] as const satisfies readonly (keyof RunExtractionMeasurement)[];
/** What the expectation offered, which decides which rate a step may enter at all. */
const extractionFlagKeys = ["recordsListed", "countStated"] as const satisfies readonly (keyof RunExtractionMeasurement)[];
const extractionMeasurementKeys = [...extractionCountKeys, ...extractionFlagKeys, "status", "expectedPages", "pagesFollowed", "truncated", "durationMs"] as const satisfies readonly (keyof RunExtractionMeasurement)[];
const automationVerdicts = ["passed", "failed"] as const;
/**
 * What FluxIQ may report, which is the oracle's vocabulary plus the one word
 * the oracle can never say: `unverified`, for a run whose steps succeeded and
 * whose result nobody judged. The fixture oracle always reaches a verdict or is
 * not consulted, so widening `automationVerdicts` itself would let an oracle
 * claim it too.
 */
const reportedVerdicts = [...automationVerdicts, "unverified"] as const;
const moduleCauseCodes = ["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_PACKAGE_IMPORT_NOT_DEFINED", "ERR_UNSUPPORTED_DIR_IMPORT"] as const;
const httpTransportCauseCodes = ["ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET"] as const;

export function validateRunEvaluation(input: unknown): ValidationResult<RunEvaluation> {
  const normalized = normalizeLegacyRunEvaluation(input);
  const issues: ValidationIssue[] = []; const value = object(normalized, "$", issues);
  if (value) {
    keys(value, runEvaluationKeys, "$", issues);
    if (value.schemaVersion !== EVALUATION_SCHEMA_VERSION) add(issues, "$.schemaVersion", `must equal ${EVALUATION_SCHEMA_VERSION}`); text(value, "runId", "$", issues); enumeration(value.verdict, ["passed", "failed", "inconclusive"], "$.verdict", issues);
    if (value.failureCategory !== undefined) enumeration(value.failureCategory, failureCategories, "$.failureCategory", issues);
    if (!("facilityFailure" in value)) add(issues, "$.facilityFailure", "is required");
    checkFacilityFailure(value.facilityFailure, "$.facilityFailure", issues);
    array(value.invariants, "$.invariants", issues, checkInvariant);
    if (Array.isArray(value.invariants)) {
      const ids = value.invariants.filter(isRecord).map(item => item.id).filter((id): id is string => typeof id === "string"); if (new Set(ids).size !== ids.length) add(issues, "$.invariants", "invariant ids must be unique");
      const failed = value.invariants.filter(isRecord).some(item => item.passed === false);
      if (value.verdict === "passed" && failed) add(issues, "$.verdict", "cannot pass with a failed invariant");
      if (value.verdict === "failed" && !failed) add(issues, "$.verdict", "failed verdict requires a failed invariant");
    }
    if (value.verdict === "failed" && value.failureCategory === undefined) add(issues, "$.failureCategory", "is required for failed verdict");
    if (value.verdict === "passed" && value.failureCategory !== undefined) add(issues, "$.failureCategory", "must be absent for passed verdict");
    checkFacilityFailurePairing(value, issues);
    checkMetrics(value.metrics, "$.metrics", issues);
    checkRunIdentity(value, issues);
    checkRunOutcome(value, issues);
    checkRunMeasurements(value, issues);
  }
  return result(normalized, issues);
}
export function assertRunEvaluation(input: unknown): asserts input is RunEvaluation {
  const checked = validateRunEvaluation(input);
  if (!checked.valid) throw new ContractValidationError("RunEvaluation", checked.issues);
  if (checked.value !== input) throw new ContractValidationError("RunEvaluation", [{ path: "$.schemaVersion", message: "legacy evaluations must be parsed and normalized before use" }]);
}
export function parseRunEvaluationJson(json: string): RunEvaluation {
  const checked = validateRunEvaluation(parse(json, "RunEvaluation"));
  if (!checked.valid) throw new ContractValidationError("RunEvaluation", checked.issues);
  return checked.value;
}

/** Validates an `LlmUsage`; `RunEvaluation` and `BenchReport` embed one as `llm`. */
export function validateLlmUsage(input: unknown): ValidationResult<LlmUsage> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["mode", "profileId", "calls"], "$", issues);
    enumeration(value.mode, llmUsageModes, "$.mode", issues);
    finite(value.calls, "$.calls", issues, 0, Number.MAX_SAFE_INTEGER, true);
    if (value.mode === "disabled") {
      if (value.profileId !== null) add(issues, "$.profileId", "must be null when the provider is disabled");
      if (value.calls !== 0) add(issues, "$.calls", "must be 0 when the provider is disabled");
    } else {
      if (!isKebabId(value.profileId)) add(issues, "$.profileId", "must name the LLM profile in use as a kebab-case id");
      if (value.mode === "deterministic-dry" && value.calls !== 0) add(issues, "$.calls", "must be 0 in deterministic-dry mode");
    }
  }
  return result(input, issues);
}

export function validateCandidateComparison(input: unknown): ValidationResult<CandidateComparison> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "baselineRunId", "candidateRunId", "safetyPassed", "expectationSetEqual", "evidenceComplete", "metricDeltas", "verdict", "reasons"], "$", issues);
    if (value.schemaVersion !== "0.1") add(issues, "$.schemaVersion", "must equal 0.1"); text(value, "baselineRunId", "$", issues); text(value, "candidateRunId", "$", issues);
    if (value.baselineRunId === value.candidateRunId) add(issues, "$.candidateRunId", "must differ from baselineRunId");
    for (const key of ["safetyPassed", "expectationSetEqual", "evidenceComplete"] as const) if (typeof value[key] !== "boolean") add(issues, `$.${key}`, "must be a boolean");
    checkMetrics(value.metricDeltas, "$.metricDeltas", issues); enumeration(value.verdict, ["improved", "regressed", "equivalent", "rejected"], "$.verdict", issues);
    array(value.reasons, "$.reasons", issues, (reason, path, target) => { if (typeof reason !== "string" || reason.length === 0) add(target, path, "must be a non-empty string"); });
    const gatesPass = value.safetyPassed === true && value.expectationSetEqual === true && value.evidenceComplete === true;
    if (value.verdict === "improved" && !gatesPass) add(issues, "$.verdict", "improved requires all safety and evidence gates");
    if (value.verdict === "rejected" && Array.isArray(value.reasons) && value.reasons.length === 0) add(issues, "$.reasons", "rejected comparison requires at least one reason");
  }
  return result(input, issues);
}
export function assertCandidateComparison(input: unknown): asserts input is CandidateComparison { const checked = validateCandidateComparison(input); if (!checked.valid) throw new ContractValidationError("CandidateComparison", checked.issues); }
export function parseCandidateComparisonJson(json: string): CandidateComparison { const input = parse(json, "CandidateComparison"); assertCandidateComparison(input); return input; }

/** Scenario, workflow, variant, repeat, and lane: which run of the corpus this is. */
function checkRunIdentity(value: JsonObject, issues: ValidationIssue[]): void {
  if (!isKebabId(value.scenarioId)) add(issues, "$.scenarioId", "must be a kebab-case scenario id");
  for (const key of ["workflowId", "variantId"] as const) if (value[key] !== null && !isKebabId(value[key])) add(issues, `$.${key}`, "must be null or a kebab-case id");
  finite(value.repeatIndex, "$.repeatIndex", issues, 0, Number.MAX_SAFE_INTEGER, true);
  enumeration(value.lane, evaluationLanes, "$.lane", issues);
}

/** Flow creation, the oracle's and FluxIQ's verdicts, and the automation failures, kept mutually consistent. */
function checkRunOutcome(value: JsonObject, issues: ValidationIssue[]): void {
  const flowCreated = value.flowCreated;
  if (flowCreated !== null && typeof flowCreated !== "boolean") add(issues, "$.flowCreated", "must be a boolean or null");
  else if (value.lane === "flow" && flowCreated === null) add(issues, "$.flowCreated", "must be a boolean on the flow lane");
  else if (value.lane === "recording" && flowCreated !== null) add(issues, "$.flowCreated", "must be null on the recording lane, which creates no Flow");
  nullableVerdict(value.oracleVerdict, "$.oracleVerdict", issues);
  nullableEnum(value.reportedVerdict, reportedVerdicts, "$.reportedVerdict", issues);
  if (flowCreated === false && value.reportedVerdict !== null) add(issues, "$.reportedVerdict", "must be null when no Flow was created");
  checkAutomationFailure(value.automationFailureReported, "$.automationFailureReported", issues);
  checkAutomationFailure(value.automationFailureExpected, "$.automationFailureExpected", issues);
  const reportedFailure = value.reportedVerdict === "failed";
  if (reportedFailure && value.automationFailureReported === null) add(issues, "$.automationFailureReported", "is required when FluxIQ reported failure; use ambiguous_or_unknown when it gave no category");
  if (!reportedFailure && isObject(value.automationFailureReported)) add(issues, "$.automationFailureReported", "must be null unless FluxIQ reported failure");
}

function checkRunMeasurements(value: JsonObject, issues: ValidationIssue[]): void {
  finite(value.harnessActivations, "$.harnessActivations", issues, 0, Number.MAX_SAFE_INTEGER, true);
  finite(value.durationMs, "$.durationMs", issues);
  array(value.actions, "$.actions", issues, checkActionLatency);
  checkEvidenceSizes(value.evidence, "$.evidence", issues);
  nest(validateLlmUsage(value.llm), "$.llm", issues);
  if (!("extraction" in value)) add(issues, "$.extraction", "is required: null when extraction was not measured");
  else checkExtraction(value.extraction, "$.extraction", issues);
  checkHarnessRecovery(value, issues);
  checkAdaptationMeasurements(value, issues);
}

/**
 * The four Week 2 adaptation measurements: each required, `null` when the run
 * did not measure it, and otherwise valid under its own contract. Like
 * `harnessRecovery`, only a run whose Flow was created and ran has
 * adaptations to measure.
 */
function checkAdaptationMeasurements(value: JsonObject, issues: ValidationIssue[]): void {
  for (const key of adaptationKeys) {
    if (!(key in value)) { add(issues, `$.${key}`, "is required: null when the run did not measure it"); continue; }
    if (value[key] === null) continue;
    if (value.lane !== "flow" || value.flowCreated !== true) add(issues, `$.${key}`, "must be null unless a Flow was created and ran");
    nest(adaptationValidators[key](value[key]), `$.${key}`, issues);
  }
  checkAdaptationProviderCalls(value, issues);
}

/**
 * The run's provider calls are one count, stated by reuse and by cost alike,
 * so the two must agree where both state it. And a run that configured no live
 * provider made no call: Core cannot have reached a model the run never gave
 * it, so a non-zero count there is a fabricated one.
 */
function checkAdaptationProviderCalls(value: JsonObject, issues: ValidationIssue[]): void {
  const cost = isObject(value.adaptationCost) ? value.adaptationCost.providerCalls : undefined;
  const reuse = isObject(value.adaptationReuse) ? value.adaptationReuse.providerCalls : undefined;
  if (typeof cost === "number" && typeof reuse === "number" && cost !== reuse) add(issues, "$.adaptationCost.providerCalls", "must equal adaptationReuse.providerCalls: both are Core's count of the run's provider calls");
  if (!isObject(value.llm) || value.llm.mode === "live") return;
  if (typeof cost === "number" && cost !== 0) add(issues, "$.adaptationCost.providerCalls", "must be 0 or null when the run configured no live provider");
  if (typeof reuse === "number" && reuse !== 0) add(issues, "$.adaptationReuse.providerCalls", "must be 0 or null when the run configured no live provider");
}

/**
 * `null` when recovery was not measured; otherwise Core's recovery record for
 * the Flow that ran. Only a run whose Flow was created can have one: nothing
 * else ran anything Core could have recovered.
 */
function checkHarnessRecovery(value: JsonObject, issues: ValidationIssue[]): void {
  if (!("harnessRecovery" in value)) { add(issues, "$.harnessRecovery", "is required: null when recovery was not measured"); return; }
  if (value.harnessRecovery === null) return;
  if (value.lane !== "flow" || value.flowCreated !== true) add(issues, "$.harnessRecovery", "must be null unless a Flow was created and ran");
  nest(validateRunHarnessRecovery(value.harnessRecovery), "$.harnessRecovery", issues);
}

/** `null` when extraction was not measured; otherwise one counts-only measurement per extraction step (D6). */
function checkExtraction(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input === null) return;
  if (!Array.isArray(input)) { add(issues, path, "must be null or an array of extraction measurements"); return; }
  array(input, path, issues, checkExtractionMeasurement);
}

/**
 * One extraction step's measurement. A string is refused wherever it appears,
 * except a closed `status`, before any other check: a string is the only way a
 * page value, field name, or step id could reach an evaluation (D6), so its
 * refusal must not depend on it landing in a member that also checks a type.
 */
function checkExtractionMeasurement(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  for (const [key, member] of Object.entries(value)) {
    const closedStatus = key === "status" && (extractionMeasurementStatuses as readonly unknown[]).includes(member);
    if (typeof member === "string" && !closedStatus) add(issues, `${path}.${key}`, "must not be a string: an extraction measurement carries counts and flags only, never a page value (D6)");
  }
  keys(value, extractionMeasurementKeys, path, issues);
  for (const key of extractionCountKeys) finite(value[key], `${path}.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  enumeration(value.status, extractionMeasurementStatuses, `${path}.status`, issues);
  if (value.expectedPages !== null) finite(value.expectedPages, `${path}.expectedPages`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  if (value.pagesFollowed !== null) finite(value.pagesFollowed, `${path}.pagesFollowed`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  if (value.truncated !== null && typeof value.truncated !== "boolean") add(issues, `${path}.truncated`, "must be a boolean or null");
  if (value.durationMs !== null) finite(value.durationMs, `${path}.durationMs`, issues);
  for (const key of extractionFlagKeys) if (typeof value[key] !== "boolean") add(issues, `${path}.${key}`, "must be a boolean");
  const { comparedRecords, matchedRecords, expectedRecords, observedRecords, presentFields, expectedFields } = value;
  if (typeof matchedRecords === "number") {
    if (typeof expectedRecords === "number" && matchedRecords > expectedRecords) add(issues, `${path}.matchedRecords`, "must not exceed expectedRecords");
    if (typeof observedRecords === "number" && matchedRecords > observedRecords) add(issues, `${path}.matchedRecords`, "must not exceed observedRecords");
    // The invariant that keeps a count-only step out of a record accuracy: a
    // match is a compared position, so a step that compared nothing has no
    // matches to pool. Enforced here rather than left to each producer,
    // because the false 1.0 it refuses was written by a producer that meant
    // `matchedRecords` as "records the two sides have in common".
    if (typeof comparedRecords === "number" && matchedRecords > comparedRecords) add(issues, `${path}.matchedRecords`, "must not exceed comparedRecords: a match is a record whose values were compared");
  }
  if (typeof comparedRecords === "number") {
    if (typeof expectedRecords === "number" && comparedRecords > expectedRecords) add(issues, `${path}.comparedRecords`, "must not exceed expectedRecords");
    if (typeof observedRecords === "number" && comparedRecords > observedRecords) add(issues, `${path}.comparedRecords`, "must not exceed observedRecords");
    if (value.recordsListed === false && comparedRecords > 0) add(issues, `${path}.comparedRecords`, "must be 0 when the expectation listed no records: nothing was there to compare against");
  }
  if (typeof presentFields === "number" && typeof expectedFields === "number" && presentFields > expectedFields) add(issues, `${path}.presentFields`, "must not exceed expectedFields");
}

function checkFacilityFailure(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input === null || input === undefined) return;
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["boundary", "stage", "reason", "operationStage", "causeCode", "timeoutMs"], path, issues);
  enumeration(value.boundary, facilityFailureBoundaries, `${path}.boundary`, issues);
  enumeration(value.stage, facilityFailureStages, `${path}.stage`, issues);
  enumeration(value.reason, facilityFailureReasons, `${path}.reason`, issues);
  if (value.operationStage !== undefined) enumeration(value.operationStage, facilityFailureOperationStages, `${path}.operationStage`, issues);
  if (value.causeCode !== undefined) enumeration(value.causeCode, facilityFailureCauseCodes, `${path}.causeCode`, issues);
  if (value.timeoutMs !== undefined) finite(value.timeoutMs, `${path}.timeoutMs`, issues, 1, 300_000, true);
  checkFacilityReasonDetails(value, path, issues);
}

function checkFacilityReasonDetails(value: JsonObject, path: string, issues: ValidationIssue[]): void {
  const operationStage = value.operationStage;
  const causeCode = value.causeCode;
  const hasTimeout = value.timeoutMs !== undefined;
  const readinessStage = operationStage === "scenario.health" || operationStage === "core.health";
  const httpStage = typeof operationStage === "string" && !readinessStage && (facilityFailureOperationStages as readonly string[]).includes(operationStage);
  const moduleCode = typeof causeCode === "string" && (moduleCauseCodes as readonly string[]).includes(causeCode);
  const transportCode = causeCode === undefined || typeof causeCode === "string" && (httpTransportCauseCodes as readonly string[]).includes(causeCode);
  if (value.reason === "readiness.timeout" && (!readinessStage || !hasTimeout || causeCode !== undefined)) add(issues, path, "readiness.timeout requires a readiness operationStage and timeoutMs only");
  if (value.reason === "http.timeout" && (!httpStage || !hasTimeout || causeCode !== undefined)) add(issues, path, "http.timeout requires an HTTP operationStage and timeoutMs only");
  if (value.reason === "http.abort" && (!httpStage || hasTimeout || causeCode !== undefined)) add(issues, path, "http.abort requires only an HTTP operationStage");
  if (value.reason === "http.transport" && (!httpStage || hasTimeout || !transportCode)) add(issues, path, "http.transport requires an HTTP operationStage and optional transport causeCode");
  if (value.reason === "module.missing" && (!moduleCode || operationStage !== undefined || hasTimeout)) add(issues, path, "module.missing requires only an allowlisted module causeCode");
  if (value.reason === "path.missing" && (causeCode !== "ENOENT" || operationStage !== undefined || hasTimeout)) add(issues, path, "path.missing requires only causeCode ENOENT");
  if (value.reason === "path.denied" && (causeCode !== "EACCES" && causeCode !== "EPERM" || operationStage !== undefined || hasTimeout)) add(issues, path, "path.denied requires only causeCode EACCES or EPERM");
  if (value.reason === "unclassified" && (operationStage !== undefined || causeCode !== undefined || hasTimeout)) add(issues, path, "unclassified cannot carry optional diagnostic fields");
}

function checkFacilityFailurePairing(value: JsonObject, issues: ValidationIssue[]): void {
  const diagnostic = value.facilityFailure;
  if (diagnostic === null || diagnostic === undefined) {
    if (value.verdict === "inconclusive") add(issues, "$.facilityFailure", "is required for an inconclusive facility result");
    return;
  }
  if (value.verdict === "passed") add(issues, "$.facilityFailure", "must be null for a passed evaluation");
  if (value.failureCategory === undefined) add(issues, "$.failureCategory", "is required with a facility failure diagnostic");
  if (value.reportedVerdict !== null || value.automationFailureReported !== null) add(issues, "$.facilityFailure", "cannot accompany an automation result");
}

/**
 * Schemas 0.1 and 0.2 are read-only compatibility and normalize explicitly to
 * the 0.3 shape: neither measured extraction, so `extraction` reads as `null`
 * (unmeasured, never `[]`), and 0.1 gains 0.2's `facilityFailure: null`. An
 * old version stating a member it never had is not normalized, and fails.
 */
function normalizeLegacyRunEvaluation(input: unknown): unknown {
  if (!isObject(input) || "extraction" in input) return input;
  if (input.schemaVersion === "0.2") return { ...input, schemaVersion: EVALUATION_SCHEMA_VERSION, extraction: null };
  if (input.schemaVersion === "0.1" && !("facilityFailure" in input)) return { ...input, schemaVersion: EVALUATION_SCHEMA_VERSION, facilityFailure: null, extraction: null };
  return input;
}

function nullableVerdict(input: unknown, path: string, issues: ValidationIssue[]): void {
  nullableEnum(input, automationVerdicts, path, issues);
}
function nullableEnum(input: unknown, allowed: readonly string[], path: string, issues: ValidationIssue[]): void {
  if (input !== null && (typeof input !== "string" || !allowed.includes(input))) add(issues, path, `must be null or one of ${allowed.join(", ")}`);
}
function checkAutomationFailure(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input === null) return;
  if (!isObject(input)) { add(issues, path, "must be null or an object"); return; }
  keys(input, ["category", "code"], path, issues);
  enumeration(input.category, AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES, `${path}.category`, issues);
  optionalText(input, "code", path, issues);
}
function checkActionLatency(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["actionType", "durationMs"], path, issues); text(value, "actionType", path, issues); finite(value.durationMs, `${path}.durationMs`, issues);
}
function checkEvidenceSizes(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["sanitizedPacketBytes", "rawSnapshotBytes", "truncationCount"], path, issues);
  for (const key of ["sanitizedPacketBytes", "rawSnapshotBytes"] as const) array(value[key], `${path}.${key}`, issues, checkByteCount);
  finite(value.truncationCount, `${path}.truncationCount`, issues, 0, Number.MAX_SAFE_INTEGER, true);
}
function checkByteCount(input: unknown, path: string, issues: ValidationIssue[]): void { finite(input, path, issues, 0, Number.MAX_SAFE_INTEGER, true); }
/** Adds a nested contract's issues, re-rooted from `$` at `path`. */
function nest(checked: ValidationResult<unknown>, path: string, issues: ValidationIssue[]): void {
  if (!checked.valid) for (const issue of checked.issues) issues.push({ path: path + issue.path.slice(1), message: issue.message });
}
function checkInvariant(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return; keys(value, ["id", "passed", "expected", "actual", "evidenceSequences"], path, issues);
  text(value, "id", path, issues); if (typeof value.passed !== "boolean") add(issues, `${path}.passed`, "must be a boolean"); text(value, "expected", path, issues); text(value, "actual", path, issues);
  array(value.evidenceSequences, `${path}.evidenceSequences`, issues, (sequence, sequencePath, target) => finite(sequence, sequencePath, target, 0, Number.MAX_SAFE_INTEGER, true));
  if (Array.isArray(value.evidenceSequences) && new Set(value.evidenceSequences).size !== value.evidenceSequences.length) add(issues, `${path}.evidenceSequences`, "must contain unique sequences");
}
function checkMetrics(input: unknown, path: string, issues: ValidationIssue[]): void { const value = object(input, path, issues); if (!value) return; for (const [key, metric] of Object.entries(value)) { if (!key) add(issues, path, "metric names must be non-empty"); finite(metric, `${path}.${key}`, issues, -Number.MAX_VALUE, Number.MAX_VALUE); } }
function parse(json: string, contract: string): unknown { try { return parseJson(json, contract); } catch (error) { throw new ContractValidationError(contract, [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); } }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isKebabId = (input: unknown): boolean => typeof input === "string" && KEBAB_ID.test(input);
