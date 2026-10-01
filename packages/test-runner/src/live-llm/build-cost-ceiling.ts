// The most one Flow build may spend on the model, in all, whatever its call
// count: Core's per-build ceiling, $0.25 (the user's rule). Imported from Core
// rather than copied, so the Lab's plan, its post-run check and its spend
// reports cannot drift from what Core enforces. A recovery run, and each
// re-author build, is held to it on its own; `--llm-max-cost-usd` may only
// lower it, and nothing multiplies it by a call count.

import { AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD } from "fluxiq/automation-studio";

export const LIVE_LLM_BUILD_COST_CEILING_USD: number = AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD;
