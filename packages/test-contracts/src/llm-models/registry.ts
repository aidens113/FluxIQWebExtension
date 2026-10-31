/** Lab routing only. Provider HTTP, pricing and runtime resolution belong to Core. */
export const llmProviderModels = {
  anthropic: ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"],
  deepseek: ["deepseek-flash", "deepseek-v4-pro"],
} as const;

export type LlmProvider = keyof typeof llmProviderModels;
export type LlmModel = (typeof llmProviderModels)[LlmProvider][number];

/** User preference, 2026-10-30: all live tests default to Claude. No credential fallback. */
export const DEFAULT_LLM_PROVIDER: LlmProvider = "anthropic";
export const DEFAULT_LLM_MODEL: LlmModel = "claude-sonnet-5-5";
/** User's Claude live-test allowance, 2026-10-30; a whole build, not each call. */
export const CLAUDE_LIVE_BUILD_COST_USD = 5;
export const llmModels = [...llmProviderModels.anthropic, ...llmProviderModels.deepseek] as const;

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && Object.hasOwn(llmProviderModels, value);
}

export function isLlmModel(value: unknown): value is LlmModel {
  return typeof value === "string" && (llmModels as readonly string[]).includes(value);
}

export function isLlmModelForProvider(provider: LlmProvider, model: unknown): model is LlmModel {
  return typeof model === "string" && (llmProviderModels[provider] as readonly string[]).includes(model);
}

export function defaultLlmModelForProvider(provider: LlmProvider): LlmModel {
  return llmProviderModels[provider][0];
}

export function llmProviderForModel(model: LlmModel): LlmProvider {
  return isLlmModelForProvider("anthropic", model) ? "anthropic" : "deepseek";
}
