import type { ScenarioTarget } from "./parse-target.js";

/**
 * The target as one CSS selector in the top document, for callers that hand a
 * selector string to FluxIQ (the Core round-trip probe). Role and frame
 * targets have none.
 */
export function cssSelectorForTarget(target: ScenarioTarget): string | undefined {
  if (target.kind === "testid") return `[data-testid=${JSON.stringify(target.id)}]`;
  if (target.kind === "css") return target.selector;
  return undefined;
}
