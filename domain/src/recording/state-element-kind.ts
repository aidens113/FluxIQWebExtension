import type { AutomationStudioStateElementKindReader } from "fluxiq/automation";

/**
 * The web's own words for a recorded state path the domain never declared: a
 * path that holds a CSS locator, and one that holds a test id. Core asks these
 * first and classifies every other path by the words any domain's state uses,
 * so the order of the words is the one a path has always been read in.
 */
export const webStateElementKindReader: AutomationStudioStateElementKindReader = (path) => {
  const normalized = path.toLowerCase();
  if (normalized.includes("selector")) return "selector";
  if (normalized.includes("testid") || normalized.includes("test_id")) return "static_id";
  return undefined;
};
