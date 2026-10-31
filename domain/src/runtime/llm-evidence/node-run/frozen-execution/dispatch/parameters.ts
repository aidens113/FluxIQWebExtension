import type { JsonObject } from "fluxiq/core";
import type { WebNodeFrozenCall } from "../types";

/** Keep the exact lowered payload; only an already-proven element address can refresh. */
export function webNodeFrozenDispatchParameters(call: WebNodeFrozenCall, current: JsonObject): JsonObject {
  const saved = call.command.parameters;
  return call.subjectKind === "element" ? { ...saved, selector: current.selector!, element: current.element! } : saved;
}
