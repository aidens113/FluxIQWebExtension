// The bounded LLM profiles this Testing Lab is allowed to spend, and the Flow
// Settings fields that carry them into the panel. Every number is a ceiling a
// live run is measured against, so the profiles are frozen and the settings
// field table is derived from them rather than restated beside them.

// The single-call "author from instruction" build. The panel only offers it
// when the Flow's saved token, timeout, cost and retry limits are exactly
// these. `maxCalls` is not a Settings field: the build is one call by
// construction, and the evaluator certifies exactly one.
export const FIRST_LIVE_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 4000, maxOutputTokens: 1000,
  maxTotalTokens: 5000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
// Building a Flow by exploring a website iterates, so, like the panel's
// `WEBSITE_EXPLORATION_LIMITS`, this profile names no call count and no grant
// uses: Core picks the number, as a far-away backstop. What bounds the run is
// Core's whole-run token budget for such a request (`maxTotalTokensPerRun`:
// 12,000 per call times Core's default of 26 calls, held to 100,000), the total
// estimated cost, the evidence loop's no-progress checks, and the grant's run
// lease once claimed (Core's `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`).
// The panel issues the grant with the claim window as its TTL.
export const EVIDENCE_GUIDED_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000,
  maxTotalTokens: 12_000, maxTotalTokensPerRun: 100_000, timeoutSeconds: 45,
  grantClaimWindowSeconds: 60, runLeaseSeconds: 600,
  maxEstimatedCostUsd: 0.25, maxTotalEstimatedCostUsd: 1, providerRetries: 0,
});
// The Flow Settings an exploration Flow is given.
export const EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000,
  maxTotalTokens: 12_000, timeoutSeconds: 25,
  maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
export const LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD = 100_000;
// Mirrors the panel's `WEBSITE_EXPLORATION_COMMAND_TIMEOUT_MS`: the grant may be
// claimed at the end of its claim window, then runs its whole lease, and the
// answer still has to come back.
export const EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS = (EVIDENCE_GUIDED_CREATION_LIMITS.grantClaimWindowSeconds + EVIDENCE_GUIDED_CREATION_LIMITS.runLeaseSeconds) * 1_000 + 15_000;

export type CreationSettingsLimits = typeof FIRST_LIVE_CREATION_LIMITS | typeof EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS;

// The Flow Settings form offers no call limit (runs iterate within Core's cost,
// token, deadline and no-progress guards), so no profile types one.
export function creationSettingsFields(limits: CreationSettingsLimits): ReadonlyArray<readonly [label: string, value: string]> {
  return [
    ["Input tokens", String(limits.maxInputTokens)],
    ["Output tokens", String(limits.maxOutputTokens)],
    ["Total tokens", String(limits.maxTotalTokens)],
    ["Timeout (seconds)", String(limits.timeoutSeconds)],
    ["Max cost (USD)", String(limits.maxEstimatedCostUsd)],
    ["Provider retries", String(limits.providerRetries)],
  ];
}
