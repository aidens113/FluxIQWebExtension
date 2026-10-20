// A loop pass's node as it was dispatched (job rerun round 4).
//
// A For Each pass reaches its own row only at dispatch: the node runs with its
// target scoped to the pass's `item` (`output-nodes/native-runtime.ts`,
// `webAutomationScopedToRow`), which writes the row's values into the recorded
// `element.context.record` and leaves the selector as recorded. The state diff
// is told the node as saved, so it scopes it the same way, by the same function,
// before it says where the step's control sat: two scopings that differed would
// place the pass in a row the page never pressed.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationScopedToRow } from "../../../output-nodes";
import { webNodeTargetParameters } from "./target-parameters";

type WebStepNode = { definitionId: string; parameterValues?: JsonObject | undefined };

/** The node with its target scoped to the pass row `item`; the same node when no row arrived or it names no recorded element. */
export function webNodeScopedToPassRow<Node extends WebStepNode>(node: Node, item: JsonValue | undefined): Node {
  if (item === undefined) return node;
  const parameters = webNodeTargetParameters(node);
  if (!parameters) return node;
  const scoped = webAutomationScopedToRow(parameters, item);
  if (scoped === parameters) return node;
  const own = parameters === node.parameterValues;
  return { ...node, parameterValues: own ? scoped : { ...node.parameterValues, parameters: scoped } };
}
