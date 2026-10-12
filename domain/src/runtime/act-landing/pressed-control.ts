// The control a Flow node presses, as a fact target the page can be asked about
// (t430, `./landing.ts`): only a press (`web.dom.click`), whether the node is the
// web output itself or a recorded action naming it, and only one whose target
// the page can resolve again -- a selector, an element description, or both,
// with the frame it is in.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../output-nodes";

/** The action whose landing can be read from its control. */
const PRESS_ACTION_TYPE = "web.dom.click";

/** Core's node definition for a recorded action, which names its web output in `parameterValues.outputId`. */
const POLICY_ACTION_DEFINITION_ID = "builtin.policy.action";

/** The pressed control as a fact target, or `undefined` for a node that is not a press or names no target. */
export function webAutomationPressedControl(node: { definitionId: string; parameterValues?: JsonObject | undefined }): JsonObject | undefined {
  const parameters = pressParameters(node);
  if (!parameters) return undefined;
  const selector = typeof parameters.selector === "string" && parameters.selector.trim() ? parameters.selector : undefined;
  const element = record(parameters.element);
  if (!selector && !element) return undefined;
  const frameId = parameters.frameId ?? parameters.browserFrameId;
  return {
    ...(selector ? { selector } : {}),
    ...(element ? { element } : {}),
    ...(Array.isArray(parameters.shadowHosts) ? { shadowHosts: parameters.shadowHosts } : {}),
    ...(typeof frameId === "number" ? { frameId } : {})
  };
}

/** The press's own parameters: the node's, or a recorded action's `parameters`. */
function pressParameters(node: { definitionId: string; parameterValues?: JsonObject | undefined }): JsonObject | undefined {
  const values = node.parameterValues;
  if (node.definitionId === webAutomationOutputNodeId(PRESS_ACTION_TYPE)) return values ?? undefined;
  if (node.definitionId !== POLICY_ACTION_DEFINITION_ID || values?.outputId !== PRESS_ACTION_TYPE) return undefined;
  return record(values.parameters);
}

function record(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
