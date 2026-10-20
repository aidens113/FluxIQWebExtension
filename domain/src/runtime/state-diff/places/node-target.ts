// The element a web step's node addresses, by the key a snapshot's places name
// elements by (`./key.ts`, t609): the selector it carries and the frame it is
// in, read from the node's target parameters (`./target-parameters.ts`). A
// node with no selector addresses nothing a snapshot can be asked about.

import type { JsonObject } from "fluxiq/core";
import { webStatePlaceKey } from "./key";
import { webNodeTargetParameters } from "./target-parameters";

/** The key of the element the node acts on, or `undefined` for a node that names no selector. */
export function webNodeTargetPlaceKey(node: { definitionId: string; parameterValues?: JsonObject | undefined }): string | undefined {
  const parameters = webNodeTargetParameters(node);
  const selector = parameters?.selector;
  if (typeof selector !== "string" || selector.trim() === "") return undefined;
  const frame = parameters?.frameId ?? parameters?.browserFrameId;
  return webStatePlaceKey(typeof frame === "number" && Number.isSafeInteger(frame) && frame >= 0 ? frame : undefined, selector);
}
