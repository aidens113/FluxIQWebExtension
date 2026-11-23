import type { JsonObject, JsonValue } from "fluxiq/core";
import { webNodeReadWithRejectedRows } from "../llm-evidence/node-run";

/** The production model-visible read, independently of its raw gateway rows. */
export function webOfflineReadModelResult(payload: JsonObject | undefined, parameters: JsonObject): JsonValue | undefined {
  return webNodeReadWithRejectedRows(payload, parameters).read;
}
