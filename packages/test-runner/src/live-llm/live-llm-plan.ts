// What a live provider run is actually authorized to do. The CLI's
// `LlmExecutionProfile` is the Lab's vocabulary; Core authorizes an execution
// grant in its own, and its bounds are narrower. This is the one place the two
// are reconciled, and it refuses rather than silently widening: every effective
// limit below is at or inside the profile's own, so a cap the operator typed
// can only ever bind harder, never less.

import { type LlmExecutionProfile, type LlmTaskKind, type LlmTokenBudget } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

/** Core's grant purposes the Lab can ask for, and the exact call count each one authorizes. */
const PURPOSE_CALLS = { diagnosis_only: 1, diagnose_and_adapt: 2 } as const;
export type LiveLlmPurpose = keyof typeof PURPOSE_CALLS;

/** Core's own ceilings (`assertFlowLlmExecutionSettings`, `AutomationStudioLlmExecutionGrantService`). */
const CORE_MAX_TOKENS = 50_000;
const CORE_MAX_TIMEOUT_MS = 25_000;
const CORE_MAX_COST_USD = 0.25;

export type LiveLlmPlan = {
  profileId: string;
  provider: "deepseek";
  model: "deepseek-chat";
  task: LlmTaskKind;
  purpose: LiveLlmPurpose;
  /** The grant's call count: exactly what the purpose authorizes, never more than the profile allows. */
  maxCalls: number;
  tokenLimits: { maxInputTokens: number; maxOutputTokens: number; maxTotalTokens: number };
  timeoutMs: number;
  maxEstimatedCostUsd: number;
  /** The budget the operator asked for, kept verbatim so the post-run check judges their numbers, not Core's. */
  declared: LlmTokenBudget;
};

/**
 * Reconciles a parsed `--live-llm` profile with what Core will authorize, or
 * refuses with a message naming the option at fault. Nothing here contacts a
 * provider: a profile that cannot be executed within its own stated bounds
 * fails before a run starts and before a key is read.
 */
export function planLiveLlmExecution(profile: LlmExecutionProfile): LiveLlmPlan {
  if (profile.mode !== "live") throw refusal("only a live LLM profile can reach a provider");
  if (profile.provider !== "deepseek") throw refusal(`--llm-provider ${describe(profile.provider)} is unsupported; Core resolves only deepseek`);
  if (profile.model !== "deepseek-chat") throw refusal(`--llm-model ${describe(profile.model)} is unsupported; Core resolves only deepseek-chat`);
  const purpose = purposeOf(profile.task);
  const budget = profile.budget;
  if (budget.maxRetries !== 0) throw refusal(`--llm-max-retries ${budget.maxRetries} is unsupported; a live provider run permits no retries`);
  const maxCalls = PURPOSE_CALLS[purpose];
  if (budget.maxCallsPerRun < maxCalls) throw refusal(`--llm-max-calls ${budget.maxCallsPerRun} cannot authorize the ${maxCalls} provider call(s) --llm-task ${profile.task} requires`);
  const tokenLimits = {
    maxInputTokens: bounded(budget.maxInputTokens, "--llm-max-input-tokens", CORE_MAX_TOKENS),
    maxOutputTokens: bounded(budget.maxOutputTokens, "--llm-max-output-tokens", CORE_MAX_TOKENS),
    maxTotalTokens: bounded(budget.maxTotalTokensPerRequest, "--llm-max-total-tokens", CORE_MAX_TOKENS),
  };
  if (tokenLimits.maxInputTokens + tokenLimits.maxOutputTokens > tokenLimits.maxTotalTokens) {
    throw refusal("--llm-max-input-tokens plus --llm-max-output-tokens exceeds --llm-max-total-tokens");
  }
  if (!Number.isSafeInteger(budget.timeoutMs) || budget.timeoutMs < 1) throw refusal(`--llm-timeout-ms ${budget.timeoutMs} must be a positive integer`);
  if (!Number.isFinite(budget.maxEstimatedCostUsd) || budget.maxEstimatedCostUsd <= 0) {
    throw refusal(`--llm-max-cost-usd ${budget.maxEstimatedCostUsd} cannot authorize a live provider call; give a positive limit at or below ${CORE_MAX_COST_USD}`);
  }
  return {
    profileId: profile.profileId,
    provider: "deepseek",
    model: "deepseek-chat",
    task: profile.task,
    purpose,
    maxCalls,
    tokenLimits,
    // Both clamp downward only: Core refuses anything above its own ceiling,
    // and an operator who asked for less than the ceiling keeps their number.
    timeoutMs: Math.min(budget.timeoutMs, CORE_MAX_TIMEOUT_MS),
    maxEstimatedCostUsd: Math.min(budget.maxEstimatedCostUsd, CORE_MAX_COST_USD),
    declared: { ...budget },
  };
}

function purposeOf(task: LlmTaskKind): LiveLlmPurpose {
  if (task === "diagnose") return "diagnosis_only";
  if (task === "adapt") return "diagnose_and_adapt";
  throw refusal(`--llm-task ${task} has no live Flow-lane runner; use diagnose or adapt`);
}

function bounded(value: number, option: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw refusal(`${option} ${value} must be a whole number between 1 and ${maximum}`);
  return value;
}

function describe(value: string | undefined): string {
  return value === undefined ? "(unset)" : value;
}

function refusal(detail: string): RunnerFailure {
  return new RunnerFailure("fixture.invalid", `Live LLM execution refused: ${detail}`);
}
