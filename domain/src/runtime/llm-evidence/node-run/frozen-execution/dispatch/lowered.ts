import type { JsonObject } from "fluxiq/core";
import { webAutomationCheckWaitParameters } from "../../../../../actions/check-wait";
import { webAutomationExtractListReferenceNow } from "../../../../../output-nodes/extract-list";

/** The owning producer's deterministic defaults, before the final gateway observation. */
export function webNodeFrozenLoweredParameters(actionType: string, parameters: JsonObject, referenceNow: number): JsonObject {
  const referenced = actionType === "web.dom.extract_list" ? webAutomationExtractListReferenceNow(parameters, referenceNow) : parameters;
  return webAutomationCheckWaitParameters(actionType, referenced);
}
