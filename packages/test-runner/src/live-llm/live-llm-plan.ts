// What a live provider run is actually authorized to do. The CLI's
// `LlmExecutionProfile` is the Lab's vocabulary; Core authorizes an execution
// grant in its own, and its bounds are narrower. This is the one place the two
// are reconciled, and it refuses rather than silently widening: every effective
// limit below is at or inside the profile's own, so a cap the operator typed
// can only ever bind harder, never less.

import { DEFAULT_LLM_LAB_BUDGET, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, LLM_LAB_MAX_CALLS_PER_RUN, type LlmExecutionProfile, type LlmTaskKind, type LlmTokenBudget } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";

/**
 * The grant purposes the Lab can plan, and whether each one iterates. That
 * yes-or-no is all a purpose says about call counts, as it is in Core
 * (`runtime/llm/grant-capabilities.ts`): `diagnosis_only` asks one question,
 * and everything else takes its count from the operator. The purposes differ
 * in what a run may *change*, which is Core's to enforce, not in how many
 * times it may ask. The first three are the ones a Core runtime session
 * accepts (`AUTOMATION_STUDIO_RUNTIME_SESSION_GRANT_PURPOSES`);
 * `build_and_adapt` is a person asking for a new Flow, and only a Flow build
 * accepts it.
 */
const PURPOSE_ITERATES = { diagnosis_only: false, diagnose_and_adapt: true, explore_and_adapt: true, build_and_adapt: true } as const;
export type LiveLlmPurpose = keyof typeof PURPOSE_ITERATES;

/** Core's own ceilings (`assertFlowLlmExecutionSettings`, `AutomationStudioLlmExecutionGrantService`). */
/** Core's per-request ceiling, which is deepseek-chat's own 64k context. Derived: a tenth copy of this number is how the previous nine happened. */
const CORE_MAX_TOKENS = LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST;
const CORE_MAX_TIMEOUT_MS = 25_000;
const CORE_MAX_COST_USD = 0.25;
/** Core's ceiling on a grant's total estimated cost (`MAX_TOTAL_COST_USD`), whatever its call count. */
const CORE_MAX_TOTAL_COST_USD = 2;
/** Core's runaway backstop on a grant's calls; the Lab contract carries the same number. */
const CORE_MAX_CALLS = LLM_LAB_MAX_CALLS_PER_RUN;
/**
 * `AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD`. Core issues a grant
 * whose run token budget (`maxTotalTokensPerRun`) is above this only when the
 * request confirms the exposure, and it also caps the budget Core chooses when a
 * request names none.
 *
 * Derived, because a literal here does not merely drift -- it overrides. This
 * plan's number is sent on every grant request and Core honours a caller-named
 * budget, so while this said 100_000 Core's own default could never reach a Lab
 * run. Core's arithmetic at the current call size: a 100_000 pot, one call's
 * worth held as the patch reserve, and an exploration decision needing another
 * call's worth leaves ZERO decisions. Every Lab run without an explicit
 * `--llm-max-run-tokens` therefore reintroduced, inside the Lab, precisely the
 * regression the Core change was made to remove -- and the campaigns hid it by
 * passing their own larger budget.
 *
 * Ten full requests, which is what Core means by the threshold.
 */
const CORE_HIGH_TOKEN_CONFIRMATION_THRESHOLD = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest * 10;

