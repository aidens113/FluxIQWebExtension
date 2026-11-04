import { add, array, enumeration, finite, isObject, keys, result, type JsonObject } from "../runtime-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "../validation.js";
import { answerOracleOutcomes, answerShownOutcomes, answerVerdicts, answerWrongReasons, attemptEndings, attemptStandIns, flowScores, type RunAnswerScore } from "./answer-score.js";

const SCORE_KEYS = ["verdict", "ending", "wrongBecause", "records", "finalState", "change", "shown", "repeatedActs", "missingActs", "unaskedChanges", "storedRows", "shownRows", "flow", "standIns"] as const;

/**
 * A score whose verdict follows from its own parts: `right` only with a result whose
 * every oracle held and whose answer was not shown wrong, `wrong` naming why, and an
 * excused ending only for that ending. The hard rule is checked here as well as where
 * it is scored: `no_result` can say nothing but `wrong`.
 */
export function validateRunAnswerScore(input: unknown): ValidationResult<RunAnswerScore> {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) {
    add(issues, "$", "must be an object");
    return { valid: false, issues };
  }
  const value = input as JsonObject;
  keys(value, SCORE_KEYS, "$", issues);
  enumeration(value.verdict, answerVerdicts, "$.verdict", issues);
  enumeration(value.ending, attemptEndings, "$.ending", issues);
  for (const key of ["records", "finalState", "change"] as const) enumeration(value[key], answerOracleOutcomes, `$.${key}`, issues);
  enumeration(value.shown, answerShownOutcomes, "$.shown", issues);
  enumeration(value.flow, flowScores, "$.flow", issues);
  array(value.wrongBecause, "$.wrongBecause", issues, (item, path, target) => enumeration(item, answerWrongReasons, path, target));
  array(value.standIns, "$.standIns", issues, (item, path, target) => enumeration(item, attemptStandIns, path, target));
  for (const key of ["missingActs", "unaskedChanges"] as const) array(value[key], `$.${key}`, issues, (item, path, target) => {
    if (typeof item !== "string" || item.length === 0) add(target, path, "must be a non-empty string");
  });
  array(value.repeatedActs, "$.repeatedActs", issues, (item, path, target) => {
    if (!isObject(item)) {
      add(target, path, "must be an object");
      return;
    }
    keys(item, ["name", "asked", "landed"], path, target);
    if (typeof item.name !== "string" || item.name.length === 0) add(target, `${path}.name`, "must be a non-empty string");
    finite(item.asked, `${path}.asked`, target, 0, Number.MAX_SAFE_INTEGER, true);
    finite(item.landed, `${path}.landed`, target, 0, Number.MAX_SAFE_INTEGER, true);
  });
  for (const key of ["storedRows", "shownRows"] as const) if (value[key] !== null) finite(value[key], `$.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  // A scripted model's usage is made up, so what it costs is too.
  if (Array.isArray(value.standIns) && value.standIns.includes("model") && !value.standIns.includes("spend")) add(issues, "$.standIns", "must name spend with model: a scripted model's calls, tokens and dollars are not real");
  const reasons = Array.isArray(value.wrongBecause) ? value.wrongBecause : [];
  if (value.ending === "no_result" && value.verdict !== "wrong") add(issues, "$.verdict", "must be wrong: a task that ends without its result fails, unless its budget is gone or a person stopped it");
  if (value.verdict === "wrong" && reasons.length === 0) add(issues, "$.wrongBecause", "must say why a wrong answer is wrong");
  if (value.verdict !== "wrong" && reasons.length > 0) add(issues, "$.wrongBecause", "must be empty unless the answer is wrong");
  if (value.verdict === "budget_out" && value.ending !== "budget_out") add(issues, "$.verdict", "budget_out needs a budget_out ending");
  if (value.verdict === "stopped_by_person" && value.ending !== "stopped_by_person") add(issues, "$.verdict", "stopped_by_person needs a stopped_by_person ending");
  if (value.verdict === "right") {
    for (const key of ["records", "finalState", "change"] as const) if (value[key] === "failed") add(issues, `$.${key}`, "cannot have failed on a right answer");
    if (value.shown === "failed") add(issues, "$.shown", "cannot have failed on a right answer: a right answer that never reached the person is not right");
    if (Array.isArray(value.repeatedActs) && value.repeatedActs.length > 0) add(issues, "$.repeatedActs", "must be empty on a right answer");
  }
  return result(input, issues);
}

export function assertRunAnswerScore(input: unknown): asserts input is RunAnswerScore {
  const checked = validateRunAnswerScore(input);
  if (!checked.valid) throw new ContractValidationError("RunAnswerScore", checked.issues);
}
