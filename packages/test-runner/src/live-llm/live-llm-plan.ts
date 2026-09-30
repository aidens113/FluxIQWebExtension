// What a live provider run is bounded to. The CLI's `LlmExecutionProfile` is
// the Lab's vocabulary; Core's Flow settings are narrower. This is the one
// place the two are reconciled, and it refuses rather than silently widening:
// every effective limit below is at or inside the profile's own, so a cap the
// operator typed can only ever bind harder, never less.
//
// Nothing here is an authorization. A model call needs no grant: the limits
// become Flow settings Core's loop budget enforces, and the only thing the
// operator still allows is a consequence (`--llm-permit`).

import { DEFAULT_LLM_MODEL, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, LLM_LAB_MAX_CALLS_PER_RUN, isLlmModel, llmModels, type LlmActionConsequence, type LlmExecutionProfile, type LlmModel, type LlmTaskKind, type LlmTokenBudget } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCES } from "fluxiq/automation-studio";
import { RunnerFailure } from "../failure.js";

/**
 * The intents the Lab can plan -- Core's runtime-session LLM intents -- and
 * whether each one iterates. That yes-or-no is all an intent says about call
 * counts: `diagnosis_only` asks one question, and everything else takes its
 * count from the operator. The intents differ in what a run may *change*,
 * which is Core's to enforce. `build_and_adapt` is a person asking for a new
 * Flow, and only a Flow build takes it.
 */
const PURPOSE_ITERATES = { diagnosis_only: false, diagnose_and_adapt: true, explore_and_adapt: true, build_and_adapt: true } as const;
export type LiveLlmPurpose = keyof typeof PURPOSE_ITERATES;

/** Core's own ceilings on a Flow's LLM execution settings (`assertFlowLlmExecutionSettings`). */
/** The per-request ceiling: the configured models' own context window (Core's `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`), not a budget, so no limit hides page information from the model. Derived: a tenth copy of this number is how the previous nine happened. */
const CORE_MAX_TOKENS = LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST;
const CORE_MAX_TIMEOUT_MS = 25_000;
const CORE_MAX_COST_USD = 0.25;
/**
 * The most one Flow build, or one repair of the Flow it built, may spend in
 * all, whatever its call count: Core's ceiling on a build's total and on its
 * repair's, each on its own. A Flow's `maxEstimatedCostUsdPerRun` may only
 * lower it, so the Lab never asks for more.
 */
const CORE_MAX_TOTAL_COST_USD = 0.25;
/** Core's runaway backstop on a run's calls; the Lab contract carries the same number. */
const CORE_MAX_CALLS = LLM_LAB_MAX_CALLS_PER_RUN;

export type LiveLlmPlan = {
  profileId: string;
  provider: "deepseek";
  model: LlmModel;
  task: LlmTaskKind;
  purpose: LiveLlmPurpose;
  /**
   * The run's call count. One for an intent that does not iterate; otherwise
   * exactly the operator's `--llm-max-calls`, which is never above Core's
   * backstop. Never more than the profile allows.
   */
  maxCalls: number;
  tokenLimits: { maxInputTokens: number; maxOutputTokens: number; maxTotalTokens: number };
  /**
   * The tokens the whole run may use, held by the Lab's post-run check: the
   * operator's `--llm-max-run-tokens`, held to what the authorized calls could
   * use, or without one every authorized call at the per-request limit, so
   * `--llm-max-cost-usd`, the call count and Core's stall guard bind first.
   */
  maxTotalTokensPerRun: number;
  timeoutMs: number;
  maxEstimatedCostUsd: number;
  /**
   * The estimated cost the whole run may reach: the per-call limit across the
   * authorized calls, held to Core's $0.25 ceiling. Saved as the Flow setting
   * `adaptationPolicySettings.maxEstimatedCostUsdPerRun`, which Core's loop
   * budget holds every build and recovery on the Flow to.
   */
  maxTotalEstimatedCostUsd: number;
  /** The budget the operator asked for, kept verbatim so the post-run check judges their numbers, not Core's. */
  declared: LlmTokenBudget;
  /**
   * What the run permits its actions to do: exactly the operator's
   * `--llm-permit`, in Core's order, and empty without it, sent with the build
   * or the run as `permittedConsequences`. Nothing adds to it, so no request
   * this run makes carries a class nobody asked for.
   */
  permittedConsequences: readonly LlmActionConsequence[];
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
  const model = profile.model ?? DEFAULT_LLM_MODEL;
  // A model neither repository is configured for is refused here by name,
  // before a key is read, rather than left for Core to discover once the run
  // has started.
  if (!isLlmModel(model)) throw refusal(`--llm-model ${describe(profile.model)} is unsupported; Core is configured for ${llmModels.join(", ")}`);
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
    model,
    task: profile.task,
    purpose,
    maxCalls,
    tokenLimits,
    maxTotalTokensPerRun: runTokens,
    // Both clamp downward only: Core refuses anything above its own ceiling,
    // and an operator who asked for less than the ceiling keeps their number.
    timeoutMs: Math.min(budget.timeoutMs, CORE_MAX_TIMEOUT_MS),
    maxEstimatedCostUsd,
    maxTotalEstimatedCostUsd: Math.min(CORE_MAX_TOTAL_COST_USD, maxEstimatedCostUsd * maxCalls),
    declared: { ...budget },
    permittedConsequences: permittedConsequencesOf(profile.permittedConsequences, purpose),
  };
}

