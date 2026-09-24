import { harnessChangeVerdictBases, harnessChangeVerdictOutcomes, harnessPatchPermissionOutcomes, harnessRecoveryContextOmissionReasons, harnessRecoveryRungs, type RunHarnessRecovery } from "./harness-recovery.js";
import { add, array, enumeration, keys, object, result, uniqueStrings, type JsonObject } from "./runtime-validation.js";
import type { ValidationIssue, ValidationResult } from "./validation.js";

/** Core's kind names: lowercase words joined by underscores. */
const KIND = /^[a-z]+(?:_[a-z]+)*$/u;
const KIND_MAX_LENGTH = 64;
/** An issue code as the runner's run-detail parser extracts one: never a sentence, so never a message. */
const CODE = /^[a-z][a-z0-9_.-]{1,127}$/u;
/** A Core identifier such as `adaptation.<run>.<kind>.<time>`: no space, so no text. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const IDENTIFIER_MAX_LENGTH = 256;

const recoveryKeys = ["attempted", "interventions", "runtimePatchAttempts", "adaptationIds", "changeProposalIds", "refusalCode", "refusalRung", "contextSections"] as const satisfies readonly (keyof RunHarnessRecovery)[];
const contextSectionKeys = ["included", "omitted"] as const;
const contextOmissionKeys = ["section", "reason"] as const;
const interventionKeys = ["kind", "validationOk", "validationCodes"] as const;
const patchFlagKeys = ["proposalOnly", "executed", "preflightOk"] as const;
const patchOutcomeKeys = ["adaptationCreated", "changeProposalCreated"] as const;
const patchAttemptKeys = ["kind", ...patchFlagKeys, "issueCodes", ...patchOutcomeKeys, "permissionOutcome", "permissionRequired", "verdict"] as const;
const verdictKeys = ["outcome", "basis"] as const;
/** The outcomes that say the change's trial ran. */
const ranOutcomes: readonly unknown[] = ["verified", "contradicted", "unverifiable"];

/**
 * Whether `input` is shaped like a Core identifier: at most 256 characters,
 * no space, so it can carry no text. Every identifier a Week 2 measurement
 * holds is checked against this one shape.
 */
export function isCoreIdentifier(input: unknown): input is string {
  return typeof input === "string" && input.length <= IDENTIFIER_MAX_LENGTH && IDENTIFIER.test(input);
}

/** Whether `input` is shaped like one of Core's kind or status words: at most 64 characters, lowercase words joined by underscores. */
export function isCoreKind(input: unknown): input is string {
  return typeof input === "string" && input.length <= KIND_MAX_LENGTH && KIND.test(input);
}

