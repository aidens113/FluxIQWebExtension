// Coverage of approval-flow.ts: the Flow asks before its delete, and is saved
// through Core's public routes in the order a run needs.

import assert from "node:assert/strict";
import test from "node:test";
import { approvalFlowGraph, saveApprovalFlow } from "../approval-flow.js";

type Edge = { sourceNodeId: string; targetNodeId: string; sourcePortId: string };

test("the delete is reached only through the approval's approved route", () => {
  const { nodes, edges } = approvalFlowGraph("Delete it?", "#delete");
  const byId = new Map((nodes as Array<{ id: string; definitionId: string; parameterValues: Record<string, unknown> }>).map(node => [node.id, node]));
  assert.equal(byId.get("confirm-delete")?.definitionId, "builtin.routine.approval");
  assert.equal(byId.get("confirm-delete")?.parameterValues.prompt, "Delete it?");
  assert.deepEqual(byId.get("delete-request")?.parameterValues, { outputId: "web.dom.click", parameters: { selector: "#delete" } });
  const into = (edges as Edge[]).filter(edge => edge.targetNodeId === "delete-request");
  assert.deepEqual(into.map(edge => [edge.sourceNodeId, edge.sourcePortId]), [["confirm-delete", "approved"]]);
  const rejected = (edges as Edge[]).find(edge => edge.sourceNodeId === "confirm-delete" && edge.sourcePortId === "rejected");
  assert.equal(rejected?.targetNodeId, "kept");
});

test("the Flow is created, given a primary Subflow, saved onto its graph, and routed to it", async () => {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown>; domainId?: string }> = [];
  const answers: Record<string, unknown> = {
    "create-flow": { flow: { flowId: "flow.a" } },
    "create-flow-subflow": { subflow: { subflowId: "subflow.a", graphFlowId: "flow.a.graph" } },
    "get-flow": { flow: { flowId: "flow.a.graph", nodes: [], edges: [], updatedAt: 5 } },
    "save-flow": { flow: {} },
    "save-flow-map-fallback": { router: {} },
  };
  const control = {
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown> = {}, _bounds = {}, domainId?: string) => {
      calls.push({ endpoint, payload, ...(domainId === undefined ? {} : { domainId }) });
      return answers[endpoint];
    },
  };
  const flow = await saveApprovalFlow(control as never, { projectId: "project.a", authorizationPin: "1234" });
  assert.equal(flow.flowId, "flow.a");
  assert.deepEqual(calls.map(call => call.endpoint), ["create-flow", "create-flow-subflow", "get-flow", "save-flow", "save-flow-map-fallback"]);
  assert.ok(calls.every(call => call.payload.projectId === "project.a" && call.domainId === "web-automation"));
  assert.equal(calls[2]!.payload.flowId, "flow.a.graph");
  const saved = calls[3]!.payload.flow as { flowId: string; nodes: unknown[]; updatedAt: number };
  assert.equal(saved.flowId, "flow.a.graph");
  assert.equal(saved.updatedAt, 5);
  assert.equal(saved.nodes.length, 5);
  assert.deepEqual({ flowId: calls[4]!.payload.flowId, kind: calls[4]!.payload.kind, targetSubflowId: calls[4]!.payload.targetSubflowId }, { flowId: "flow.a", kind: "subflow", targetSubflowId: "subflow.a" });
});
