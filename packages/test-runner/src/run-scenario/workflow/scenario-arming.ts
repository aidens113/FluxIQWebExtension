import type { ResolvedScenarioWorkflow, ScenarioArming } from "@fluxiq-web-extension/test-contracts";

/** The field of a run's options that decides which lane it runs on. */
export type ScenarioArmingOptions = { creation?: unknown };

/**
 * When this run arms its variant relative to the first page load, which is all
 * the page-fact schedule needs to know about the lane. The created-Flow lane
 * presents the unarmed rendering first and arms before the page it explores or
 * runs. `resolveWorkflow` has already refused a variant on any other
 * combination, so a resolved variant off that lane is the existing or clone
 * lane, which arms before it opens the fixture and never presents the unarmed
 * rendering.
 */
export function armingOf(options: ScenarioArmingOptions, workflow: ResolvedScenarioWorkflow): ScenarioArming {
  if (options.creation) return "arms-after-loading";
  return workflow.variant ? "arms-before-loading" : "unarmed";
}
