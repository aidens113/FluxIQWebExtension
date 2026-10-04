// The most one Flow build may spend on the model, in all, whatever its call
// count: Core's per-build ceiling, `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default
// $0.10, the user's rule; it was a fixed $0.25).
//
// The Lab passes that variable, with explicit test scope, to every Core it
// starts from its own environment or `.env`/`.env.local`. A run flag only lowers it
// (`./cost-ceiling-env.ts`). The Lab's plan, its post-run check and its spend
// reports must hold a build to the very same number, so this reads the same
// sources in the same order and resolves the value through Core's own
// resolver: the value and its validation are Core's, and a value Core would
// refuse at start is refused here too. Read when asked rather than at import,
// which saw only the Lab's own environment and so missed the flag and the
// files. A recovery run, and each re-author build, is held to it on its own;
// `--llm-max-cost-usd` may only lower it, and nothing multiplies it by a call
// count.

import { AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV, resolveAutomationStudioLlmRunCostCeilingUsd } from "fluxiq/automation-studio";
import { LAB_COST_CEILING_SCOPE_ENV, labCostCeilingValue } from "./cost-ceiling-env.js";

/**
 * The per-build cost ceiling, in US dollars, that the Core started for this run
 * resolves: env, then .env/.env.local, else $0.10. The run flag only lowers it.
 * Core's ordinary user defaults are independent. Invalid or raised amounts fail.
 */
export function liveLlmBuildCostCeilingUsd(repositoryRoot: string, args: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): number {
  const value = labCostCeilingValue(repositoryRoot, args, env);
  return resolveAutomationStudioLlmRunCostCeilingUsd({ [LAB_COST_CEILING_SCOPE_ENV]: "test", [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV]: value });
}
