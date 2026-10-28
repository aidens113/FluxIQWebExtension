// A Flow built after a demonstration should do what the written task asks, not
// what the person tried and undid. This is the pure check on the built graph:
// which of its nodes perform an act of a demonstration's detour. A node
// matches only when its definition is the act's operation, its control's words
// equal the act's label, and -- when the act names one -- its value equals the
// act's. A node with no readable control never matches, and a read or extract
// node is not in the operation table, so it cannot match whatever it says.

import type { ScenarioDemonstration } from "@fluxiq-web-extension/test-contracts";
import type { readCreatedFlowGraph } from "../graph-read.js";
import { ACT_NODE_DEFINITIONS } from "./act-node-definitions.js";
import type { CopiedDetourAct } from "./copied-detour-act.js";
import { nodeLabels } from "./node-labels.js";
import { nodeValues } from "./node-values.js";
import { normalizedText } from "./normalized-text.js";

export function copiedDetourActs(
  graph: Awaited<ReturnType<typeof readCreatedFlowGraph>>,
  detours: ScenarioDemonstration["detours"],
): CopiedDetourAct[] {
  const copied: CopiedDetourAct[] = [];
  for (const detour of detours) {
    for (const act of detour.acts) {
      const definitionId = ACT_NODE_DEFINITIONS[act.operation];
      const target = normalizedText(act.target);
      if (definitionId === undefined || target === undefined) continue;
      const value = act.value === undefined ? undefined : normalizedText(act.value);
      for (const node of graph.nodes) {
        if (node.definitionId !== definitionId) continue;
        if (!nodeLabels(node).includes(target)) continue;
        if (act.value !== undefined && (value === undefined || !nodeValues(node).includes(value))) continue;
        copied.push({ nodeId: node.id, act, matchedOn: value === undefined ? ["operation", "target"] : ["operation", "target", "value"] });
      }
    }
  }
  return copied;
}
