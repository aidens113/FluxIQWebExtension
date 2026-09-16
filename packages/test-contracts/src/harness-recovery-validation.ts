import type { RunHarnessRecovery } from "./harness-recovery.js";
import { add, array, keys, object, result } from "./runtime-validation.js";
import type { ValidationIssue, ValidationResult } from "./validation.js";

/** Core's kind names: lowercase words joined by underscores. */
const KIND = /^[a-z]+(?:_[a-z]+)*$/u;
const KIND_MAX_LENGTH = 64;
/** An issue code as the runner's run-detail parser extracts one: never a sentence, so never a message. */
const CODE = /^[a-z][a-z0-9_.-]{1,127}$/u;
/** A Core identifier such as `adaptation.<run>.<kind>.<time>`: no space, so no text. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const IDENTIFIER_MAX_LENGTH = 256;

const recoveryKeys = ["attempted", "interventions", "runtimePatchAttempts", "adaptationIds", "changeProposalIds"] as const satisfies readonly (keyof RunHarnessRecovery)[];
const interventionKeys = ["kind", "validationOk", "validationCodes"] as const;
const patchFlagKeys = ["proposalOnly", "executed", "preflightOk"] as const;
const patchOutcomeKeys = ["adaptationCreated", "changeProposalCreated"] as const;
const patchAttemptKeys = ["kind", ...patchFlagKeys, "issueCodes", ...patchOutcomeKeys] as const;

/**
 * Validates a `RunHarnessRecovery`; `RunEvaluation` embeds one as
 * `harnessRecovery`. Every string in it is a kind, a code or an identifier,
 * checked against its shape, which is what keeps a message, a prompt or page
 * text out of an evaluation: each shape refuses a space.
 *
 * `attempted` must agree with the lists, so a run with no recovery cannot be
 * read as one whose recovery failed, and the reverse.
 */
export function validateRunHarnessRecovery(input: unknown): ValidationResult<RunHarnessRecovery> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, recoveryKeys, "$", issues);
    if (typeof value.attempted !== "boolean") add(issues, "$.attempted", "must be a boolean");
    array(value.interventions, "$.interventions", issues, checkIntervention);
    array(value.runtimePatchAttempts, "$.runtimePatchAttempts", issues, checkPatchAttempt);
    array(value.adaptationIds, "$.adaptationIds", issues, checkIdentifier);
    array(value.changeProposalIds, "$.changeProposalIds", issues, checkIdentifier);
    const recorded = [value.interventions, value.runtimePatchAttempts, value.adaptationIds, value.changeProposalIds].some((list) => Array.isArray(list) && list.length > 0);
    if (value.attempted === true && !recorded) add(issues, "$.attempted", "must be false when Core recorded no intervention, patch attempt, adaptation or change proposal");
    if (value.attempted === false && recorded) add(issues, "$.attempted", "must be true when Core recorded any intervention, patch attempt, adaptation or change proposal");
  }
  return result(input, issues);
}

function checkIntervention(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, interventionKeys, path, issues);
  checkKind(value.kind, `${path}.kind`, issues);
  nullableBoolean(value.validationOk, `${path}.validationOk`, issues);
  array(value.validationCodes, `${path}.validationCodes`, issues, checkCode);
}

function checkPatchAttempt(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, patchAttemptKeys, path, issues);
  if (value.kind !== null) checkKind(value.kind, `${path}.kind`, issues);
  for (const key of patchFlagKeys) nullableBoolean(value[key], `${path}.${key}`, issues);
  array(value.issueCodes, `${path}.issueCodes`, issues, checkCode);
  for (const key of patchOutcomeKeys) if (typeof value[key] !== "boolean") add(issues, `${path}.${key}`, "must be a boolean");
}

function checkKind(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string" || input.length > KIND_MAX_LENGTH || !KIND.test(input)) add(issues, path, `must be a kind name of at most ${KIND_MAX_LENGTH} lowercase words joined by underscores`);
}
function checkCode(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string" || !CODE.test(input)) add(issues, path, "must be an issue code, never an issue message");
}
function checkIdentifier(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string" || input.length > IDENTIFIER_MAX_LENGTH || !IDENTIFIER.test(input)) add(issues, path, `must be a Core identifier of at most ${IDENTIFIER_MAX_LENGTH} characters`);
}
function nullableBoolean(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input !== null && typeof input !== "boolean") add(issues, path, "must be a boolean or null");
}
