import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

/**
 * A recording script with `inserted` placed right after the step named `afterId`, for the demonstrations
 * that start from a site's honest workflow and add detours to it. A missing anchor fails loudly, so a
 * workflow that changes its steps cannot silently drop a detour.
 */
export function insertAfterStep(script: readonly ScenarioStep[], afterId: string, inserted: readonly ScenarioStep[]): ScenarioStep[] {
  const at = script.findIndex((step) => step.id === afterId);
  if (at < 0) throw new Error(`The workflow has no step "${afterId}" to insert a demonstration detour after.`);
  return [...script.slice(0, at + 1), ...inserted, ...script.slice(at + 1)];
}
