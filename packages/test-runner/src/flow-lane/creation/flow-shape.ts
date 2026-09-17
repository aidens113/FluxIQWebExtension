// What a created Flow is made of, told by counts and Core's output names only.
// A Flow bootstrap's nodes carry selectors and parameter values the model
// chose; none of that is read into a judgement or written into a bundle.

import { RunnerFailure } from "../../failure.js";
import { EXTRACT_OUTPUT_IDS } from "../expectations.js";
import type { FlowNodeRecord } from "../flow-action-types.js";

/** The domain outputs that move the browser rather than act on a page (`domain/src/actions/types.ts`). */
const NAVIGATION_OUTPUT_IDS: ReadonlySet<string> = new Set(["web.browser.navigate", "web.browser.tab"]);
/** The shape of a domain output name, such as `web.dom.extract_list`. */
const OUTPUT_ID = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){1,4}$/u;
const MAX_OUTPUT_ID_LENGTH = 64;
/** What an output name that does not have that shape is counted as, so no other text reaches the bundle. */
const UNRECOGNIZED_OUTPUT = "(unrecognized)";

/**
 * `actionTypes` counts the action nodes by the output each dispatches;
 * `extractNodes` and `navigationNodes` are the two kinds a navigate-and-extract
 * task depends on, counted out of it.
 */
export type CreatedFlowShape = Readonly<{
  nodeCount: number;
  actionNodeCount: number;
  actionTypes: Readonly<Record<string, number>>;
  extractNodes: number;
  navigationNodes: number;
}>;

/**
 * Each action node's output. A bootstrap node names it in
 * `parameterValues.outputId` when its definition lets the plan choose, and
 * only in `metadata.outputActionId` when the definition fixes it; either is
 * the output the node dispatches. A created Flow with no such node could do
 * nothing the instruction asked, so it fails here, before it runs.
 */
export function createdFlowActionTypes(nodes: readonly FlowNodeRecord[], flowId: string): Map<string, string> {
  const actionTypes = new Map<string, string>();
  for (const node of nodes) {
    const chosen = node.parameterValues?.outputId;
    const outputId = typeof chosen === "string" && chosen ? chosen : node.outputActionId;
    if (outputId) actionTypes.set(node.id, recognizedOutput(outputId));
  }
  if (!actionTypes.size) {
    throw new RunnerFailure("runtime.behavior", "The created Flow has no node that dispatches a web action, so it could not do anything the instruction asked", { details: { flowId, nodeCount: nodes.length } });
  }
  return actionTypes;
}

export function createdFlowShape(nodes: readonly FlowNodeRecord[], actionTypes: ReadonlyMap<string, string>): CreatedFlowShape {
  const counts: Record<string, number> = {};
  for (const outputId of actionTypes.values()) counts[outputId] = (counts[outputId] ?? 0) + 1;
  const outputs = [...actionTypes.values()];
  return Object.freeze({
    nodeCount: nodes.length,
    actionNodeCount: actionTypes.size,
    actionTypes: Object.freeze(Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))),
    extractNodes: outputs.filter((outputId) => EXTRACT_OUTPUT_IDS.has(outputId)).length,
    navigationNodes: outputs.filter((outputId) => NAVIGATION_OUTPUT_IDS.has(outputId)).length,
  });
}

function recognizedOutput(outputId: string): string {
  return outputId.length <= MAX_OUTPUT_ID_LENGTH && OUTPUT_ID.test(outputId) ? outputId : UNRECOGNIZED_OUTPUT;
}
