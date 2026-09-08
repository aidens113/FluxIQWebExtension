import {
  LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST,
  LLM_LAB_MAX_CALLS_PER_RUN,
  LLM_LAB_MAX_ESTIMATED_COST_USD,
  llmEvidenceKinds,
  llmTaskKinds,
  type LlmExecutionProfile,
  type LlmInvocationProvenance,
  type LlmRunEvaluation,
  type LlmScenarioTask,
  type LlmTokenBudget,
} from "./llm.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "./validation.js";
import { add, array, enumeration, finite, keys, object, parseJson, result, text, uniqueStrings } from "./runtime-validation.js";

const tasks = [...llmTaskKinds];
const evidenceKinds = [...llmEvidenceKinds];

export function validateLlmExecutionProfile(input: unknown): ValidationResult<LlmExecutionProfile> {
  const issues: ValidationIssue[] = [];
  const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "profileId", "mode", "provider", "model", "task", "scenarioNetworkPolicy", "providerEgressPolicy", "externalSideEffects", "approvalMode", "retainRawPrompts", "retainRawResponses", "maxConcurrentRuns", "budget"], "$", issues);
    version(value.schemaVersion, "$.schemaVersion", issues);
    safeIdentifier(value.profileId, "$.profileId", issues);
    enumeration(value.mode, ["deterministic-dry", "live"], "$.mode", issues);
    enumeration(value.task, tasks, "$.task", issues);
    if (value.scenarioNetworkPolicy !== "loopback-only") add(issues, "$.scenarioNetworkPolicy", "must equal loopback-only");
    if (value.providerEgressPolicy !== "core-trusted-provider-only") add(issues, "$.providerEgressPolicy", "must equal core-trusted-provider-only");
    if (value.externalSideEffects !== false) add(issues, "$.externalSideEffects", "must be false");
    if (value.approvalMode !== "manual") add(issues, "$.approvalMode", "must equal manual");
    if (value.retainRawPrompts !== false) add(issues, "$.retainRawPrompts", "must be false");
    if (value.retainRawResponses !== false) add(issues, "$.retainRawResponses", "must be false");
    if (value.maxConcurrentRuns !== 1) add(issues, "$.maxConcurrentRuns", "must equal 1");
    checkBudget(value.budget, "$.budget", issues, value.mode === "deterministic-dry");
    if (value.mode === "live") {
      safeIdentifier(value.provider, "$.provider", issues);
      safeIdentifier(value.model, "$.model", issues);
    } else {
      if (value.provider !== undefined) add(issues, "$.provider", "must be absent in deterministic-dry mode");
      if (value.model !== undefined) add(issues, "$.model", "must be absent in deterministic-dry mode");
    }
  }
  return result(input, issues);
}

export function assertLlmExecutionProfile(input: unknown): asserts input is LlmExecutionProfile {
  const checked = validateLlmExecutionProfile(input);
  if (!checked.valid) throw new ContractValidationError("LlmExecutionProfile", checked.issues);
}

export function parseLlmExecutionProfileJson(json: string): LlmExecutionProfile {
  const input = parse(json, "LlmExecutionProfile"); assertLlmExecutionProfile(input); return input;
}

export function validateLlmScenarioTask(input: unknown): ValidationResult<LlmScenarioTask> {
  const issues: ValidationIssue[] = [];
  const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "task", "goal", "allowedEvidence", "allowedActions", "forbiddenActions", "requiredConstraints", "expectedOutcome", "reviewRequired", "deterministicReplayRequired"], "$", issues);
    version(value.schemaVersion, "$.schemaVersion", issues);
    enumeration(value.task, tasks, "$.task", issues);
    text(value, "goal", "$", issues);
    if (typeof value.goal === "string" && value.goal.length > 4_000) add(issues, "$.goal", "must not exceed 4000 characters");
    stringArray(value.allowedEvidence, "$.allowedEvidence", issues, evidenceKinds);
    stringArray(value.allowedActions, "$.allowedActions", issues);
    stringArray(value.forbiddenActions, "$.forbiddenActions", issues);
    stringArray(value.requiredConstraints, "$.requiredConstraints", issues);
    enumeration(value.expectedOutcome, ["proposal", "diagnosis", "adaptation"], "$.expectedOutcome", issues);
    if (value.reviewRequired !== true) add(issues, "$.reviewRequired", "must be true");
    if (value.deterministicReplayRequired !== true) add(issues, "$.deterministicReplayRequired", "must be true");
    if (Array.isArray(value.allowedActions) && Array.isArray(value.forbiddenActions)) {
      const forbiddenActions: unknown[] = value.forbiddenActions;
      const overlap = value.allowedActions.filter(action => typeof action === "string" && forbiddenActions.includes(action));
      if (overlap.length) add(issues, "$.forbiddenActions", "must not overlap allowedActions");
    }
  }
  return result(input, issues);
}