/**
 * Validates a `RunHarnessRecovery`; `RunEvaluation` embeds one as
 * `harnessRecovery`. Every string in it is a kind, a code, an identifier or a
 * closed verdict word, checked against its shape, which is what keeps a
 * message, a prompt or page text out of an evaluation: each shape refuses a
 * space.
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
    // Absent in a record written before the field existed; a code otherwise.
    //
    // It used to be refused for any `attempted` recovery, which made the one
    // outcome that most needs explaining -- a loop that engaged, spent a
    // diagnosis and repaired nothing -- the one outcome that could not be
    // explained. What a refusal may not sit beside is a recovery that
    // *produced* something: then the lists say what happened, and a refusal
    // code would contradict them.
    const produced = [value.runtimePatchAttempts, value.adaptationIds, value.changeProposalIds].some((list) => Array.isArray(list) && list.length > 0);
    if (value.refusalCode !== undefined && value.refusalCode !== null) {
      checkCode(value.refusalCode, "$.refusalCode", issues);
      if (produced) add(issues, "$.refusalCode", "must be null when the recovery produced a patch attempt, an adaptation or a change proposal");
    }
    // Absent when Core named no rung. Present, it is one of Core's own rungs,
    // and it attributes a refusal, so there has to be one to attribute.
    if (value.refusalRung !== undefined && value.refusalRung !== null) {
      enumeration(value.refusalRung, harnessRecoveryRungs, "$.refusalRung", issues);
      if (value.refusalCode === undefined || value.refusalCode === null) add(issues, "$.refusalRung", "must be null unless a refusal code names what it declined");
    }
    // Section names and Core's own omission reasons. A name is not content, so
    // nothing here can carry page data; the check is that it stays that way.
    if (value.contextSections !== undefined && value.contextSections !== null) {
      checkContextSections(value.contextSections, "$.contextSections", issues);
    }
  }
  return result(input, issues);
}

function checkContextSections(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, contextSectionKeys, path, issues);
  array(value.included, `${path}.included`, issues, checkIdentifier);
  array(value.omitted, `${path}.omitted`, issues, checkContextOmission);
  // A section is in exactly one of the two, which is Core's own invariant and
  // the whole point of keeping `omitted` rather than only listing what fit.
  const omitted = Array.isArray(value.omitted) ? value.omitted : [];
  const included = Array.isArray(value.included) ? value.included : [];
  const named = [...included, ...omitted.map((entry) => (entry && typeof entry === "object" ? (entry as JsonObject).section : undefined))];
  if (new Set(named).size !== named.length) add(issues, path, "must name each recovery context section exactly once, as included or as omitted");
}

function checkContextOmission(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, contextOmissionKeys, path, issues);
  checkIdentifier(value.section, `${path}.section`, issues);
  enumeration(value.reason, harnessRecoveryContextOmissionReasons, `${path}.reason`, issues);
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
  // Absent in a record written before the gate was asked about patches, and null when it was not asked.
  if (value.permissionOutcome !== undefined && value.permissionOutcome !== null) enumeration(value.permissionOutcome, harnessPatchPermissionOutcomes, `${path}.permissionOutcome`, issues);
  if (value.permissionRequired !== undefined) nullableBoolean(value.permissionRequired, `${path}.permissionRequired`, issues);
  if (value.permissionRequired === true && value.permissionOutcome !== "required") add(issues, `${path}.permissionRequired`, "must be true only for a patch the gate held back as a request");
  if (value.permissionRequired === true && value.executed === true) add(issues, `${path}.permissionRequired`, "cannot be true for a patch Core states it executed");
  // Absent in a record written before the verdict existed, and null when Core stated none: both unmeasured.
  if (value.verdict !== undefined && value.verdict !== null) checkVerdict(value, `${path}.verdict`, issues);
}

/**
 * One attempt's verdict: closed words, a basis exactly when verified, and an
 * outcome the attempt's own flags do not contradict. A patch Core only
 * proposed, refused at preflight, or states it did not execute had no trial,
 * so its verdict can only be `not_executed`; one Core states it executed had
 * one, so its verdict cannot be.
 */
function checkVerdict(attempt: JsonObject, path: string, issues: ValidationIssue[]): void {
  const verdict = object(attempt.verdict, path, issues); if (!verdict) return;
  keys(verdict, verdictKeys, path, issues);
  enumeration(verdict.outcome, harnessChangeVerdictOutcomes, `${path}.outcome`, issues);
  array(verdict.basis, `${path}.basis`, issues, (basis, basisPath, target) => enumeration(basis, harnessChangeVerdictBases, basisPath, target));
  if (Array.isArray(verdict.basis)) {
    uniqueStrings(verdict.basis, `${path}.basis`, issues, "basis kinds");
    if (verdict.outcome === "verified" && verdict.basis.length === 0) add(issues, `${path}.basis`, "must name the evidence a verified change rests on: a change whose node merely succeeded is unverifiable");
    if (verdict.outcome !== "verified" && verdict.basis.length > 0) add(issues, `${path}.basis`, "must be empty unless the outcome is verified");
  }
  const ran = ranOutcomes.includes(verdict.outcome);
  if (ran && (attempt.proposalOnly === true || attempt.executed === false || attempt.preflightOk === false)) add(issues, `${path}.outcome`, "must be not_executed for a patch that was only proposed, refused at preflight, or not executed");
  if (verdict.outcome === "not_executed" && attempt.executed === true) add(issues, `${path}.outcome`, "cannot be not_executed for a patch Core states it executed");
}

function checkKind(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isCoreKind(input)) add(issues, path, `must be a kind name of at most ${KIND_MAX_LENGTH} lowercase words joined by underscores`);
}
function checkCode(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string" || !CODE.test(input)) add(issues, path, "must be an issue code, never an issue message");
}
function checkIdentifier(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isCoreIdentifier(input)) add(issues, path, `must be a Core identifier of at most ${IDENTIFIER_MAX_LENGTH} characters`);
}
function nullableBoolean(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input !== null && typeof input !== "boolean") add(issues, path, "must be a boolean or null");
}
