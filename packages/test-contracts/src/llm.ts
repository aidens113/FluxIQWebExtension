export const LLM_LAB_SCHEMA_VERSION = "0.1" as const;
/**
 * The DeepSeek models a live Lab run may name, mirroring FluxIQ Core's
 * `AUTOMATION_STUDIO_DEEPSEEK_MODELS` (`runtime/llm/deepseek/models.ts`),
 * because this package depends only on Core's public contracts.
 *
 * It is a set rather than one string on purpose. Until 2026-09-23 every layer
 * on both sides of the boundary compared against the literal `"deepseek-chat"`,
 * so when DeepSeek retired that alias the only way to run at all was a
 * simultaneous source edit in Core and here. A model the operator names is now
 * a setting; what is refused is an id neither repository is configured for.
 */
export const llmModels = ["deepseek-flash", "deepseek-v4-pro"] as const;
export type LlmModel = (typeof llmModels)[number];
/** What `--llm-model` means when the operator does not give one: DeepSeek-V4.1-Flash. */
export const DEFAULT_LLM_MODEL: LlmModel = "deepseek-flash";
export function isLlmModel(value: unknown): value is LlmModel {
  return typeof value === "string" && (llmModels as readonly string[]).includes(value);
}
/**
 * The most a single request may carry: the model's own context window, input
 * and output together. FluxIQ Core holds it as `contextTokens` in
 * `AUTOMATION_STUDIO_DEEPSEEK_MODEL_LIMITS`
 * (`packages/fluxiq/src/programs/automation-studio/runtime/llm/deepseek/models.ts`),
 * 1,000,000 tokens for both `deepseek-flash` and `deepseek-v4-pro`; it is
 * mirrored here because this package depends only on Core's public contracts.
 *
 * It is not a budget. On 2026-09-30 the user ordered that no limit hide page
 * information from the model: the only bound on a request's size is what the
 * model can read, and a request over it fails loudly rather than being
 * trimmed. It used to be Core's own 64,000-token ceiling (and 50,000 before
 * that), which with the Lab's 48,000-token default made a real page impossible
 * to describe. What bounds a run is cost, the per-run token budget, the call
 * ceiling and the deadline.
 */
export const LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST = 1_000_000 as const;
/**
 * The most provider calls any Lab run may declare: the Lab's own backstop
 * against a runaway loop. Core enforces no call ceiling of its own.
 *
 * It is deliberately far above what an adaptation needs and is not a per-task
 * count. An adaptation iterates for as many calls as it needs; what is meant to
 * stop it is cost, tokens, the recovery deadline and a lack of progress. A
 * two-call ceiling used to live here, and it made every real recovery that
 * asked for evidence unreachable.
 */
export const LLM_LAB_MAX_CALLS_PER_RUN = 64 as const;
export const LLM_LAB_MAX_ESTIMATED_COST_USD = 0.25 as const;

/**
 * `repair` is the iterating repair of a Flow that failed: the Lab plans it as
 * Core's `explore_and_adapt`, which may gather evidence of its own before it
 * proposes a change. `adapt` stays the narrower `diagnose_and_adapt`, which
 * proposes one target override and never explores beyond the failure record.
 */
export const llmTaskKinds = ["create-flow", "refine-recording", "edit-flow", "diagnose", "adapt", "repair"] as const;
export type LlmTaskKind = (typeof llmTaskKinds)[number];

export const llmEvidenceKinds = [
  "scenario-goal", "registered-capabilities", "flow-graph", "recording-events",
  "redacted-page-facts", "runtime-failure", "runtime-trace",
] as const;
export type LlmEvidenceKind = (typeof llmEvidenceKinds)[number];

/**
 * The lasting consequences a person can permit a live run's actions to have:
 * FluxIQ Core's closed set, `AUTOMATION_STUDIO_ACTION_CONSEQUENCES` in
 * `runtime/action-permissions/consequences.ts`, in Core's order. Mirrored
 * because this package depends only on Core's public contracts; the test
 * runner's plan tests pin it to Core's own export, so a class Core adds or
 * renames fails the build here instead of being refused by Core at run time.
 */
export const llmActionConsequences = ["move_money", "delete", "send_or_publish", "modify_existing", "create_new"] as const;
export type LlmActionConsequence = (typeof llmActionConsequences)[number];

export type LlmTokenBudget = {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokensPerRequest: number;
  maxCallsPerRun: number;
  /**
   * The tokens the whole run may use, across every call, held by the Lab's
   * post-run check. Absent means `maxTotalTokensPerRequest * maxCallsPerRun`.
   */
  maxTotalTokensPerRun?: number;
  timeoutMs: number;
  maxRetries: number;
  maxEstimatedCostUsd: number;
};

