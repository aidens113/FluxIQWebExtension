// The parameters a web step's node names its target in. A web output node
// carries them itself; a recorded action, which Core runs as
// `builtin.policy.action`, carries them in `parameterValues.parameters` beside
// the web output it names in `parameterValues.outputId`. Any other node names
// no web target.

import type { JsonObject, JsonValue } from "fluxiq/core";

/** Core's node definition for a recorded action, which names its web output in `parameterValues.outputId`. */
const POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";
const WEB_OUTPUT_NODE_PREFIX = "web.output.";
const WEB_OUTPUT_PREFIX = "web.";

/** The node's own parameters, or a recorded web action's `parameters`; `undefined` for a node that is neither. */
export function webNodeTargetParameters(node: { definitionId: string; parameterValues?: JsonObject | undefined }): JsonObject | undefined {
  const values = node.parameterValues;
  if (node.definitionId.startsWith(WEB_OUTPUT_NODE_PREFIX)) return values;
  if (node.definitionId !== POLICY_ACTION_DEFINITION_ID || typeof values?.outputId !== "string" || !values.outputId.startsWith(WEB_OUTPUT_PREFIX)) return undefined;
  return record(values.parameters);
}

function record(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
