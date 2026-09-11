import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DEMO_LLM_CREATION_PROFILE, resolveDemoLlmCreationProfile } from "../demo-llm-profile.js";

test("production creation profile stays within the lab call ceiling", () => {
  assert.equal(DEFAULT_DEMO_LLM_CREATION_PROFILE.budget.maxCallsPerRun, 2);
  assert.equal(resolveDemoLlmCreationProfile().budget.maxCallsPerRun, 2);
});

test("creation profiles reject call counts above the lab ceiling", () => {
  assert.throws(
    () => resolveDemoLlmCreationProfile(["--llm-max-calls", "3"]),
    (error: unknown) => error instanceof Error && error.name === "ContractValidationError",
  );
});
