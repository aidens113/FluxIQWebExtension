/**
 * The rest of the Flow a build authored -- its control nodes and every edge --
 * as a created-Flow run's `snapshots/flow-lane.json` records it under
 * `authoredGraph`, beside the action nodes `authoredNodes` lists.
 *
 * **Why this exists.** `authoredNodes` holds one entry per action node and
 * nothing else, so a merge, a branch or a start node never appeared in any
 * artifact, and no artifact said which node led to which. Run `mut4fvkm` played
 * a merge node `s3` that the authored list did not hold, and skipped an action
 * `s7` that it did; with no control nodes and no edges on record that read as
 * a revision mismatch between the Flow the build made and the Flow that ran,
 * when it was one 14-node revision whose state route had jumped `s6 -> s9`.
 * The graph's own structure is the evidence that settles such a question.
 *
 * **What may travel.** Identifiers only: node ids, definition ids, edge ids and
 * port ids, each shaped like one Core writes (no space, so no sentence). Never a
 * label, a description, a parameter or a value a page supplied; a control
 * node's parameters are not recorded at all.
 */
export type AuthoredFlowGraph = {
  /** Every node of the Flow that dispatches no domain output, in the Flow document's own order. */
  controlNodes: AuthoredFlowControlNode[];
  /** Every edge of the Flow and its Subflow graphs, in the order the documents list them. */
  edges: AuthoredFlowEdge[];
  /**
   * How many control nodes and edges the record does not hold: past
   * `AUTHORED_FLOW_GRAPH_BOUNDS`, or with an identifier not shaped like one
   * Core writes. Counted rather than dropped silently, so a partial graph
   * never reads as the whole one.
   */
  omitted: { controlNodes: number; edges: number };
};

/** One control node: what it is, never what it was told. */
export type AuthoredFlowControlNode = {
  nodeId: string;
  /** The node definition the build placed (`builtin.control.merge`), `null` when Core's document named none. */
  definitionId: string | null;
};

/** One edge, as Core's Flow document holds it, without its label or metadata. */
export type AuthoredFlowEdge = {
  /** The edge's own id, `null` when the document's was missing or not shaped like one. */
  edgeId: string | null;
  sourceNodeId: string;
  /** The port the edge leaves by (a branch's `true`, a merge's output), `null` when the document named none. */
  sourcePortId: string | null;
  targetNodeId: string;
  targetPortId: string | null;
};

/** How large one recorded graph may be. A live build's Flow is tens of nodes; these leave room and stop a runaway. */
export const AUTHORED_FLOW_GRAPH_BOUNDS = Object.freeze({
  controlNodes: 128,
  edges: 512,
});
