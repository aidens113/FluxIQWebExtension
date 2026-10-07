import assert from "node:assert/strict";
import test from "node:test";
import { AUTHORED_FLOW_GRAPH_BOUNDS, validateAuthoredFlowGraph } from "@fluxiq-web-extension/test-contracts";
import type { FlowNodeRecord } from "../../flow-action-types.js";
import type { RecordingProposalControl } from "../../recording-flow-proposal.js";
import { createdFlowAuthoredGraph } from "../authored-graph.js";
import { readCreatedFlowGraph } from "../graph-read.js";
import { createdFlowActionTypes } from "../flow-shape.js";

/**
 * The shape run `mut4fvkm` built: an optional banner dismissal `s7` joined at
 * the merge `s8`, after `s6`. Its snapshot listed `s7` but neither merge, and
 * no edge, so a state route `s6 -> s9` read as a revision mismatch.
 */
const NODES: readonly FlowNodeRecord[] = [
  { id: "main.s6", definitionId: "web.output.dom-click", parameterValues: { selector: "#coupon" }, outputActionId: "web.dom.click" },
  { id: "main.s7", definitionId: "web.output.dom-click", parameterValues: { selector: "#consent" }, outputActionId: "web.dom.click" },
  { id: "main.s8", definitionId: "builtin.control.merge", parameterValues: { mergeMode: "first" } },
  { id: "main.s9", definitionId: "web.output.dom-click", parameterValues: { selector: "#cart" }, outputActionId: "web.dom.click" },
];
const EDGES = [
  { id: "e.6-7", sourceNodeId: "main.s6", sourcePortId: "out", targetNodeId: "main.s7", label: "Dismiss the cookie banner" },
  { id: "e.6-8", sourceNodeId: "main.s6", targetNodeId: "main.s8", targetPortId: "in" },
  { id: "e.7-8", sourceNodeId: "main.s7", targetNodeId: "main.s8", metadata: { reason: "banner is sometimes absent" } },
  { id: "e.8-9", sourceNodeId: "main.s8", targetNodeId: "main.s9" },
];
const graph = (nodes: readonly FlowNodeRecord[], edges: readonly Record<string, unknown>[]) => createdFlowAuthoredGraph(nodes, createdFlowActionTypes(nodes, "flow.created"), edges);

test("the merge an action list leaves out, and every edge, are recorded as identifiers", () => {
  const recorded = graph(NODES, EDGES);
  assert.deepEqual(recorded, {
    controlNodes: [{ nodeId: "main.s8", definitionId: "builtin.control.merge" }],
    edges: [
      { edgeId: "e.6-7", sourceNodeId: "main.s6", sourcePortId: "out", targetNodeId: "main.s7", targetPortId: null },
      { edgeId: "e.6-8", sourceNodeId: "main.s6", sourcePortId: null, targetNodeId: "main.s8", targetPortId: "in" },
      { edgeId: "e.7-8", sourceNodeId: "main.s7", sourcePortId: null, targetNodeId: "main.s8", targetPortId: null },
      { edgeId: "e.8-9", sourceNodeId: "main.s8", sourcePortId: null, targetNodeId: "main.s9", targetPortId: null },
    ],
    omitted: { controlNodes: 0, edges: 0 },
  });
  assert.deepEqual(validateAuthoredFlowGraph(recorded), { valid: true, value: recorded });
  const text = JSON.stringify(recorded);
  for (const leak of ["Dismiss", "banner", "mergeMode", "#consent"]) assert.equal(text.includes(leak), false, `the graph carries ${leak}`);
});

test("an id not shaped like Core's is never carried, and what is left out is counted", () => {
  const recorded = graph(
    [...NODES, { id: "Accept all cookies", definitionId: "builtin.control.branch", parameterValues: undefined }, { id: "main.s10", definitionId: "Pick the cheapest one", parameterValues: undefined }],
    [
      { id: "Go to cart", sourceNodeId: "main.s8", sourcePortId: "When it shows", targetNodeId: "main.s9" },
      { id: "e.x", sourceNodeId: "Accept all cookies", targetNodeId: "main.s9" },
      { id: "e.y", sourceNodeId: "main.s9" },
      { id: "e.8-9", sourceNodeId: "main.s9", targetNodeId: "main.s10" },
      { id: "e.8-9", sourceNodeId: "main.s10", targetNodeId: "main.s8" },
    ],
  );
  assert.deepEqual(recorded.controlNodes, [{ nodeId: "main.s8", definitionId: "builtin.control.merge" }, { nodeId: "main.s10", definitionId: null }]);
  assert.deepEqual(recorded.edges, [
    { edgeId: null, sourceNodeId: "main.s8", sourcePortId: null, targetNodeId: "main.s9", targetPortId: null },
    { edgeId: "e.8-9", sourceNodeId: "main.s9", sourcePortId: null, targetNodeId: "main.s10", targetPortId: null },
    { edgeId: null, sourceNodeId: "main.s10", sourcePortId: null, targetNodeId: "main.s8", targetPortId: null },
  ], "a free-text edge id or port becomes null, and a repeated edge id is kept once");
  assert.deepEqual(recorded.omitted, { controlNodes: 1, edges: 2 });
  assert.deepEqual(validateAuthoredFlowGraph(recorded), { valid: true, value: recorded });
});

test("a graph past its bounds says how much it left out", () => {
  const many = Array.from({ length: AUTHORED_FLOW_GRAPH_BOUNDS.edges + 3 }, (_, index) => ({ id: `e.${index}`, sourceNodeId: "main.s8", targetNodeId: "main.s9" }));
  const recorded = graph(NODES, many);
  assert.equal(recorded.edges.length, AUTHORED_FLOW_GRAPH_BOUNDS.edges);
  assert.equal(recorded.omitted.edges, 3);
  assert.deepEqual(validateAuthoredFlowGraph(recorded).valid, true);
});

test("the nodes and the edges come from one read of the parent Flow and each Subflow graph", async () => {
  const calls: string[] = [];
  const control: RecordingProposalControl = {
    async automationStudioCall(endpoint, payload) {
      calls.push(`${endpoint}:${String(payload.flowId)}`);
      if (endpoint === "list-flow-subflows") return { subflows: [{ graphFlowId: "flow.graph" }, { graphFlowId: "flow.parent" }] };
      if (payload.flowId === "flow.graph") return { flow: { nodes: [{ id: "main.s8", definitionId: "builtin.control.merge" }], edges: [EDGES[3], "not an edge", null] } };
      return { flow: { nodes: [{ id: "node.start", definitionId: "builtin.control.start" }], edges: [EDGES[0]] } };
    },
  };
  const read = await readCreatedFlowGraph(control, { projectId: "project.lab", flowId: "flow.parent" });
  assert.deepEqual(calls, ["get-flow:flow.parent", "list-flow-subflows:flow.parent", "get-flow:flow.graph"], "no second read of any document");
  assert.deepEqual(read.nodes.map((node) => node.id), ["node.start", "main.s8"]);
  assert.deepEqual(read.edges, [EDGES[0], EDGES[3]]);
});
