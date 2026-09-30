import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";
// The bounded LLM profiles this Testing Lab is allowed to spend, and the Flow
// Settings fields that carry them into the panel. Every number is a ceiling a
// live run is measured against, so the profiles are frozen and the settings
// field table is derived from them rather than restated beside them.

// The single-call "author from instruction" build. The panel only offers it
// when the Flow's saved token, timeout, cost and retry limits are exactly
// these. `maxCalls` is not a Settings field: the build is one call by
// construction, and the evaluator certifies exactly one.
export const FIRST_LIVE_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: DEFAULT_LLM_MODEL, maxInputTokens: 4000, maxOutputTokens: 1000,
  maxTotalTokens: 5000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
// Building a Flow by exploring a website iterates, so, like the panel's
// `WEBSITE_EXPLORATION_LIMITS`, this profile names no call count: Core picks
// the number, as a far-away backstop. What bounds the run is the Flow's spend
// ceiling, the evidence loop's no-progress checks, and the run's deadline. A
// model call needs no grant, so nothing is issued or claimed first.
export const EVIDENCE_GUIDED_CREATION_LIMITS = Object.freeze({
  // Live: published as the provider budget an exploration actually runs under.
  // It carried 8,000 in / 12,000 per request and a 100,000 run budget, which is
  // the exact size measured as unable to describe a realistic page -- and a run
  // budget that leaves no exploration decision affordable once the patch
  // reserve is held. Both follow the shared budget now.
  provider: "deepseek", model: DEFAULT_LLM_MODEL,
  maxInputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens, maxOutputTokens: DEFAULT_LLM_LAB_BUDGET.maxOutputTokens,
  maxTotalTokens: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest,
  maxTotalTokensPerRun: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest * 10, timeoutSeconds: 45,
  runDeadlineSeconds: 600,
  // The whole build's spend is Core's $0.25 ceiling on a Flow build; it was $1,
  // four builds' worth, which Core no longer allows.
  maxEstimatedCostUsd: 0.25, maxTotalEstimatedCostUsd: 0.25, providerRetries: 0,
});
// The Flow Settings an exploration Flow is given.
// 8,000 input tokens is the exact size measured, across thirty-six live
// creation tasks, as unable to describe any realistic page in the corpus: the
// guard fired before the request was ever sent and the run built nothing. These
// follow the shared budget rather than repeating numbers of their own.
export const EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS = Object.freeze({
  provider: "deepseek", model: DEFAULT_LLM_MODEL,
  maxInputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens, maxOutputTokens: DEFAULT_LLM_LAB_BUDGET.maxOutputTokens,
  maxTotalTokens: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest, timeoutSeconds: 25,
  maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
// Mirrors the panel's `WEBSITE_EXPLORATION_COMMAND_TIMEOUT_MS`: the run's whole
// deadline, and the answer still has to come back. The extra 75 seconds match
// the panel's own number, so this wait is never shorter than the panel's.
export const EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS = EVIDENCE_GUIDED_CREATION_LIMITS.runDeadlineSeconds * 1_000 + 75_000;

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