/**
 * `--llm-permit`, judged against Core's own list rather than the Lab's mirror
 * of it, so a class Core would refuse is refused here -- before a key is read
 * or a provider reached -- and never dropped: a request that silently carried
 * less than was asked for would leave the run to discover the gap by stopping.
 * Returned in Core's order, which is the order Core reports it back in.
 */
function permittedConsequencesOf(asked: readonly string[] | undefined, purpose: LiveLlmPurpose): readonly LlmActionConsequence[] {
  if (asked === undefined || asked.length === 0) return Object.freeze([]);
  const known: readonly string[] = AUTOMATION_STUDIO_ACTION_CONSEQUENCES;
  const unknown = asked.filter((consequence) => !known.includes(consequence));
  if (unknown.length) throw refusal(`--llm-permit ${unknown.join(",")} names a consequence class Core does not recognise; use ${known.join(", ")}`);
  if (new Set(asked).size !== asked.length) throw refusal("--llm-permit names a consequence class more than once");
  // A diagnosis asks one question and takes no action, so it has nothing to
  // permit; a permit on it is a mistaken command, not a harmless extra.
  if (purpose === "diagnosis_only") throw refusal("--llm-permit permits actions, and a diagnose run takes none");
  return Object.freeze(AUTOMATION_STUDIO_ACTION_CONSEQUENCES.filter((consequence) => asked.includes(consequence)));
}

/**
 * The run's token budget, for the Lab's post-run check. It only ever moves
 * down: a typed budget above what the authorized calls could use is held to
 * that, and one that cannot cover a single request is refused rather than
 * raised. Without one it is every authorized call at the per-request limit.
 *
 * It used to default lower, and for a creation build that acted as a
 * decision cap nobody chose: about 16k input tokens a decision on a real store
 * ran a 600,000-token budget out after about 34 decisions (lane-summary round
 * 1, rank 3). What stops a run is what it spends (`--llm-max-cost-usd`, saved
 * as the Flow's run spend ceiling), the calls it was allowed, and Core's stall
 * guard.
 */
function runTokenBudget(declared: number | undefined, perCall: number, calls: number): number {
  const exposure = perCall * calls;
  if (declared !== undefined && (!Number.isSafeInteger(declared) || declared < perCall)) {
    throw refusal(`--llm-max-run-tokens ${declared} must be a whole number of at least --llm-max-total-tokens ${perCall}`);
  }
  return declared === undefined ? exposure : Math.min(declared, exposure);
}

// `adapt` stays the narrow `diagnose_and_adapt` intent, which iterates and
// may gather evidence but may still change only one target, as a proposal.
// `repair` is the iterating repair: `explore_and_adapt`, which may gather its
// own evidence from the live page before it proposes, and whose patch Core may
// execute rather than only propose. `create-flow` is the web panel's "Explore
// and create proposal": an iterating `build_and_adapt` for one Flow build.
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
