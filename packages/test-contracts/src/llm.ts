export const LLM_LAB_SCHEMA_VERSION = "0.1" as const;
/**
 * The most a single request may carry, which is deepseek-chat's own 64k context
 * rather than a number chosen here. It was 50,000, and that was the fifth and
 * last of the ceilings that between them made a real page impossible to
 * describe on 2026-09-17 -- the others being this file's default budget, the
 * Lab plan's cap, Core's grant default and Core's provider-side rejection.
 * Raising any one of them alone was silently overridden by the next.
 */
export const LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST = 64_000 as const;
/**
 * The most provider calls any Lab run may declare: FluxIQ Core's absolute
 * backstop against a runaway loop (`AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS`
 * in Core's `runtime/llm/execution-grants.ts`), mirrored because this package
 * depends only on Core's public contracts.
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

export type LlmTokenBudget = {
  maxInputTokens: number;
  maxOutputTokens: number;
  maxTotalTokensPerRequest: number;
  maxCallsPerRun: number;
  /**
   * The tokens the whole run may use, across every call. Absent means the
   * provider-side default: the smaller of `maxTotalTokensPerRequest *
   * maxCallsPerRun` and Core's high-token confirmation threshold.
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
};

export const DEFAULT_LLM_LAB_BUDGET: Readonly<LlmTokenBudget> = Object.freeze({
  // Sized to the model's real context window, not to a number someone picked.
  // deepseek-chat carries 64k, so these are what the provider actually allows
  // less room for the reply.
  //
  // They used to be 8k in, 2k out, 10k per request, and that was the single
  // biggest blocker measured on 2026-09-17. Describing a real page costs
  // tokens: across thirty-six live creation tasks, the input guard fired
  // before the request was ever sent on the slice holding an infinite feed, a
  // multi-tab order lookup, an auth gate and an admin console with a
  // virtualised list -- that slice scored zero of six while the slice of small
  // forms scored six of seven. The grant ends on that error, so those runs
  // produced no Flow at all and the page shapes went untested. An empty table
  // tripped it too, which is how little headroom 8k left.
  //
  // What bounds a run is cost, the per-run token budget and the deadline --
  // never a per-request ceiling that makes a real page impossible to describe.
  maxInputTokens: 48_000,
  maxOutputTokens: 8_000,
  maxTotalTokensPerRequest: 56_000,
  // What an iterating run declares when the operator names no call count:
  // Core's `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS` -- a
  // diagnosis, a patch, and the exploration's own default ceiling of 24
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
