import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";
import type { RecordingProposalControl } from "./recording-flow-proposal.js";

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
 *
 * Approval writes the nodes onto the primary Subflow's graph Flow rather than
 * the parent, so the parent is read first and every subflow graph after it.
 */
export async function readFlowActionTypes(
  control: RecordingProposalControl,
  input: { projectId: string; flowId: string },
  bounds: FluxIQHttpOptions = {},
): Promise<Map<string, string>> {
  const actionTypes = new Map<string, string>();
  await collectFlowNodes(control, input.projectId, input.flowId, actionTypes, bounds);
  for (const graphFlowId of await graphFlowIds(control, input.projectId, input.flowId, bounds)) {
    if (graphFlowId !== input.flowId) await collectFlowNodes(control, input.projectId, graphFlowId, actionTypes, bounds);
  }
  if (!actionTypes.size) {
    throw new RunnerFailure("recording.contract", "The approved Flow declares no output-dispatching node, so nothing it runs could be identified", { details: { flowId: input.flowId } });
  }
  return actionTypes;
}

async function collectFlowNodes(control: RecordingProposalControl, projectId: string, flowId: string, into: Map<string, string>, bounds: FluxIQHttpOptions): Promise<void> {
  const payload = asRecord(await control.automationStudioCall("get-flow", { projectId, flowId }, bounds), "get-flow payload");
  const flow = asRecord(payload.flow, "get-flow flow");
  for (const value of Array.isArray(flow.nodes) ? flow.nodes : []) {
    const node = optionalRecord(value);
    const parameters = optionalRecord(node?.parameterValues);
    if (typeof node?.id === "string" && typeof parameters?.outputId === "string" && parameters.outputId) into.set(node.id, parameters.outputId);
  }
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
