import type { AutomationStudioResolvedControlIntent } from "fluxiq/automation-studio";

/** Missing and classified are different observations; a known disagreement cannot fall back to omission. */
export function sameWebPlanControlIntent(left: AutomationStudioResolvedControlIntent | undefined, right: AutomationStudioResolvedControlIntent | undefined): boolean {
  return left?.intent === right?.intent
    && (left?.intent === "accept" && left.responseOnly === true) === (right?.intent === "accept" && right.responseOnly === true);
}
