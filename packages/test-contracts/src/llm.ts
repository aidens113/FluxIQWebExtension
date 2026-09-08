export const LLM_LAB_SCHEMA_VERSION = "0.1" as const;
export const LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST = 50_000 as const;
export const LLM_LAB_MAX_CALLS_PER_RUN = 2 as const;
export const LLM_LAB_MAX_ESTIMATED_COST_USD = 0.25 as const;

export const llmTaskKinds = ["create-flow", "refine-recording", "edit-flow", "diagnose", "adapt"] as const;
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
  maxInputTokens: 8_000,
  maxOutputTokens: 2_000,
  maxTotalTokensPerRequest: 10_000,
  maxCallsPerRun: 2,
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
