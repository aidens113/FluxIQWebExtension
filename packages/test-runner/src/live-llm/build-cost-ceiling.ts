// The most one Flow build may spend on the model, in all, whatever its call
// count: Core's per-build ceiling, `FLUXIQ_LLM_RUN_COST_CEILING_USD` (default
// $0.10, the user's rule; it was a fixed $0.25).
//
// The Lab passes that variable to every Core it starts from the run's
// `--llm-cost-ceiling-usd` flag, its own environment, or `.env`/`.env.local`
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
import { labCostCeilingValue } from "./cost-ceiling-env.js";

/**
 * The per-build cost ceiling, in US dollars, that the Core started for this run
 * resolves: from `args`' `--llm-cost-ceiling-usd`, then `env`, then `.env` and
 * `.env.local` under `repositoryRoot`, else Core's default. Throws as Core does
 * on a value that is not a usable amount.
 */
export function liveLlmBuildCostCeilingUsd(repositoryRoot: string, args: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): number {
  const value = labCostCeilingValue(repositoryRoot, args, env);
  return resolveAutomationStudioLlmRunCostCeilingUsd(value === undefined ? {} : { [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV]: value });
}
