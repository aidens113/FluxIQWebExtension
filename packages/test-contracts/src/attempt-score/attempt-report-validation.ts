import { add, array, enumeration, finite, isObject, keys, result, type JsonObject } from "../runtime-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "../validation.js";
import { answerVerdicts, attemptCountsAsLive, attemptStandIns, flowScores, type AttemptStandIn } from "./answer-score.js";
import { ATTEMPT_REPORT_SCHEMA_VERSION, attemptPaths, attemptSimulationResults, type AttemptReportRow, type AttemptSeries } from "./attempt-report.js";

const ROW_KEYS = ["schemaVersion", "taskId", "scenarioId", "attempt", "path", "calls", "inputTokens", "outputTokens", "usd", "ms", "liveSteps", "simulation", "answerVerdict", "oracleVerdict", "flow", "repeatedActs", "loopsCaught", "actsWithNoRow", "against", "cacheHitPercent", "standIns", "live"] as const;
const SERIES_KEYS = ["schemaVersion", "taskId", "scenarioId", "rows", "firstRightAttempt", "attemptsUntilDeterministic", "spendDeltas", "secondStartedFromFirst"] as const;

function checkAgainst(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(input)) {
    add(issues, path, "must be an object");
    return;
  }
  keys(input as JsonObject, ["reseeded", "foundDone", "changed"], path, issues);
  if (input.reseeded !== false) add(issues, `${path}.reseeded`, "must be false: this says an attempt began on what an earlier one left");
  for (const key of ["foundDone", "changed"] as const) array(input[key], `${path}.${key}`, issues, (item, at, target) => {
    if (typeof item !== "string" || item.length === 0) add(target, at, "must be a non-empty string");
  });
}

function checkRow(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObject(input)) {
    add(issues, path, "must be an object");
    return;
  }
  const value = input as JsonObject;
  keys(value, ROW_KEYS, path, issues);
  if (value.schemaVersion !== ATTEMPT_REPORT_SCHEMA_VERSION) add(issues, `${path}.schemaVersion`, `must equal ${ATTEMPT_REPORT_SCHEMA_VERSION}`);
  for (const key of ["taskId", "scenarioId"] as const) if (typeof value[key] !== "string" || value[key] === "") add(issues, `${path}.${key}`, "must be a non-empty string");
  finite(value.attempt, `${path}.attempt`, issues, 1, Number.MAX_SAFE_INTEGER, true);
  enumeration(value.path, attemptPaths, `${path}.path`, issues);
  for (const key of ["calls", "inputTokens", "outputTokens", "ms", "liveSteps"] as const) finite(value[key], `${path}.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  finite(value.usd, `${path}.usd`, issues);
  enumeration(value.simulation, attemptSimulationResults, `${path}.simulation`, issues);
  enumeration(value.answerVerdict, answerVerdicts, `${path}.answerVerdict`, issues);
  if (value.oracleVerdict !== null && value.oracleVerdict !== "passed" && value.oracleVerdict !== "failed") add(issues, `${path}.oracleVerdict`, "must be passed, failed or null");
  enumeration(value.flow, flowScores, `${path}.flow`, issues);
  array(value.repeatedActs, `${path}.repeatedActs`, issues, (item, at, target) => {
    if (!isObject(item) || typeof item.name !== "string" || item.name.length === 0) add(target, at, "must name the act");
  });
  if (!isObject(value.loopsCaught)) add(issues, `${path}.loopsCaught`, "must be an object");
  if (value.actsWithNoRow !== undefined) finite(value.actsWithNoRow, `${path}.actsWithNoRow`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  if (value.against !== undefined) checkAgainst(value.against, `${path}.against`, issues);
  if (value.cacheHitPercent !== undefined) finite(value.cacheHitPercent, `${path}.cacheHitPercent`, issues, 0, 100, true);
  array(value.standIns, `${path}.standIns`, issues, (item, at, target) => enumeration(item, attemptStandIns, at, target));
  // A stand-in anywhere, and above all a scripted model, can never be counted as live.
  if (typeof value.live !== "boolean") add(issues, `${path}.live`, "must be a boolean");
  else if (Array.isArray(value.standIns) && value.live !== attemptCountsAsLive(value.standIns as AttemptStandIn[])) add(issues, `${path}.live`, "must be true only with no stand-in at all");
}

export function validateAttemptReportRow(input: unknown): ValidationResult<AttemptReportRow> {
  const issues: ValidationIssue[] = [];
  checkRow(input, "$", issues);
  return result(input, issues);
}

export function validateAttemptSeries(input: unknown): ValidationResult<AttemptSeries> {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) {
    add(issues, "$", "must be an object");
    return { valid: false, issues };
  }
  const value = input as JsonObject;
  keys(value, SERIES_KEYS, "$", issues);
  if (value.schemaVersion !== ATTEMPT_REPORT_SCHEMA_VERSION) add(issues, "$.schemaVersion", `must equal ${ATTEMPT_REPORT_SCHEMA_VERSION}`);
  array(value.rows, "$.rows", issues, (row, at, target) => checkRow(row, at, target));
  if (Array.isArray(value.rows)) {
    value.rows.forEach((row, index) => {
      if (isObject(row) && row.attempt !== index + 1) add(issues, `$.rows[${index}].attempt`, "must count from 1 in order");
      if (isObject(row) && row.taskId !== value.taskId) add(issues, `$.rows[${index}].taskId`, "must be the series' task");
    });
  }
  for (const key of ["firstRightAttempt", "attemptsUntilDeterministic"] as const) if (value[key] !== null) finite(value[key], `$.${key}`, issues, 1, Number.MAX_SAFE_INTEGER, true);
  if (value.secondStartedFromFirst !== null && typeof value.secondStartedFromFirst !== "boolean") add(issues, "$.secondStartedFromFirst", "must be a boolean or null");
  return result(input, issues);
}

export function assertAttemptSeries(input: unknown): asserts input is AttemptSeries {
  const checked = validateAttemptSeries(input);
  if (!checked.valid) throw new ContractValidationError("AttemptSeries", checked.issues);
}
