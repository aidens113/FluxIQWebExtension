import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_MAX_CALLS_PER_RUN } from "@fluxiq-web-extension/test-contracts";
import { DEFAULT_DEMO_LLM_CREATION_PROFILE, resolveDemoLlmCreationProfile } from "../demo-llm-profile.js";

test("creation profiles default to the lab's iterating call count, not a fixed two", () => {
  assert.equal(DEFAULT_DEMO_LLM_CREATION_PROFILE.budget.maxCallsPerRun, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);
  assert.equal(resolveDemoLlmCreationProfile().budget.maxCallsPerRun, 26);
  assert.equal(resolveDemoLlmCreationProfile(["--llm-profile", "conservative"]).budget.maxCallsPerRun, 26);
});

test("creation profiles accept any call count up to the lab ceiling and reject one above it", () => {
  assert.equal(resolveDemoLlmCreationProfile(["--llm-max-calls", "3"]).budget.maxCallsPerRun, 3);
  assert.equal(resolveDemoLlmCreationProfile(["--llm-max-calls", String(LLM_LAB_MAX_CALLS_PER_RUN)]).budget.maxCallsPerRun, 64);
  assert.throws(
    () => resolveDemoLlmCreationProfile(["--llm-max-calls", "65"]),
    (error: unknown) => error instanceof Error && error.name === "ContractValidationError",
  );
});