export function assertLlmScenarioTask(input: unknown): asserts input is LlmScenarioTask {
  const checked = validateLlmScenarioTask(input);
  if (!checked.valid) throw new ContractValidationError("LlmScenarioTask", checked.issues);
}

export function validateLlmInvocationProvenance(input: unknown): ValidationResult<LlmInvocationProvenance> {
  const issues: ValidationIssue[] = [];
  const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "requestId", "profileId", "provider", "model", "task", "promptSchemaVersion", "attempt", "inputTokens", "outputTokens", "totalTokens", "usageSource", "latencyMs", "estimatedCostUsd", "outcome", "errorCategory", "sanitized", "rawPromptRetained", "rawResponseRetained"], "$", issues);
    version(value.schemaVersion, "$.schemaVersion", issues);
    for (const key of ["requestId", "profileId", "provider", "model", "promptSchemaVersion"] as const) safeIdentifier(value[key], "$." + key, issues);
    enumeration(value.task, tasks, "$.task", issues);
    finite(value.attempt, "$.attempt", issues, 1, Number.MAX_SAFE_INTEGER, true);
    const usageValues = [value.inputTokens, value.outputTokens, value.totalTokens];
    const reportedUsageCount = usageValues.filter(entry => entry !== undefined).length;
    if (reportedUsageCount !== 0 && reportedUsageCount !== 3) add(issues, "$.usageSource", "token usage fields must be all present or all absent");
    if (reportedUsageCount === 3) {
      finite(value.inputTokens, "$.inputTokens", issues, 0, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, true);
      finite(value.outputTokens, "$.outputTokens", issues, 0, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, true);
      finite(value.totalTokens, "$.totalTokens", issues, 0, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, true);
      enumeration(value.usageSource, ["provider-reported", "estimated"], "$.usageSource", issues);
    } else {
      if (value.usageSource !== "unavailable") add(issues, "$.usageSource", "must equal unavailable when token usage is absent");
      if (value.outcome === "succeeded") add(issues, "$.usageSource", "successful invocations require token usage");
    }
    finite(value.latencyMs, "$.latencyMs", issues, 0, Number.MAX_SAFE_INTEGER);
    if (value.estimatedCostUsd !== undefined) finite(value.estimatedCostUsd, "$.estimatedCostUsd", issues, 0);
    enumeration(value.outcome, ["succeeded", "rejected", "failed", "cancelled"], "$.outcome", issues);
    if (value.errorCategory !== undefined && (typeof value.errorCategory !== "string" || !value.errorCategory)) add(issues, "$.errorCategory", "must be a non-empty string when provided");
    if (value.sanitized !== true) add(issues, "$.sanitized", "must be true");
    if (value.rawPromptRetained !== false) add(issues, "$.rawPromptRetained", "must be false");
    if (value.rawResponseRetained !== false) add(issues, "$.rawResponseRetained", "must be false");
    if (reportedUsageCount === 3 && typeof value.inputTokens === "number" && typeof value.outputTokens === "number" && typeof value.totalTokens === "number" && value.inputTokens + value.outputTokens !== value.totalTokens) add(issues, "$.totalTokens", "must equal inputTokens plus outputTokens");
    if ((value.outcome === "failed" || value.outcome === "rejected") && value.errorCategory === undefined) add(issues, "$.errorCategory", "is required for failed or rejected outcomes");
  }
  return result(input, issues);
}

export function validateLlmRunEvaluation(input: unknown): ValidationResult<LlmRunEvaluation> {
  const issues: ValidationIssue[] = [];
  const value = object(input, "$", issues);
  if (value) {
    keys(value, ["schemaVersion", "runId", "profileId", "task", "invocations", "maxCallsPerRun", "proposalValidated", "reviewOutcome", "applyOutcome", "deterministicReplay", "safetyPassed", "verdict", "reasons"], "$", issues);
    version(value.schemaVersion, "$.schemaVersion", issues);
    safeIdentifier(value.runId, "$.runId", issues); safeIdentifier(value.profileId, "$.profileId", issues);
    enumeration(value.task, tasks, "$.task", issues);
    finite(value.maxCallsPerRun, "$.maxCallsPerRun", issues, 0, LLM_LAB_MAX_CALLS_PER_RUN, true);
    array(value.invocations, "$.invocations", issues, (entry, path, target) => {
      const checked = validateLlmInvocationProvenance(entry);
      for (const issue of checked.valid ? [] : checked.issues) add(target, path + issue.path.slice(1), issue.message);
    });
    if (Array.isArray(value.invocations) && typeof value.maxCallsPerRun === "number" && value.invocations.length > value.maxCallsPerRun) add(issues, "$.invocations", "must not exceed maxCallsPerRun");
    if (typeof value.proposalValidated !== "boolean") add(issues, "$.proposalValidated", "must be a boolean");
    enumeration(value.reviewOutcome, ["not-applicable", "pending", "approved", "rejected"], "$.reviewOutcome", issues);
    enumeration(value.applyOutcome, ["not-attempted", "applied", "rejected", "reverted"], "$.applyOutcome", issues);
    const replay = object(value.deterministicReplay, "$.deterministicReplay", issues);
    if (replay) {
      keys(replay, ["required", "completed", "passed", "llmCalls"], "$.deterministicReplay", issues);
      if (replay.required !== true) add(issues, "$.deterministicReplay.required", "must be true");
      if (typeof replay.completed !== "boolean") add(issues, "$.deterministicReplay.completed", "must be a boolean");
      if (replay.passed !== undefined && typeof replay.passed !== "boolean") add(issues, "$.deterministicReplay.passed", "must be a boolean when provided");
      if (replay.llmCalls !== 0) add(issues, "$.deterministicReplay.llmCalls", "must equal 0");
      if (replay.completed === true && typeof replay.passed !== "boolean") add(issues, "$.deterministicReplay.passed", "is required when replay is completed");
    }
    if (typeof value.safetyPassed !== "boolean") add(issues, "$.safetyPassed", "must be a boolean");
    enumeration(value.verdict, ["passed", "failed", "inconclusive"], "$.verdict", issues);
    stringArray(value.reasons, "$.reasons", issues);
    if (value.verdict === "passed" && value.safetyPassed !== true) add(issues, "$.verdict", "cannot pass when safetyPassed is false");
    if (value.verdict === "passed" && (replay?.completed !== true || replay.passed !== true)) add(issues, "$.verdict", "passed verdict requires a completed and passed deterministic replay");
  }
  return result(input, issues);
}

