// One entry per action node of the Flow a build authored: what the node is,
// what it dispatches, and what it was told to do.
//
// `flow-shape.ts` answers "how many, and of what kind"; this answers "with
// what". They are kept apart because they carry different risks -- a count can
// hold nothing, a parameter could hold a page -- and the screen that makes the
// second safe is a file of its own (`parameter-screen.ts`).
//
// Six live `product-catalog` extract runs failed identically with
// `expectedRecords 8, observedRecords 23` and none could be diagnosed, because
// no artifact a run wrote said whether the Flow's extraction node had been
// authored to paginate, or how far. That is the question this list answers, and
// it answers it for every action node at once rather than for the one somebody
// later guesses at.

import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "@fluxiq-web-extension/domain/node";
import type { AuthoredFlowNode } from "@fluxiq-web-extension/test-contracts";
import type { FlowNodeRecord } from "../flow-action-types.js";
import { screenedNodeParameters } from "./parameter-screen.js";

/** Whether a node id or definition id is shaped like one Core writes: no space, so it can carry no text. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const MAX_IDENTIFIER_LENGTH = 256;

/**
 * The Flow's action nodes, in the Flow document's own order, each with its
 * definition, the output it dispatches, and its screened parameters.
 *
 * `actionTypes` decides membership and supplies the output name, so this list
 * and `flowShape.actionTypes` are two readings of one map and cannot disagree
 * about which nodes acted. The two identifiers are the only fields copied
 * rather than screened, so each is checked for the shape Core writes and a
 * value that is not that shape is replaced -- the definition id by `null`, the
 * node id by a per-position marker no reader could mistake for a Core id --
 * rather than carried or dropped.
 *
 * `deniedKeys` defaults to this domain's declaration
 * (`WEB_LLM_DENIED_EVIDENCE_KEYS`), which is the domain every Lab Flow is bound
 * to. It is a parameter so that a test can state a declaration rather than
 * inherit one, never so that a caller can widen what travels.
 */
export function createdFlowAuthoredNodes(
  nodes: readonly FlowNodeRecord[],
  actionTypes: ReadonlyMap<string, string>,
  deniedKeys: readonly string[] = WEB_LLM_DENIED_EVIDENCE_KEYS,
): AuthoredFlowNode[] {
  const authored: AuthoredFlowNode[] = [];
  for (const node of nodes) {
    const outputId = actionTypes.get(node.id);
    if (outputId === undefined) continue;
    const screened = screenedNodeParameters(node.parameterValues ?? {}, deniedKeys);
    authored.push({
      nodeId: identifier(node.id) ?? `unrecognized.node.${authored.length}`,
      definitionId: identifier(node.definitionId) ?? null,
      outputId,
      parameters: screened.values,
      parametersWithheld: screened.withheld,
    });
  }
  return authored;
}

function identifier(value: string | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH && IDENTIFIER.test(value) ? value : undefined;
}
