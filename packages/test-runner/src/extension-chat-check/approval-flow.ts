import type { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";

/** The saved Flow the ask claim runs: its ids, its name as the chat names it, and the question it stops on. */
export type ApprovalFlow = { flowId: string; name: string; prompt: string; deleteSelector: string };

type FlowControl = Pick<ExistingFluxIQControlClient, "automationStudioCall">;

const DOMAIN_ID = "web-automation";
const NAME = "Delete friend request";
const PROMPT = "Delete this friend request? It cannot be undone.";
/** The first request card's Delete on social-network-feed's Friend requests page (`markup/friends.ts`). */
const DELETE_SELECTOR = "[role=\"list\"] > [role=\"listitem\"]:first-child [role=\"button\"][aria-label=\"Delete\"]";

/**
 * The nodes and edges of the Flow: start, ask a person, then press Delete on
 * the first friend request, or end without pressing it when they say no.
 *
 * The approval node is Core's own (`builtin.routine.approval`), the node a
 * person puts in front of a step that cannot be undone; the delete is a
 * recorded-style `builtin.policy.action` dispatching `web.dom.click`, the shape
 * a recording's approval writes. Nothing here needs a model, to build or to run.
 */
export function approvalFlowGraph(prompt: string = PROMPT, deleteSelector: string = DELETE_SELECTOR): { nodes: unknown[]; edges: unknown[] } {
  return {
    nodes: [
      { id: "start", definitionId: "builtin.control.start", parameterValues: { emitTimestamp: false } },
      { id: "confirm-delete", definitionId: "builtin.routine.approval", parameterValues: { prompt, timeoutMs: 0, defaultRoute: "rejected" } },
      { id: "delete-request", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click", parameters: { selector: deleteSelector } } },
      { id: "done", definitionId: "builtin.control.end", parameterValues: { status: "success" } },
      { id: "kept", definitionId: "builtin.control.end", parameterValues: { status: "success" } },
    ],
    edges: [
      { id: "e.start", sourceNodeId: "start", targetNodeId: "confirm-delete", sourcePortId: "success", targetPortId: "in" },
      { id: "e.approved", sourceNodeId: "confirm-delete", targetNodeId: "delete-request", sourcePortId: "approved", targetPortId: "in" },
      { id: "e.rejected", sourceNodeId: "confirm-delete", targetNodeId: "kept", sourcePortId: "rejected", targetPortId: "in" },
      { id: "e.deleted", sourceNodeId: "delete-request", targetNodeId: "done", sourcePortId: "success", targetPortId: "in" },
    ],
  };
}

/**
 * Saves the Flow through Core's public program routes, as a person's panel
 * would: create the Flow, give it a primary Subflow, save the graph onto that
 * Subflow's graph Flow, and route the Flow map's fallback to it, which is what
 * a run of the Flow enters.
 */
export async function saveApprovalFlow(control: FlowControl, input: { projectId: string; authorizationPin: string }): Promise<ApprovalFlow> {
  const { projectId, authorizationPin } = input;
  const call = (endpoint: string, payload: Record<string, unknown>) => control.automationStudioCall(endpoint, { projectId, authorizationPin, ...payload }, {}, DOMAIN_ID) as Promise<Record<string, any>>;
  const created = await call("create-flow", { name: NAME, description: "Asks before deleting the first friend request." });
  const flowId = text(created?.flow?.flowId, "create-flow flowId");
  const subflow = (await call("create-flow-subflow", { flowId, name: "Primary", role: "primary" }))?.subflow;
  const subflowId = text(subflow?.subflowId, "create-flow-subflow subflowId");
  const graphFlowId = text(subflow?.graphFlowId, "create-flow-subflow graphFlowId");
  const blank = (await call("get-flow", { flowId: graphFlowId }))?.flow;
  if (!blank || typeof blank !== "object") throw new Error("get-flow returned no graph Flow");
  await call("save-flow", { flow: { ...blank, ...approvalFlowGraph() } });
  await call("save-flow-map-fallback", { flowId, kind: "subflow", targetSubflowId: subflowId });
  return { flowId, name: NAME, prompt: PROMPT, deleteSelector: DELETE_SELECTOR };
}

function text(value: unknown, what: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${what} was missing from Core's answer`);
  return value;
}
