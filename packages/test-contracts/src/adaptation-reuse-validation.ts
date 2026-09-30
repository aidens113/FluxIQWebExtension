import {
  adaptationConfidenceTiers, adaptationRecordStatuses,
  type BenchAdaptationCost, type BenchAdaptationPersistence, type BenchAdaptationReuse, type BenchAdaptationValidation,
  type RunAdaptationConfidence, type RunAdaptationCost, type RunAdaptationPersistence, type RunAdaptationRecord,
  type RunAdaptationResume, type RunAdaptationReuse, type RunAdaptationValidation,
} from "./adaptation-reuse.js";
import { isCoreIdentifier, isCoreKind } from "./harness-recovery-validation.js";
import { add, array, enumeration, finite, isObject, keys, object, result, uniqueStrings } from "./runtime-validation.js";
import type { ValidationIssue, ValidationResult } from "./validation.js";

const reuseKeys = ["exercisedAdaptationIds", "providerCalls", "interventions", "resume"] as const satisfies readonly (keyof RunAdaptationReuse)[];
const resumeKeys = ["fromNodeId", "fromRoute", "status", "attemptCount", "adaptationIds"] as const satisfies readonly (keyof RunAdaptationResume)[];
const confidenceKeys = ["adaptationId", "tier", "trials", "replays", "lastFailure"] as const satisfies readonly (keyof RunAdaptationConfidence)[];
const recordKeys = ["adaptationId", "status", "baseRevision", "appliedRevision"] as const satisfies readonly (keyof RunAdaptationRecord)[];
/** Core's accounting totals: one reading, stated together or not at all. */
const accountingTokenKeys = ["inputTokens", "outputTokens", "totalTokens"] as const satisfies readonly (keyof RunAdaptationCost)[];
const accountingKeys = [...accountingTokenKeys, "estimatedCostUsd"] as const satisfies readonly (keyof RunAdaptationCost)[];
const costKeys = ["providerCalls", ...accountingKeys, "reservedCalls"] as const satisfies readonly (keyof RunAdaptationCost)[];
const evidenceKinds = ["trial", "replay"] as const;

/**
 * Validates a `RunAdaptationReuse`; `RunEvaluation` embeds one as
 * `adaptationReuse`. Identifiers are identifier-shaped and Core's resume
 * status is a kind word, so no text can reach it.
 */
export function validateRunAdaptationReuse(input: unknown): ValidationResult<RunAdaptationReuse> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, reuseKeys, "$", issues);
    identifierList(value.exercisedAdaptationIds, "$.exercisedAdaptationIds", issues);
    nullableCount(value.providerCalls, "$.providerCalls", issues);
    count(value.interventions, "$.interventions", issues);
    if (value.resume === undefined) add(issues, "$.resume", "is required: null when the run did not resume from a trial");
    else if (value.resume !== null) checkResume(value.resume, "$.resume", issues);
  }
  return result(input, issues);
}

/**
 * Validates a `RunAdaptationValidation`; `RunEvaluation` embeds one as
 * `adaptationValidation`. Each adaptation is graded once, with a closed tier
 * its counts can support.
 */
export function validateRunAdaptationValidation(input: unknown): ValidationResult<RunAdaptationValidation> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["adaptations"], "$", issues);
    array(value.adaptations, "$.adaptations", issues, checkConfidence);
    uniqueAdaptations(value.adaptations, "$.adaptations", issues);
  }
  return result(input, issues);
}

/**
 * Validates a `RunAdaptationPersistence`; `RunEvaluation` embeds one as
 * `adaptationPersistence`. Each adaptation appears once, with Core's closed
 * status and whole revisions.
 */
export function validateRunAdaptationPersistence(input: unknown): ValidationResult<RunAdaptationPersistence> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["adaptations"], "$", issues);
    array(value.adaptations, "$.adaptations", issues, checkRecord);
    uniqueAdaptations(value.adaptations, "$.adaptations", issues);
  }
  return result(input, issues);
}

/**
 * Validates a `RunAdaptationCost`; `RunEvaluation` embeds one as
 * `adaptationCost`.
 *
 * It refuses the two ways a cost can be invented: accounting stated in part,
 * which would put a figure beside a reading the run did not take, and a
 * non-zero figure beside zero calls, which no call produced. A record stating
 * nothing at all is refused too: an unmeasured cost is `null`.
 */