export type LlmExecutionProfile = {
  schemaVersion: typeof LLM_LAB_SCHEMA_VERSION;
  profileId: string;
  mode: "deterministic-dry" | "live";
  provider?: string;
  model?: string;
  task: LlmTaskKind;
  scenarioNetworkPolicy: "loopback-only";
  providerEgressPolicy: "core-trusted-provider-only";
  externalSideEffects: false;
  approvalMode: "manual";
  retainRawPrompts: false;
  retainRawResponses: false;
  maxConcurrentRuns: 1;
  budget: LlmTokenBudget;
  /**
   * `--llm-permit`: the consequences this run permits its actions to have,
   * sent with the build or the run as `permittedConsequences` and nowhere
   * else. It is consequence permission only: a model call needs no grant.
   * Absent permits none, as it does in Core, so a run nobody permitted
   * anything stops and asks exactly as before. Live runs only, each class at
   * most once.
   *
   * This is not `externalSideEffects`, which stays `false`: that is about a run
   * reaching past the loopback fixture, and a permitted consequence lands on the
   * fixture's own state -- the post it schedules, the order it refunds.
   */
  permittedConsequences?: LlmActionConsequence[];
};

export const DEFAULT_LLM_LAB_BUDGET: Readonly<LlmTokenBudget> = Object.freeze({
  // The model's whole context window less room for the reply: a request may
  // carry as much of the page as the model can read, and nothing in the Lab
  // trims it first -- see LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST.
  //
  // They were 8k in, 2k out, 10k per request, then 48k/8k/56k under Core's
  // 64k ceiling, and each was a blocker in turn. Describing a real page costs
  // tokens: on 2026-09-17, across thirty-six live creation tasks, the input
  // guard fired before the request was sent on every page holding an infinite
  // feed, a multi-tab order lookup, an auth gate or a virtualised admin list,
  // so those runs produced no Flow at all.
  //
  // What bounds a run is cost, the per-run token budget (absent, it is this
  // request size times the call count) and the deadline -- never a
  // per-request ceiling below what the model can read.
  maxInputTokens: LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST - 8_000,
  maxOutputTokens: 8_000,
  maxTotalTokensPerRequest: LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST,
  // What an iterating run declares when the operator names no call count:
  // a diagnosis, a patch, and the exploration's own default ceiling of 24
  // decisions. Tokens are bounded separately, by `maxTotalTokensPerRun`, so a
  // larger count does not by itself raise what a run may spend.
  maxCallsPerRun: 26,
  timeoutMs: 30_000,
  maxRetries: 0,
  maxEstimatedCostUsd: LLM_LAB_MAX_ESTIMATED_COST_USD,
});

export function createDeterministicDryLlmProfile(task: LlmTaskKind = "diagnose"): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "deterministic-dry",
    mode: "deterministic-dry",
    task,
    scenarioNetworkPolicy: "loopback-only",
  providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: { ...DEFAULT_LLM_LAB_BUDGET, maxCallsPerRun: 0, maxEstimatedCostUsd: 0 },
  };
}

export type LlmScenarioTask = {
  schemaVersion: typeof LLM_LAB_SCHEMA_VERSION;
  task: LlmTaskKind;
  goal: string;
  allowedEvidence: LlmEvidenceKind[];
  allowedActions: string[];
  forbiddenActions: string[];
  requiredConstraints: string[];
  expectedOutcome: "proposal" | "diagnosis" | "adaptation";
  reviewRequired: true;
  deterministicReplayRequired: true;
};

export type LlmInvocationProvenance = {
  schemaVersion: typeof LLM_LAB_SCHEMA_VERSION;
  requestId: string;
  profileId: string;
  provider: string;
  model: string;
  task: LlmTaskKind;
  promptSchemaVersion: string;
  attempt: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  usageSource: "provider-reported" | "estimated" | "unavailable";
  latencyMs: number;
  estimatedCostUsd?: number;
  outcome: "succeeded" | "rejected" | "failed" | "cancelled";
  errorCategory?: string;
  sanitized: true;
  rawPromptRetained: false;
  rawResponseRetained: false;
};

export type LlmRunEvaluation = {
  schemaVersion: typeof LLM_LAB_SCHEMA_VERSION;
  runId: string;
  profileId: string;
  task: LlmTaskKind;
  invocations: LlmInvocationProvenance[];
  maxCallsPerRun: number;
  proposalValidated: boolean;
  reviewOutcome: "not-applicable" | "pending" | "approved" | "rejected";
  applyOutcome: "not-attempted" | "applied" | "rejected" | "reverted";
  deterministicReplay: {
    required: true;
    completed: boolean;
    passed?: boolean;
    llmCalls: 0;
  };
  safetyPassed: boolean;
  verdict: "passed" | "failed" | "inconclusive";
  reasons: string[];
};