export type LiveLlmPlan = {
  profileId: string;
  provider: "deepseek";
  model: "deepseek-chat";
  task: LlmTaskKind;
  purpose: LiveLlmPurpose;
  /**
   * The grant's call count. One for a purpose that does not iterate; otherwise
   * exactly the operator's `--llm-max-calls`, which is never above Core's
   * backstop. Never more than the profile allows.
   */
  maxCalls: number;
  tokenLimits: { maxInputTokens: number; maxOutputTokens: number; maxTotalTokens: number };
  /**
   * The tokens the whole run may use, sent to Core as the grant's
   * `maxTotalTokensPerRun`: the operator's `--llm-max-run-tokens`, held to what
   * the authorized calls could use, or without one Core's own default -- the
   * smaller of that and Core's confirmation threshold. Always sent, so the
   * post-run check judges the number Core was asked for rather than a guess at
   * the one it chose.
   */
  maxTotalTokensPerRun: number;
  timeoutMs: number;
  maxEstimatedCostUsd: number;
  /**
   * The estimated cost the whole run may reach, sent to Core as the grant's
   * `maxTotalEstimatedCostUsd`: the per-call limit across the authorized calls,
   * held to Core's ceiling -- Core's own default, made explicit so the post-run
   * check judges the number Core enforces rather than a larger product of it.
   */
  maxTotalEstimatedCostUsd: number;
  /**
   * Core's high-token consent, decided from the run token budget above. The
   * explicit `--live-llm` and the budget typed with it are the confirmation, so
   * the grant request carries it exactly when Core would otherwise refuse, and
   * never when it would not.
   */
  highTokenConfirmation: {
    /** Whether the grant request carries `highTokenConfirmation: true`. */
    required: boolean;
    /** `maxTotalTokensPerRun`, the figure Core compares. */
    authorizedTokens: number;
    threshold: number;
    /** One sentence saying why, for the run's live-LLM snapshot. */
    reason: string;
  };
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
  // The operator's number is checked whatever the purpose, so a cap outside
  // Core's range is refused even where the purpose then asks for less.
  const declaredCalls = bounded(budget.maxCallsPerRun, "--llm-max-calls", CORE_MAX_CALLS);
  const maxCalls = PURPOSE_ITERATES[purpose] ? declaredCalls : 1;
  const tokenLimits = {
    maxInputTokens: bounded(budget.maxInputTokens, "--llm-max-input-tokens", CORE_MAX_TOKENS),
    maxOutputTokens: bounded(budget.maxOutputTokens, "--llm-max-output-tokens", CORE_MAX_TOKENS),
    maxTotalTokens: bounded(budget.maxTotalTokensPerRequest, "--llm-max-total-tokens", CORE_MAX_TOKENS),
  };
  if (tokenLimits.maxInputTokens + tokenLimits.maxOutputTokens > tokenLimits.maxTotalTokens) {
    throw refusal("--llm-max-input-tokens plus --llm-max-output-tokens exceeds --llm-max-total-tokens");
  }
  const runTokens = runTokenBudget(budget.maxTotalTokensPerRun, tokenLimits.maxTotalTokens, maxCalls);
  if (!Number.isSafeInteger(budget.timeoutMs) || budget.timeoutMs < 1) throw refusal(`--llm-timeout-ms ${budget.timeoutMs} must be a positive integer`);
  if (!Number.isFinite(budget.maxEstimatedCostUsd) || budget.maxEstimatedCostUsd <= 0) {
    throw refusal(`--llm-max-cost-usd ${budget.maxEstimatedCostUsd} cannot authorize a live provider call; give a positive limit at or below ${CORE_MAX_COST_USD}`);
  }
  const maxEstimatedCostUsd = Math.min(budget.maxEstimatedCostUsd, CORE_MAX_COST_USD);
  return {
    profileId: profile.profileId,
    provider: "deepseek",
    model: "deepseek-chat",
    task: profile.task,
    purpose,
    maxCalls,
    tokenLimits,
    maxTotalTokensPerRun: runTokens.tokens,
    // Both clamp downward only: Core refuses anything above its own ceiling,
    // and an operator who asked for less than the ceiling keeps their number.
    timeoutMs: Math.min(budget.timeoutMs, CORE_MAX_TIMEOUT_MS),
    maxEstimatedCostUsd,
    maxTotalEstimatedCostUsd: Math.min(CORE_MAX_TOTAL_COST_USD, maxEstimatedCostUsd * maxCalls),
    highTokenConfirmation: highTokenConfirmation(runTokens),
    declared: { ...budget },
  };
}

type RunTokenBudget = { tokens: number; source: string };

/**
 * The run's token budget and where it came from. It only ever moves down: a
 * typed budget above what the authorized calls could use is held to that, and
 * one that cannot cover a single request is refused rather than raised.
 */
function runTokenBudget(declared: number | undefined, perCall: number, calls: number): RunTokenBudget {
  const exposure = perCall * calls;
  const exposureText = `--llm-max-total-tokens ${perCall} x ${calls} authorized call(s) = ${exposure}`;
  if (declared === undefined) {
    // Core's formula, exactly. The outer `max` cannot bind here, since a
    // request is at most one per-request ceiling, but a copy that differs is a
    // copy that will drift -- and this one did, silently overriding Core.
    return {
      tokens: Math.max(perCall, Math.min(exposure, CORE_HIGH_TOKEN_CONFIRMATION_THRESHOLD)),
      source: `Core's default: the smaller of ${exposureText} and ${CORE_HIGH_TOKEN_CONFIRMATION_THRESHOLD}`,
    };
  }
  if (!Number.isSafeInteger(declared) || declared < perCall) {
    throw refusal(`--llm-max-run-tokens ${declared} must be a whole number of at least --llm-max-total-tokens ${perCall}`);
  }
  if (declared > exposure) return { tokens: exposure, source: `--llm-max-run-tokens ${declared}, held to ${exposureText}` };
  return { tokens: declared, source: `--llm-max-run-tokens ${declared}` };
}

function highTokenConfirmation(budget: RunTokenBudget): LiveLlmPlan["highTokenConfirmation"] {
  const threshold = CORE_HIGH_TOKEN_CONFIRMATION_THRESHOLD;
  const required = budget.tokens > threshold;
  const subject = `The run token budget of ${budget.tokens} (${budget.source})`;
  const reason = required
    ? `${subject} is above Core's ${threshold}-token confirmation threshold; the explicit --live-llm budget is the operator's confirmation.`
    : `${subject} is within Core's ${threshold}-token confirmation threshold; no confirmation is needed.`;
  return { required, authorizedTokens: budget.tokens, threshold, reason };
}

// `adapt` stays the narrow `diagnose_and_adapt` grant, which now iterates and
// may gather evidence but may still change only one target, as a proposal.
// `repair` is the iterating repair: an `explore_and_adapt` grant, which may
// gather its own evidence from the live page before it proposes, and whose
// patch Core may execute rather than only propose. `create-flow` is the web
// panel's "Explore and create proposal": an iterating `build_and_adapt` grant
// for one Flow build.
function purposeOf(task: LlmTaskKind): LiveLlmPurpose {
  if (task === "diagnose") return "diagnosis_only";
  if (task === "adapt") return "diagnose_and_adapt";
  if (task === "repair") return "explore_and_adapt";
  if (task === "create-flow") return "build_and_adapt";
  throw refusal(`--llm-task ${task} has no live runner; use diagnose, adapt, repair or create-flow`);
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