export function validateRunAdaptationCost(input: unknown): ValidationResult<RunAdaptationCost> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, costKeys, "$", issues);
    nullableCount(value.providerCalls, "$.providerCalls", issues);
    for (const key of accountingTokenKeys) nullableCount(value[key], `$.${key}`, issues);
    if (value.estimatedCostUsd !== null) finite(value.estimatedCostUsd, "$.estimatedCostUsd", issues, 0, Number.MAX_VALUE);
    nullableCount(value.reservedCalls, "$.reservedCalls", issues);
    const stated = accountingKeys.filter((key) => value[key] !== null && value[key] !== undefined).length;
    if (stated > 0 && stated < accountingKeys.length) add(issues, "$", "must state inputTokens, outputTokens, totalTokens and estimatedCostUsd together or not at all: they are one reading of Core's accounting");
    if (stated === 0 && value.providerCalls === null && value.reservedCalls === null) add(issues, "$", "states nothing: a cost the run did not measure is null, not a record of nulls");
    const { providerCalls, inputTokens, outputTokens, totalTokens, reservedCalls } = value;
    if (typeof totalTokens === "number" && [inputTokens, outputTokens].some((part) => typeof part === "number" && part > totalTokens)) add(issues, "$.totalTokens", "must not be below inputTokens or outputTokens");
    if (typeof providerCalls === "number" && typeof reservedCalls === "number" && reservedCalls > providerCalls) add(issues, "$.reservedCalls", "must not exceed providerCalls");
    if (providerCalls === 0) {
      for (const key of [...accountingKeys, "reservedCalls"] as const) {
        const figure = value[key];
        if (typeof figure === "number" && figure > 0) add(issues, `$.${key}`, "must be 0 or null when the run made no provider call: no call produced it");
      }
    }
  }
  return result(input, issues);
}

const benchReuseKeys = ["measuredRuns", "exercisingRuns", "deterministicReplays", "uncertifiedRuns", "resumedRuns", "rate"] as const satisfies readonly (keyof BenchAdaptationReuse)[];
const benchCostKeys = ["measuredRuns", "countedRuns", "providerCalls", "accountedRuns", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd"] as const satisfies readonly (keyof BenchAdaptationCost)[];

/**
 * Validates a bench's `BenchAdaptationReuse`. The counts nest -- replays and
 * uncertified runs are exercising runs, exercising and resumed runs are
 * measured ones -- and `rate` is exactly replays over the exercising runs
 * whose count Core stated, `null` when there were none.
 */
export function validateBenchAdaptationReuse(input: unknown): ValidationResult<BenchAdaptationReuse> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, benchReuseKeys, "$", issues);
    for (const key of benchReuseKeys) if (key !== "rate") count(value[key], `$.${key}`, issues);
    measured(value.measuredRuns, issues);
    const { measuredRuns, exercisingRuns, deterministicReplays, uncertifiedRuns, resumedRuns } = value;
    if ([measuredRuns, exercisingRuns, deterministicReplays, uncertifiedRuns, resumedRuns].every((figure) => typeof figure === "number")) {
      const [runs, exercising, replays, uncertified, resumed] = [measuredRuns, exercisingRuns, deterministicReplays, uncertifiedRuns, resumedRuns] as number[];
      if (exercising! > runs!) add(issues, "$.exercisingRuns", "must not exceed measuredRuns");
      if (resumed! > runs!) add(issues, "$.resumedRuns", "must not exceed measuredRuns");
      if (replays! + uncertified! > exercising!) add(issues, "$.deterministicReplays", "with uncertifiedRuns must not exceed exercisingRuns: both are exercising runs, and no run is both");
      const certified = exercising! - uncertified!;
      const expected = certified > 0 ? replays! / certified : null;
      if (expected === null ? value.rate !== null : typeof value.rate !== "number" || Math.abs(value.rate - expected) > 1e-9) add(issues, "$.rate", "must be deterministicReplays over the exercising runs whose provider calls Core stated, or null when there were none");
    }
  }
  return result(input, issues);
}

/** Validates a bench's `BenchAdaptationValidation`: every closed tier counted, and the tiers summing to the adaptations. */
export function validateBenchAdaptationValidation(input: unknown): ValidationResult<BenchAdaptationValidation> {
  return closedTally(input, "tiers", adaptationConfidenceTiers);
}

/** Validates a bench's `BenchAdaptationPersistence`: every closed status counted, and the statuses summing to the adaptations. */
export function validateBenchAdaptationPersistence(input: unknown): ValidationResult<BenchAdaptationPersistence> {
  return closedTally(input, "statuses", adaptationRecordStatuses);
}

/**
 * Validates a bench's `BenchAdaptationCost`. Counted and accounted runs are
 * measured ones, tokens nest as a run's do, and a bench whose counted runs
 * made no call cannot have spent anything.
 */
