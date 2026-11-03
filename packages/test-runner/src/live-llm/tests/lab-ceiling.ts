// The per-build cost ceiling the Lab's tests plan against: Core's own test
// default, so every amount a test derives comes from Core rather than a number
// written into the test. It is never this checkout's configuration. It used to
// resolve from the process's environment and the checkout's `.env`/`.env.local`,
// so what the suite passed or failed followed whatever ceiling this machine had
// set: no failures at $0.10, one at $5, ten at $8. A test of a configured ceiling
// writes its own env file in a directory it made (`cost-ceiling-reach.test.ts`).

import type { LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD } from "fluxiq/automation";
import { planLiveLlmExecution, type LiveLlmPlan } from "../live-llm-plan.js";

/** The ceiling, in US dollars, that a Lab run with nothing configured holds a build to. */
export const LAB_CEILING_USD = AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD;

/** `profile` planned against {@link LAB_CEILING_USD}. */
export function planAtLabCeiling(profile: LlmExecutionProfile): LiveLlmPlan {
  return planLiveLlmExecution(profile, LAB_CEILING_USD);
}
