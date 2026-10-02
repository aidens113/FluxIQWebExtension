// The per-build cost ceiling the Lab's tests plan against: the one a Lab run
// from this checkout would hold its builds to (`liveLlmBuildCostCeilingUsd`),
// read from this process's arguments and environment and the checkout's
// `.env`/`.env.local`, so every amount a test derives follows whatever the
// developer configured rather than a number written into the test.

import { fileURLToPath } from "node:url";
import type { LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { liveLlmBuildCostCeilingUsd } from "../build-cost-ceiling.js";
import { planLiveLlmExecution, type LiveLlmPlan } from "../live-llm-plan.js";

/** The checkout this test build belongs to (`packages/test-runner/dist/live-llm/tests/` is five levels down). */
export const TEST_REPOSITORY_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));

/** The ceiling, in US dollars, as the Lab resolves it for this checkout. */
export const LAB_CEILING_USD = liveLlmBuildCostCeilingUsd(TEST_REPOSITORY_ROOT);

/** `profile` planned against {@link LAB_CEILING_USD}. */
export function planAtLabCeiling(profile: LlmExecutionProfile): LiveLlmPlan {
  return planLiveLlmExecution(profile, LAB_CEILING_USD);
}