export function validateBenchAdaptationCost(input: unknown): ValidationResult<BenchAdaptationCost> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, benchCostKeys, "$", issues);
    for (const key of benchCostKeys) if (key !== "estimatedCostUsd") count(value[key], `$.${key}`, issues);
    finite(value.estimatedCostUsd, "$.estimatedCostUsd", issues, 0, Number.MAX_VALUE);
    measured(value.measuredRuns, issues);
    const { measuredRuns, countedRuns, accountedRuns, inputTokens, outputTokens, totalTokens } = value;
    if (typeof measuredRuns === "number" && typeof countedRuns === "number" && countedRuns > measuredRuns) add(issues, "$.countedRuns", "must not exceed measuredRuns");
    if (typeof measuredRuns === "number" && typeof accountedRuns === "number" && accountedRuns > measuredRuns) add(issues, "$.accountedRuns", "must not exceed measuredRuns");
    if (typeof totalTokens === "number" && [inputTokens, outputTokens].some((part) => typeof part === "number" && part > totalTokens)) add(issues, "$.totalTokens", "must not be below inputTokens or outputTokens");
    if (accountedRuns === 0) for (const key of ["inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd"] as const) if (typeof value[key] === "number" && value[key] > 0) add(issues, `$.${key}`, "must be 0 when no run stated Core's accounting");
  }
  return result(input, issues);
}

function closedTally<T>(input: unknown, member: "tiers" | "statuses", words: readonly string[]): ValidationResult<T> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, ["measuredRuns", "adaptations", member], "$", issues);
    count(value.measuredRuns, "$.measuredRuns", issues);
    measured(value.measuredRuns, issues);
    count(value.adaptations, "$.adaptations", issues);
    const tally = object(value[member], `$.${member}`, issues);
    if (tally) {
      keys(tally, words, `$.${member}`, issues);
      for (const word of words) count(tally[word], `$.${member}.${word}`, issues);
      const total = words.reduce((sum, word) => sum + (typeof tally[word] === "number" ? tally[word] : 0), 0);
      if (typeof value.adaptations === "number" && total !== value.adaptations) add(issues, `$.${member}`, "must sum to adaptations: every adaptation is counted under exactly one");
    }
  }
  return result(input, issues) as ValidationResult<T>;
}

/** A bench aggregate exists only when a run measured it: an aggregate over no run is `null`, not a record of zeros. */
function measured(input: unknown, issues: ValidationIssue[]): void {
  if (input === 0) add(issues, "$.measuredRuns", "must be at least 1: an aggregate no run measured is null");
}

function checkResume(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, resumeKeys, path, issues);
  identifier(value.fromNodeId, `${path}.fromNodeId`, issues);
  identifier(value.fromRoute, `${path}.fromRoute`, issues);
  if (!isCoreKind(value.status)) add(issues, `${path}.status`, "must be Core's status word: lowercase words joined by underscores, never a sentence");
  count(value.attemptCount, `${path}.attemptCount`, issues);
  identifierList(value.adaptationIds, `${path}.adaptationIds`, issues);
}

function checkConfidence(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, confidenceKeys, path, issues);
  identifier(value.adaptationId, `${path}.adaptationId`, issues);
  enumeration(value.tier, adaptationConfidenceTiers, `${path}.tier`, issues);
  count(value.trials, `${path}.trials`, issues);
  count(value.replays, `${path}.replays`, issues);
  if (value.lastFailure !== null) enumeration(value.lastFailure, evidenceKinds, `${path}.lastFailure`, issues);
  const { tier, trials, replays } = value;
  if (typeof trials !== "number" || typeof replays !== "number") return;
  if (tier === "established" && replays === 0) add(issues, `${path}.tier`, "cannot be established without a succeeded replay: a trial is not a replay");
  if (tier === "provisional" && trials === 0 && replays === 0) add(issues, `${path}.tier`, "cannot be provisional without a succeeded trial or replay");
}

function checkRecord(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, recordKeys, path, issues);
  identifier(value.adaptationId, `${path}.adaptationId`, issues);
  enumeration(value.status, adaptationRecordStatuses, `${path}.status`, issues);
  count(value.baseRevision, `${path}.baseRevision`, issues);
  nullableCount(value.appliedRevision, `${path}.appliedRevision`, issues);
}

/** A list of the adaptations a record describes: each named once. */
function uniqueAdaptations(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(input)) return;
  uniqueStrings(input.map((entry) => (isObject(entry) ? entry.adaptationId : undefined)), path, issues, "adaptation ids");
}
function identifierList(input: unknown, path: string, issues: ValidationIssue[]): void {
  array(input, path, issues, identifier);
  if (Array.isArray(input)) uniqueStrings(input, path, issues, "identifiers");
}
function identifier(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isCoreIdentifier(input)) add(issues, path, "must be a Core identifier: at most 256 characters, no space");
}
function count(input: unknown, path: string, issues: ValidationIssue[]): void {
  finite(input, path, issues, 0, Number.MAX_SAFE_INTEGER, true);
}
function nullableCount(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (input !== null && (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0)) add(issues, path, "must be a whole number from 0, or null when Core did not state it");
}
