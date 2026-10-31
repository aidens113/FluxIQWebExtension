import assert from "node:assert/strict";
import test from "node:test";
import { CLAUDE_LIVE_BUILD_COST_USD, DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER, defaultLlmModelForProvider, isLlmModelForProvider, llmProviderForModel } from "../../dist/index.js";
import { LIVE_LLM_DEFAULT_COST_USD, LIVE_LLM_DEFAULT_MODEL, LIVE_LLM_DEFAULT_PROVIDER } from "../../../../scripts/lab/provider/index.mjs";
import { withoutProviderSecrets } from "../../../../scripts/provider-secret-environment.mjs";

test("every live entry has the same Claude default and provider/model pairing", () => {
  assert.equal(DEFAULT_LLM_PROVIDER, "anthropic");
  assert.equal(DEFAULT_LLM_MODEL, "claude-sonnet-5-5");
  assert.equal(LIVE_LLM_DEFAULT_PROVIDER, DEFAULT_LLM_PROVIDER);
  assert.equal(LIVE_LLM_DEFAULT_MODEL, DEFAULT_LLM_MODEL);
  assert.equal(CLAUDE_LIVE_BUILD_COST_USD, 5);
  assert.equal(LIVE_LLM_DEFAULT_COST_USD, CLAUDE_LIVE_BUILD_COST_USD);
  assert.equal(DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd, CLAUDE_LIVE_BUILD_COST_USD);
  assert.equal(defaultLlmModelForProvider("deepseek"), "deepseek-flash");
  assert.equal(isLlmModelForProvider("deepseek", DEFAULT_LLM_MODEL), false);
  assert.equal(isLlmModelForProvider("anthropic", "deepseek-flash"), false);
  assert.equal(llmProviderForModel("claude-haiku-5-5"), "anthropic");
});

test("both Claude credential names are stripped before child processes start", () => {
  assert.deepEqual(withoutProviderSecrets({ CLAUDE_API_KEY: "fixture-claude-key", ANTHROPIC_API_KEY: "fixture-alias-key", PATH: "fixture-path" }), { PATH: "fixture-path" });
});
