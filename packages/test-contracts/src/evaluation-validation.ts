import { evaluationLanes, failureCategories, llmUsageModes, type CandidateComparison, type LlmUsage, type RunEvaluation } from "./evaluation.js";
import { AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES } from "./failure-category.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, enumeration, finite, isObject, keys, object, optionalText, parseJson, result, text, type JsonObject } from "./runtime-validation.js";

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const week2Keys = ["harnessRecovery", "adaptationCost", "adaptationValidation", "adaptationPersistence", "adaptationReuse"] as const;
const runEvaluationKeys = [
  "schemaVersion", "runId", "verdict", "failureCategory", "invariants", "metrics",
  "scenarioId", "workflowId", "variantId", "repeatIndex", "lane", "flowCreated", "oracleVerdict", "reportedVerdict",
  "automationFailureReported", "automationFailureExpected", "harnessActivations", "durationMs", "actions", "evidence", "llm",
  ...week2Keys,
];
const automationVerdicts = ["passed", "failed"] as const;

export function validateRunEvaluation(input: unknown): ValidationResult<RunEvaluation> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, runEvaluationKeys, "$", issues);
    if (value.schemaVersion !== "0.1") add(issues, "$.schemaVersion", "must equal 0.1"); text(value, "runId", "$", issues); enumeration(value.verdict, ["passed", "failed", "inconclusive"], "$.verdict", issues);
    if (value.failureCategory !== undefined) enumeration(value.failureCategory, failureCategories, "$.failureCategory", issues);
    array(value.invariants, "$.invariants", issues, checkInvariant);
    if (Array.isArray(value.invariants)) {
      const ids = value.invariants.filter(isRecord).map(item => item.id).filter((id): id is string => typeof id === "string"); if (new Set(ids).size !== ids.length) add(issues, "$.invariants", "invariant ids must be unique");
      const failed = value.invariants.filter(isRecord).some(item => item.passed === false);
      if (value.verdict === "passed" && failed) add(issues, "$.verdict", "cannot pass with a failed invariant");
      if (value.verdict === "failed" && !failed) add(issues, "$.verdict", "failed verdict requires a failed invariant");
    }
    if (value.verdict === "failed" && value.failureCategory === undefined) add(issues, "$.failureCategory", "is required for failed verdict");
    if (value.verdict === "passed" && value.failureCategory !== undefined) add(issues, "$.failureCategory", "must be absent for passed verdict");
    checkMetrics(value.metrics, "$.metrics", issues);
    checkRunIdentity(value, issues);
    checkRunOutcome(value, issues);
    checkRunMeasurements(value, issues);
  }
  return result(input, issues);
}
export function assertRunEvaluation(input: unknown): asserts input is RunEvaluation { const checked = validateRunEvaluation(input); if (!checked.valid) throw new ContractValidationError("RunEvaluation", checked.issues); }
export function parseRunEvaluationJson(json: string): RunEvaluation { const input = parse(json, "RunEvaluation"); assertRunEvaluation(input); return input; }

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
  nullableVerdict(value.reportedVerdict, "$.reportedVerdict", issues);
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
  for (const key of week2Keys) if (value[key] !== null) add(issues, `$.${key}`, "must be null until Week 2 defines it");
}

function nullableVerdict(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input !== null && (typeof input !== "string" || !(automationVerdicts as readonly string[]).includes(input))) add(issues, path, `must be null or one of ${automationVerdicts.join(", ")}`);
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
