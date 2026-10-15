// The element a web step's node addresses, by the key a snapshot's places name
// elements by (`./key.ts`, t609): the selector it carries and the frame it is
// in. A web output node carries them itself; a recorded action, which Core
// runs as `builtin.policy.action`, carries them in `parameterValues.parameters`
// beside the web output it names. A node with no selector addresses nothing a
// snapshot can be asked about.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webStatePlaceKey } from "./key";

/** Core's node definition for a recorded action, which names its web output in `parameterValues.outputId`. */
const POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";
const WEB_OUTPUT_NODE_PREFIX = "web.output.";
const WEB_OUTPUT_PREFIX = "web.";

/** The key of the element the node acts on, or `undefined` for a node that names no selector. */
export function webNodeTargetPlaceKey(node: { definitionId: string; parameterValues?: JsonObject | undefined }): string | undefined {
  const parameters = targetParameters(node);
  const selector = parameters?.selector;
  if (typeof selector !== "string" || selector.trim() === "") return undefined;
  const frame = parameters?.frameId ?? parameters?.browserFrameId;
  return webStatePlaceKey(typeof frame === "number" && Number.isSafeInteger(frame) && frame >= 0 ? frame : undefined, selector);
}

/** The node's own parameters, or a recorded web action's `parameters`. */
function targetParameters(node: { definitionId: string; parameterValues?: JsonObject | undefined }): JsonObject | undefined {
  const values = node.parameterValues;
  if (node.definitionId.startsWith(WEB_OUTPUT_NODE_PREFIX)) return values;
  if (node.definitionId !== POLICY_ACTION_DEFINITION_ID || typeof values?.outputId !== "string" || !values.outputId.startsWith(WEB_OUTPUT_PREFIX)) return undefined;
  return record(values.parameters);
}

function record(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
