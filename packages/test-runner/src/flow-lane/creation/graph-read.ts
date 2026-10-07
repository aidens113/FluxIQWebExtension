// The created Flow's nodes and its edges from one read of its documents.
//
// `readFlowNodes` reads the parent Flow and every Subflow graph and keeps each
// node; it drops the documents' `edges`. The created-Flow snapshot needs those
// edges too (`authored-graph.ts`), and reading the Flow a second time for them
// would cost a round trip per graph and could, in principle, read a revision
// the nodes were not read from. So the one read is observed instead: every
// `get-flow` answer that passes through is kept for its edges, and the nodes
// and edges then come from the same documents.

import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { readFlowNodes, type FlowNodeRecord } from "../flow-action-types.js";
import type { RecordingProposalControl } from "../recording-flow-proposal.js";

/** One edge record exactly as a `get-flow` document held it; `authored-graph.ts` decides what of it travels. */
export type FlowEdgeDocument = Readonly<Record<string, unknown>>;

export async function readCreatedFlowGraph(
  control: RecordingProposalControl,
  input: { projectId: string; flowId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<{ nodes: FlowNodeRecord[]; edges: FlowEdgeDocument[] }> {
  const edges: FlowEdgeDocument[] = [];
  const observed: RecordingProposalControl = {
    async automationStudioCall(endpoint, payload, callBounds, domainId) {
      const answer = await control.automationStudioCall(endpoint, payload, callBounds, domainId);
      if (endpoint === "get-flow") edges.push(...documentEdges(answer));
      return answer;
    },
  };
  const nodes = await readFlowNodes(observed, input, bounds);
  return { nodes, edges };
}

function documentEdges(answer: unknown): FlowEdgeDocument[] {
  const flow = record(record(answer)?.flow);
  const listed = flow?.edges;
  return Array.isArray(listed) ? listed.flatMap((edge) => { const value = record(edge); return value ? [value] : []; }) : [];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
