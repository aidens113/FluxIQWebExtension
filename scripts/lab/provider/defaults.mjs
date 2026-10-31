/** User's live-test preference, 2026-10-30. Mirrored by test-contracts' model registry. */
export const LIVE_LLM_DEFAULT_PROVIDER = "anthropic";
export const LIVE_LLM_PROVIDER_DEFAULT_MODELS = Object.freeze({ anthropic: "claude-sonnet-5-5", deepseek: "deepseek-flash" });
export const LIVE_LLM_DEFAULT_MODEL = LIVE_LLM_PROVIDER_DEFAULT_MODELS[LIVE_LLM_DEFAULT_PROVIDER];
export const LIVE_LLM_DEFAULT_COST_USD = 5;
export const LIVE_LLM_CREDENTIAL_NAMES = Object.freeze({
  anthropic: Object.freeze(["CLAUDE_API_KEY", "ANTHROPIC_API_KEY"]),
  deepseek: Object.freeze(["DEEPSEEK_API_KEY"]),
});
