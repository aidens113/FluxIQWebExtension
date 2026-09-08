import {
  LLM_LAB_SCHEMA_VERSION,
  assertLlmExecutionProfile,
  type LlmExecutionProfile,
  type LlmTokenBudget,
} from "@fluxiq-web-extension/test-contracts";

export const DEMO_LLM_PROFILE_NAMES = ["production", "conservative"] as const;
export type DemoLlmProfileName = (typeof DEMO_LLM_PROFILE_NAMES)[number];

const PROFILE_BUDGETS: Readonly<Record<DemoLlmProfileName, Readonly<LlmTokenBudget>>> = Object.freeze({
  production: Object.freeze({ maxInputTokens: 42_000, maxOutputTokens: 8_000, maxTotalTokensPerRequest: 50_000, maxCallsPerRun: 2, timeoutMs: 60_000, maxRetries: 0, maxEstimatedCostUsd: 0.25 }),
  conservative: Object.freeze({ maxInputTokens: 12_000, maxOutputTokens: 4_000, maxTotalTokensPerRequest: 16_000, maxCallsPerRun: 2, timeoutMs: 60_000, maxRetries: 0, maxEstimatedCostUsd: 0.25 }),
});

export const DEFAULT_DEMO_LLM_CREATION_PROFILE = createProfile("production", PROFILE_BUDGETS.production);

export function resolveDemoLlmCreationProfile(argv: readonly string[] = [], environment: NodeJS.ProcessEnv = {}): Readonly<LlmExecutionProfile> {
  const allowed = new Set(["--llm-profile", "--llm-max-input-tokens", "--llm-max-output-tokens", "--llm-max-total-tokens", "--llm-max-calls", "--llm-timeout-ms", "--llm-max-retries", "--llm-max-cost-usd"]);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!name || !allowed.has(name) || argv[index + 1] === undefined) throw new Error("Demo LLM profile arguments are malformed");
  }
  const option = (name: string, envName: string): string | undefined => {
    const index = argv.indexOf(name);
    if (index >= 0 && argv.lastIndexOf(name) !== index) throw new Error("Demo LLM profile options may not be repeated");
    return index >= 0 ? argv[index + 1] : environment[envName];
  };
  const requestedName = option("--llm-profile", "FLUXIQ_LLM_PROFILE") ?? "production";
  if (!DEMO_LLM_PROFILE_NAMES.includes(requestedName as DemoLlmProfileName)) throw new Error("Demo LLM profile is unsupported");
  const name = requestedName as DemoLlmProfileName;
  const base = PROFILE_BUDGETS[name];
  const integer = (flag: string, envName: string, fallback: number): number => {
    const raw = option(flag, envName);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed)) throw new Error("Demo LLM integer limit is invalid");
    return parsed;
  };
  const costRaw = option("--llm-max-cost-usd", "FLUXIQ_LLM_MAX_COST_USD");
  const maxEstimatedCostUsd = costRaw === undefined ? base.maxEstimatedCostUsd : Number(costRaw);
  if (!Number.isFinite(maxEstimatedCostUsd)) throw new Error("Demo LLM cost limit is invalid");
  const budget: LlmTokenBudget = {
    maxInputTokens: integer("--llm-max-input-tokens", "FLUXIQ_LLM_MAX_INPUT_TOKENS", base.maxInputTokens),
    maxOutputTokens: integer("--llm-max-output-tokens", "FLUXIQ_LLM_MAX_OUTPUT_TOKENS", base.maxOutputTokens),
    maxTotalTokensPerRequest: integer("--llm-max-total-tokens", "FLUXIQ_LLM_MAX_TOTAL_TOKENS", base.maxTotalTokensPerRequest),
    maxCallsPerRun: integer("--llm-max-calls", "FLUXIQ_LLM_MAX_CALLS", base.maxCallsPerRun),
    timeoutMs: integer("--llm-timeout-ms", "FLUXIQ_LLM_TIMEOUT_MS", base.timeoutMs),
    maxRetries: integer("--llm-max-retries", "FLUXIQ_LLM_MAX_RETRIES", base.maxRetries),
    maxEstimatedCostUsd,
  };
  if (budget.timeoutMs % 1_000 !== 0) throw new Error("Demo LLM timeout must use whole seconds");
  return createProfile(name, budget);
}

function createProfile(name: DemoLlmProfileName, budget: LlmTokenBudget): Readonly<LlmExecutionProfile> {
  const profile: LlmExecutionProfile = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: `deepseek-flow-bootstrap-${name}`,
    mode: "live",
    provider: "deepseek",
    model: "deepseek-chat",
    task: "create-flow",
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: { ...budget },
  };
  assertLlmExecutionProfile(profile);
  return Object.freeze({ ...profile, budget: Object.freeze({ ...profile.budget }) });
}
