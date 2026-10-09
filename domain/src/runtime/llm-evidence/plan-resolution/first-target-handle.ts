// The first target handle a node call's parameters name, wherever in them it
// is written -- `target: {handle: "t3"}`, a bare `selector: "t3"`, or inside a
// row-bound fallback -- in the packets' spelling (`../handle-spelling`). It is
// the control the call acts on, for every reader of a run that needs it
// (`../node-run/run.ts`): what covers it, its words, whether its press changed the page.

import type { JsonValue } from "fluxiq/core";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";

/** How deep the parameters are walked for a handle. */
const MAX_DEPTH = 6;

/** The first target handle `value` names, depth first in key order; nothing when it names none. */
export function webPlanFirstTargetHandle(value: JsonValue | undefined, depth = 0): string | undefined {
  if (depth > MAX_DEPTH || value === undefined || value === null) return undefined;
  if (typeof value === "string") return canonicalWebLlmTargetHandle(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = webPlanFirstTargetHandle(entry, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  for (const entry of Object.values(value)) {
    const found = webPlanFirstTargetHandle(entry as JsonValue, depth + 1);
    if (found) return found;
  }
  return undefined;
}