function checkBudget(input: unknown, path: string, issues: ValidationIssue[], dry: boolean): void {
  const value = object(input, path, issues); if (!value) return;
  keys(value, ["maxInputTokens", "maxOutputTokens", "maxTotalTokensPerRequest", "maxCallsPerRun", "timeoutMs", "maxRetries", "maxEstimatedCostUsd"], path, issues);
  finite(value.maxInputTokens, path + ".maxInputTokens", issues, 1, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, true);
  finite(value.maxOutputTokens, path + ".maxOutputTokens", issues, 1, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, true);
  finite(value.maxTotalTokensPerRequest, path + ".maxTotalTokensPerRequest", issues, 1, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, true);
  finite(value.maxCallsPerRun, path + ".maxCallsPerRun", issues, dry ? 0 : 1, LLM_LAB_MAX_CALLS_PER_RUN, true);
  finite(value.timeoutMs, path + ".timeoutMs", issues, 1, 300_000, true);
  finite(value.maxRetries, path + ".maxRetries", issues, 0, 1, true);
  finite(value.maxEstimatedCostUsd, path + ".maxEstimatedCostUsd", issues, 0, LLM_LAB_MAX_ESTIMATED_COST_USD);
  if (typeof value.maxInputTokens === "number" && typeof value.maxOutputTokens === "number" && typeof value.maxTotalTokensPerRequest === "number" && value.maxInputTokens + value.maxOutputTokens > value.maxTotalTokensPerRequest) add(issues, path + ".maxTotalTokensPerRequest", "must cover maxInputTokens plus maxOutputTokens");
  if (dry && value.maxCallsPerRun !== 0) add(issues, path + ".maxCallsPerRun", "must equal 0 in deterministic-dry mode");
  if (!dry && typeof value.maxCallsPerRun === "number" && typeof value.maxRetries === "number" && 1 + value.maxRetries > value.maxCallsPerRun) add(issues, path + ".maxRetries", "retries must fit within maxCallsPerRun");
}
const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const secretLikeIdentifierPattern = /^(?:(?:sk|dsk|key|token|secret)[-_][A-Za-z0-9_-]{8,}|(?:bearer|basic):)/iu;
function safeIdentifier(input: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof input !== "string" || !safeIdentifierPattern.test(input)) {
    add(issues, path, "must be a 1-200 character non-secret identifier");
    return;
  }
  if (secretLikeIdentifierPattern.test(input) || /(?:api[-_]?key|password|credential|authorization)/iu.test(input)) add(issues, path, "must not contain secret-like content");
}
function stringArray(input: unknown, path: string, issues: ValidationIssue[], allowed?: readonly string[]): void {
  if (Array.isArray(input) && input.length > 100) add(issues, path, "must not contain more than 100 entries");
  array(input, path, issues, (entry, entryPath, target) => {
    if (typeof entry !== "string" || !entry) add(target, entryPath, "must be a non-empty string");
    else if (entry.length > 512) add(target, entryPath, "must not exceed 512 characters");
    else if (allowed && !allowed.includes(entry)) add(target, entryPath, "is not allowed");
  });
  if (Array.isArray(input)) uniqueStrings(input, path, issues, "values");
}
function version(value: unknown, path: string, issues: ValidationIssue[]): void { if (value !== "0.1") add(issues, path, "must equal 0.1"); }
function parse(json: string, contract: string): unknown { try { return parseJson(json, contract); } catch (error) { throw new ContractValidationError(contract, [{ path: "$", message: error instanceof Error ? error.message : String(error) }]); } }