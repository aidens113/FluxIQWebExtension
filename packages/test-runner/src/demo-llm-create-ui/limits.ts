// The bounded LLM profiles this Testing Lab is allowed to spend, and the Flow
// Settings fields that carry them into the panel. Every number is a ceiling a
// live run is measured against, so the profiles are frozen and the settings
// field table is derived from them rather than restated beside them.

export const FIRST_LIVE_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 4000, maxOutputTokens: 1000,
  maxTotalTokens: 5000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
export const EVIDENCE_GUIDED_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000,
  maxTotalTokens: 12_000, maxCalls: 4, maxUses: 4, timeoutSeconds: 45,
  maxEstimatedCostUsd: 0.25, maxTotalEstimatedCostUsd: 1, providerRetries: 0,
});
export const EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000,
  maxTotalTokens: 12_000, maxCalls: 4, timeoutSeconds: 25,
  maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
export const LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD = 100_000;
export const EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS = EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls * EVIDENCE_GUIDED_CREATION_LIMITS.timeoutSeconds * 1_000 + 15_000;

export type CreationSettingsLimits = typeof FIRST_LIVE_CREATION_LIMITS | typeof EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS;

export function creationSettingsFields(limits: CreationSettingsLimits) {
  return [["Input tokens", String(limits.maxInputTokens)], ["Output tokens", String(limits.maxOutputTokens)], ["Total tokens", String(limits.maxTotalTokens)], ["Max calls", String(limits.maxCalls)], ["Timeout (seconds)", String(limits.timeoutSeconds)], ["Max cost (USD)", String(limits.maxEstimatedCostUsd)], ["Provider retries", String(limits.providerRetries)]] as const;
}
