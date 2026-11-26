import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DEMO_LLM_CREATION_PROFILE, resolveDemoLlmCreationProfile } from "../demo-llm-profile.js";

test("creation profiles carry no call count", () => {
  assert.equal("maxCallsPerRun" in DEFAULT_DEMO_LLM_CREATION_PROFILE.budget, false);
  assert.equal("maxCallsPerRun" in resolveDemoLlmCreationProfile().budget, false);
  assert.equal("maxCallsPerRun" in resolveDemoLlmCreationProfile(["--llm-profile", "conservative"]).budget, false);
});

test("creation profiles refuse --llm-max-calls and name the purse", () => {
  assert.throws(() => resolveDemoLlmCreationProfile(["--llm-max-calls", "3"]), /no count of calls exists.*--llm-max-cost-usd/su);
});
