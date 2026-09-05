import { failureCategories, type CandidateComparison, type RunEvaluation } from "./evaluation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, enumeration, finite, keys, object, parseJson, result, text } from "./runtime-validation.js";

export function validateRunEvaluation(input: unknown): ValidationResult<RunEvaluation> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "runId", "verdict", "failureCategory", "invariants", "metrics"], "$", issues);
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
  }
  return result(input, issues);
}
export function assertRunEvaluation(input: unknown): asserts input is RunEvaluation { const checked = validateRunEvaluation(input); if (!checked.valid) throw new ContractValidationError("RunEvaluation", checked.issues); }
export function parseRunEvaluationJson(json: string): RunEvaluation { const input = parse(json, "RunEvaluation"); assertRunEvaluation(input); return input; }

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

function checkInvariant(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return; keys(value, ["id", "passed", "expected", "actual", "evidenceSequences"], path, issues);
  text(value, "id", path, issues); if (typeof value.passed !== "boolean") add(issues, `${path}.passed`, "must be a boolean"); text(value, "expected", path, issues); text(value, "actual", path, issues);
  array(value.evidenceSequences, `${path}.evidenceSequences`, issues, (sequence, sequencePath, target) => finite(sequence, sequencePath, target, 0, Number.MAX_SAFE_INTEGER, true));
  if (Array.isArray(value.evidenceSequences) && new Set(value.evidenceSequences).size !== value.evidenceSequences.length) add(issues, `${path}.evidenceSequences`, "must contain unique sequences");
}
function checkMetrics(input: unknown, path: string, issues: ValidationIssue[]): void { const value = object(input, path, issues); if (!value) return; for (const [key, metric] of Object.entries(value)) { if (!key) add(issues, path, "metric names must be non-empty"); finite(metric, `${path}.${key}`, issues, -Number.MAX_VALUE, Number.MAX_VALUE); } }
function parse(json: string, contract: string): unknown { try { return parseJson(json, contract); } catch (error) { throw new ContractValidationError(contract, [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); } }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
