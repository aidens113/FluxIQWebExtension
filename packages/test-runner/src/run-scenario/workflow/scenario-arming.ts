import type { ResolvedScenarioWorkflow, ScenarioArming } from "@fluxiq-web-extension/test-contracts";

/** The fields of a run's options that decide which lane it runs on. */
export type ScenarioArmingOptions = { flow?: boolean; creation?: unknown };

/**
 * When this run arms its variant relative to the first page load, which is all
 * the page-fact schedule needs to know about the lane. Both Flow lanes present
 * the unarmed rendering first and arm before the page they explore or run.
 * `resolveWorkflow` has already refused a variant on any other combination, so
 * a resolved variant on neither is the existing or clone lane, which arms
 * before it opens the fixture and never presents the unarmed rendering.
 */
export function armingOf(options: ScenarioArmingOptions, workflow: ResolvedScenarioWorkflow): ScenarioArming {
  if (options.flow || options.creation) return "arms-after-loading";
  return workflow.variant ? "arms-before-loading" : "unarmed";
}
