import { add, array, enumeration, finite, isObject, keys, result, type JsonObject } from "../runtime-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "../validation.js";
import { answerVerdicts, attemptCountsAsLive, attemptStandIns, flowScores, type AttemptStandIn } from "./answer-score.js";
import { ATTEMPT_REPORT_SCHEMA_VERSION, attemptPaths, attemptSimulationResults, type AttemptReportRow, type AttemptSeries } from "./attempt-report.js";

const ROW_KEYS = ["schemaVersion", "taskId", "scenarioId", "attempt", "path", "calls", "inputTokens", "outputTokens", "usd", "ms", "liveSteps", "simulation", "answerVerdict", "oracleVerdict", "flow", "repeatedActs", "loopsCaught", "actsWithNoRow", "against", "cacheHitPercent", "standIns", "live"] as const;
const SERIES_KEYS = ["schemaVersion", "taskId", "scenarioId", "rows", "firstRightAttempt", "attemptsUntilDeterministic", "spendDeltas", "continuations", "deterministic"] as const;

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

function checkContinuations(input: unknown, rows: unknown, issues: ValidationIssue[]): void {
  array(input, "$.continuations", issues, (item, at, target) => {
    if (!isObject(item)) return add(target, at, "must be an object");
    keys(item as JsonObject, ["fromAttempt", "toAttempt", "held", "refused"], at, target);
    finite(item.fromAttempt, `${at}.fromAttempt`, target, 1, Number.MAX_SAFE_INTEGER, true);
    finite(item.toAttempt, `${at}.toAttempt`, target, 2, Number.MAX_SAFE_INTEGER, true);
    if (typeof item.held !== "boolean") add(target, `${at}.held`, "must be a boolean");
    array(item.refused, `${at}.refused`, target, (reason, where, inner) => {
      if (typeof reason !== "string" || reason.length === 0) add(inner, where, "must be a non-empty reason");
    });
    if (typeof item.held === "boolean" && Array.isArray(item.refused) && item.held !== (item.refused.length === 0)) add(target, `${at}.held`, "must be true exactly when nothing is refused");
  });
  if (!Array.isArray(input) || !Array.isArray(rows)) return;
  if (input.length !== Math.max(0, rows.length - 1)) add(issues, "$.continuations", "must hold one proof for each later attempt");
  input.forEach((item, index) => {
    if (isObject(item) && (item.fromAttempt !== index + 1 || item.toAttempt !== index + 2)) add(issues, `$.continuations[${index}]`, "must prove attempt n+1 against attempt n, in order");
  });
}

function checkDeterministic(input: unknown, rows: unknown, continuations: unknown, issues: ValidationIssue[]): void {
  if (input === null) {
    if (Array.isArray(rows) && rows.length > 1) add(issues, "$.deterministic", "must say what the later attempts did: it is null only for a series of one attempt");
    return;
  }
  if (!isObject(input)) return add(issues, "$.deterministic", "must be an object or null");
  keys(input as JsonObject, ["asked", "ran", "attempts", "zeroCallAttempts", "allHeld"], "$.deterministic", issues);
  for (const key of ["asked", "ran", "zeroCallAttempts"] as const) finite(input[key], `$.deterministic.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  if (typeof input.allHeld !== "boolean") add(issues, "$.deterministic.allHeld", "must be a boolean");
  if (typeof input.asked === "number" && input.asked < 1) add(issues, "$.deterministic.asked", "must be at least 1, or the summary must be null");
  if (typeof input.asked === "number" && typeof input.ran === "number" && input.ran > input.asked) add(issues, "$.deterministic.ran", "cannot exceed asked");
  const entries = input.attempts;
  array(entries, "$.deterministic.attempts", issues, (item, at, target) => {
    if (!isObject(item)) return add(target, at, "must be an object");
    keys(item as JsonObject, ["attempt", "path", "flowId", "continuationHeld", "calls", "ms"], at, target);
    finite(item.attempt, `${at}.attempt`, target, 2, Number.MAX_SAFE_INTEGER, true);
    enumeration(item.path, attemptPaths, `${at}.path`, target);
    if (item.flowId !== null && (typeof item.flowId !== "string" || item.flowId === "")) add(target, `${at}.flowId`, "must be a Flow id or null");
    if (typeof item.continuationHeld !== "boolean") add(target, `${at}.continuationHeld`, "must be a boolean");
    for (const key of ["calls", "ms"] as const) finite(item[key], `${at}.${key}`, target, 0, Number.MAX_SAFE_INTEGER, true);
  });
  if (!Array.isArray(entries) || !Array.isArray(rows) || !Array.isArray(continuations)) return;
  if (input.ran !== entries.length || entries.length !== rows.length - 1) add(issues, "$.deterministic.ran", "must count the later attempts listed, which are every row after the first");
  let zero = 0, held = true;
  entries.forEach((item, index) => {
    const row = rows[index + 1], proof = continuations[index];
    if (!isObject(item) || !isObject(row) || !isObject(proof)) return;
    if (item.attempt !== row.attempt || item.path !== row.path || item.calls !== row.calls || item.ms !== row.ms) add(issues, `$.deterministic.attempts[${index}]`, "must say what the attempt's own row says");
    if (item.continuationHeld !== proof.held) add(issues, `$.deterministic.attempts[${index}].continuationHeld`, "must say what its continuation says");
    if (item.calls === 0) zero += 1;
    if (proof.held !== true) held = false;
  });
  if (input.zeroCallAttempts !== zero) add(issues, "$.deterministic.zeroCallAttempts", "must count the later attempts with no model call");
  if (typeof input.asked === "number" && input.allHeld !== (held && entries.length === input.asked)) add(issues, "$.deterministic.allHeld", "must be true only when every later attempt asked for ran and every continuation held");
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
  checkContinuations(value.continuations, value.rows, issues);
  checkDeterministic(value.deterministic, value.rows, value.continuations, issues);
  return result(input, issues);
}

export function assertAttemptSeries(input: unknown): asserts input is AttemptSeries {
  const checked = validateAttemptSeries(input);
  if (!checked.valid) throw new ContractValidationError("AttemptSeries", checked.issues);
}
