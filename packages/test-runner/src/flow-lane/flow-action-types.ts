import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control/index.js";
import type { RecordingProposalControl } from "./recording-flow-proposal.js";

/**
 * One node of an approved Flow as `get-flow` returns it: its id, the parameter
 * values approval wrote onto it, and the recorded candidate it came from.
 * Everything the lane derives from the Flow's nodes -- which output each
 * dispatches, which values it asks the run to supply, which recorded action it
 * is -- is derived from one read of these.
 *
 * `recordingCandidateId` is the node's `metadata.recordingCandidateId`, which
 * approval writes onto every recorded node (Core
 * `recordings/proposal-candidates.ts`) and the graph index keeps. It places the
 * node in the proposal's candidate order without reading anything into the
 * node's id. Absent on a node no recording produced.
 *
 * `outputActionId` is the node's `metadata.outputActionId`, which Core writes
 * onto every node a Flow bootstrap created with an output action (Core
 * `runtime/flow-bootstrap/adaptation.ts`). A bootstrap node whose definition
 * fixes its output carries it only there, not as a `parameterValues.outputId`.
 * Absent on a recorded node.
 */
export type FlowNodeRecord = { id: string; parameterValues: Readonly<Record<string, unknown>> | undefined; recordingCandidateId?: string; outputActionId?: string };

/**
 * Every node of the approved Flow, read once: the parent Flow first and every
 * Subflow graph after it, because approval writes the recorded nodes onto the
 * primary Subflow's graph Flow rather than the parent. A graph that points back
 * at the parent is not read twice. A node without a string id is not one Core
 * writes and is skipped.
 */
export async function readFlowNodes(
  control: RecordingProposalControl,
  input: { projectId: string; flowId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<FlowNodeRecord[]> {
  const nodes = await flowNodes(control, input.projectId, input.flowId, bounds);
  for (const graphFlowId of await graphFlowIds(control, input.projectId, input.flowId, bounds)) {
    if (graphFlowId !== input.flowId) nodes.push(...await flowNodes(control, input.projectId, graphFlowId, bounds));
  }
  return nodes;
}

/**
 * Maps each Flow node id to the domain output that node dispatches.
 *
 * A recorded action becomes a `builtin.policy.action` node whose
 * `parameterValues.outputId` names the web action (`web.dom.type`). A run's
 * stored action attempt keeps only the node *definition* id, which is
 * `builtin.policy.action` for every recorded action alike, and drops the
 * node's inputs — so the attempt alone cannot say what ran. Its `nodeId` is
 * the only surviving link, and this map is how an expectation such as
 * `web.dom.type` is matched against it.
 */
export function flowActionTypes(nodes: readonly FlowNodeRecord[], flowId: string): Map<string, string> {
  const actionTypes = new Map<string, string>();
  for (const node of nodes) {
    const outputId = node.parameterValues?.outputId;
    if (typeof outputId === "string" && outputId) actionTypes.set(node.id, outputId);
  }
  if (!actionTypes.size) {
    throw new RunnerFailure("recording.contract", "The approved Flow declares no output-dispatching node, so nothing it runs could be identified", { details: { flowId } });
  }
  return actionTypes;
}

/** `flowActionTypes` over a fresh read, for a caller that needs nothing else from the Flow's nodes. */
export async function readFlowActionTypes(
  control: RecordingProposalControl,
  input: { projectId: string; flowId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<Map<string, string>> {
  return flowActionTypes(await readFlowNodes(control, input, bounds), input.flowId);
}

async function flowNodes(control: RecordingProposalControl, projectId: string, flowId: string, bounds: FluxIQHttpOptions): Promise<FlowNodeRecord[]> {
  const payload = asRecord(await control.automationStudioCall("get-flow", { projectId, flowId }, bounds), "get-flow payload");
  const flow = asRecord(payload.flow, "get-flow flow");
  return (Array.isArray(flow.nodes) ? flow.nodes : []).flatMap((value) => {
    const node = optionalRecord(value);
    if (typeof node?.id !== "string") return [];
    const metadata = optionalRecord(node.metadata);
    const recordingCandidateId = metadata?.recordingCandidateId;
    const outputActionId = metadata?.outputActionId;
    return [{
      id: node.id,
      parameterValues: optionalRecord(node.parameterValues),
      ...(typeof recordingCandidateId === "string" && recordingCandidateId ? { recordingCandidateId } : {}),
      ...(typeof outputActionId === "string" && outputActionId ? { outputActionId } : {}),
    }];
  });
}

async function graphFlowIds(control: RecordingProposalControl, projectId: string, flowId: string, bounds: FluxIQHttpOptions): Promise<string[]> {
  const payload = asRecord(await control.automationStudioCall("list-flow-subflows", { projectId, flowId, limit: 100, offset: 0 }, bounds), "subflows payload");
  const page = optionalRecord(payload.page);
  const subflows = Array.isArray(payload.subflows) ? payload.subflows : Array.isArray(page?.subflows) ? page.subflows : [];
  return subflows.flatMap((value) => {
    const graphFlowId = optionalRecord(value)?.graphFlowId;
    return typeof graphFlowId === "string" && graphFlowId ? [graphFlowId] : [];
  });
}

function asRecord(value: unknown, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RunnerFailure("recording.contract", `${at} must be an object`);
  return value as Record<string, unknown>;
}
function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
