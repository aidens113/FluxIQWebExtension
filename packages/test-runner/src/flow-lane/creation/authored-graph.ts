// The created Flow's control nodes and its edges, identifiers only, beside the
// action nodes `authored-nodes.ts` lists.
//
// Run `mut4fvkm` could not say which path its playback took: the snapshot's
// `authoredNodes` held only the 12 action nodes, so the merges `s3` and `s8`
// were missing from it, and no edge was recorded anywhere. A merge attempt in
// the playback with no authored counterpart, and an authored `s7` with no
// attempt, then read as a revision mismatch. It was one revision, and a state
// route `s6 -> s9` had passed over `s7` and `s8` -- which the edges show at a
// glance. This record is what lets a bundle answer that by itself.

import type { AuthoredFlowControlNode, AuthoredFlowEdge, AuthoredFlowGraph } from "@fluxiq-web-extension/test-contracts";
import { AUTHORED_FLOW_GRAPH_BOUNDS } from "@fluxiq-web-extension/test-contracts";
import type { FlowNodeRecord } from "../flow-action-types.js";
import { flowIdentifier } from "./document-identifier.js";
import type { FlowEdgeDocument } from "./graph-read.js";

/**
 * Every node `actionTypes` does not name, as its id and definition, and every
 * edge as its id, endpoints and ports, in the documents' own order.
 *
 * Nothing else of either is copied: no label, no description, no metadata and
 * no parameter. An id not shaped like one Core writes is never carried; a
 * control node or an edge whose endpoint is such an id is counted under
 * `omitted` instead, as is anything past `AUTHORED_FLOW_GRAPH_BOUNDS`, so a
 * partial graph says it is partial. An edge or definition id that is not
 * identifier-shaped, or a port the document did not name, is `null`.
 */
export function createdFlowAuthoredGraph(
  nodes: readonly FlowNodeRecord[],
  actionTypes: ReadonlyMap<string, string>,
  edges: readonly FlowEdgeDocument[],
): AuthoredFlowGraph {
  const controlNodes: AuthoredFlowControlNode[] = [];
  const authoredEdges: AuthoredFlowEdge[] = [];
  const omitted = { controlNodes: 0, edges: 0 };
  const seenNodes = new Set<string>();
  for (const node of nodes) {
    if (actionTypes.has(node.id)) continue;
    const nodeId = flowIdentifier(node.id);
    if (nodeId === undefined || seenNodes.has(nodeId) || controlNodes.length >= AUTHORED_FLOW_GRAPH_BOUNDS.controlNodes) { omitted.controlNodes += 1; continue; }
    seenNodes.add(nodeId);
    controlNodes.push({ nodeId, definitionId: flowIdentifier(node.definitionId) ?? null });
  }
  const seenEdges = new Set<string>();
  for (const edge of edges) {
    const sourceNodeId = flowIdentifier(edge.sourceNodeId);
    const targetNodeId = flowIdentifier(edge.targetNodeId);
    if (sourceNodeId === undefined || targetNodeId === undefined || authoredEdges.length >= AUTHORED_FLOW_GRAPH_BOUNDS.edges) { omitted.edges += 1; continue; }
    // A repeated edge id would make two edges one; the second keeps its endpoints and loses only the id.
    const id = flowIdentifier(edge.id);
    const edgeId = id === undefined || seenEdges.has(id) ? null : id;
    if (edgeId !== null) seenEdges.add(edgeId);
    authoredEdges.push({
      edgeId,
      sourceNodeId,
      sourcePortId: flowIdentifier(edge.sourcePortId) ?? null,
      targetNodeId,
      targetPortId: flowIdentifier(edge.targetPortId) ?? null,
    });
  }
  return { controlNodes, edges: authoredEdges, omitted };
}
