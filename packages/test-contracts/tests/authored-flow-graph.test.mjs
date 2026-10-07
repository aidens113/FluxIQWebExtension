import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a member this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { validateAuthoredFlowGraph, assertAuthoredFlowGraph, AUTHORED_FLOW_GRAPH_BOUNDS } = contracts;

/**
 * The graph run `mut4fvkm` needed and did not have: the merges `s3` and `s8`
 * as control nodes, and the edges that say `s7` (an optional banner dismissal)
 * sits between `s6` and the merge `s8`, so a state route `s6 -> s9` explains
 * why `s7` and `s8` have no attempt without any revision mismatch.
 */
const graph = (overrides = {}) => ({
  controlNodes: [
    { nodeId: "main.s3", definitionId: "builtin.control.merge" },
    { nodeId: "main.s8", definitionId: "builtin.control.merge" },
  ],
  edges: [
    { edgeId: "edge.6-7", sourceNodeId: "main.s6", sourcePortId: "out", targetNodeId: "main.s7", targetPortId: null },
    { edgeId: "edge.7-8", sourceNodeId: "main.s7", sourcePortId: null, targetNodeId: "main.s8", targetPortId: "in" },
    { edgeId: null, sourceNodeId: "main.s8", sourcePortId: null, targetNodeId: "main.s9", targetPortId: null },
  ],
  omitted: { controlNodes: 0, edges: 0 },
  ...overrides,
});

const issuesOf = (input) => {
  const checked = validateAuthoredFlowGraph(input);
  return checked.valid ? [] : checked.issues.map((issue) => `${issue.path} ${issue.message}`);
};

test("a graph of control nodes and edges validates, identifiers only", () => {
  const value = graph();
  assert.deepEqual(validateAuthoredFlowGraph(value), { valid: true, value });
  assert.doesNotThrow(() => assertAuthoredFlowGraph(value));
  assert.deepEqual(issuesOf(graph({ controlNodes: [], edges: [] })), [], "a Flow of action nodes alone and no edges is a record, not an omission");
  assert.deepEqual(issuesOf(graph({ controlNodes: [{ nodeId: "node.start", definitionId: null }] })), [], "an unstated definition is a recorded outcome");
});

test("a label, page text or a free field cannot travel in the graph", () => {
  assert.deepEqual(issuesOf(graph({ controlNodes: [{ nodeId: "main.s3", definitionId: "builtin.control.merge", label: "Dismiss cookie banner" }] })), ["$.controlNodes[0].label unknown property"]);
  assert.deepEqual(issuesOf(graph({ controlNodes: [{ nodeId: "Dismiss the banner", definitionId: "builtin.control.merge" }] })), ["$.controlNodes[0].nodeId must be a Core identifier"]);
  const edge = { edgeId: "e", sourceNodeId: "a", sourcePortId: "Accept all cookies", targetNodeId: "b", targetPortId: null };
  assert.deepEqual(issuesOf(graph({ edges: [edge] })), ["$.edges[0].sourcePortId must be a Core identifier or null"]);
  assert.deepEqual(issuesOf(graph({ edges: [{ ...edge, sourcePortId: null, metadata: {} }] })), ["$.edges[0].metadata unknown property"]);
  assert.deepEqual(issuesOf(graph({ edges: [{ ...edge, sourcePortId: null, targetNodeId: undefined }] })), ["$.edges[0].targetNodeId must be a Core identifier"]);
  assert.deepEqual(issuesOf({ ...graph(), extra: 1 }), ["$.extra unknown property"]);
});

test("ids are unique, lists are bounded and omissions are counted as integers", () => {
  const twice = { nodeId: "main.s3", definitionId: "builtin.control.merge" };
  assert.deepEqual(issuesOf(graph({ controlNodes: [twice, twice] })), ["$.controlNodes node ids must be unique"]);
  const edge = { edgeId: "e", sourceNodeId: "a", sourcePortId: null, targetNodeId: "b", targetPortId: null };
  assert.deepEqual(issuesOf(graph({ edges: [edge, edge] })), ["$.edges edge ids must be unique"]);
  assert.deepEqual(issuesOf(graph({ edges: [{ ...edge, edgeId: null }, { ...edge, edgeId: null }] })), [], "two edges without an id are not a duplicate");
  const many = Array.from({ length: AUTHORED_FLOW_GRAPH_BOUNDS.edges + 1 }, (_, index) => ({ ...edge, edgeId: `e${index}` }));
  assert.deepEqual(issuesOf(graph({ edges: many })), [`$.edges must hold at most ${AUTHORED_FLOW_GRAPH_BOUNDS.edges} edges`]);
  const nodes = Array.from({ length: AUTHORED_FLOW_GRAPH_BOUNDS.controlNodes + 1 }, (_, index) => ({ nodeId: `n${index}`, definitionId: null }));
  assert.deepEqual(issuesOf(graph({ controlNodes: nodes })), [`$.controlNodes must hold at most ${AUTHORED_FLOW_GRAPH_BOUNDS.controlNodes} nodes`]);
  assert.deepEqual(issuesOf(graph({ omitted: { controlNodes: 1.5, edges: -1 } })), [
    `$.omitted.controlNodes must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`,
    `$.omitted.edges must be a finite integer from 0 to ${Number.MAX_SAFE_INTEGER}`,
  ]);
  assert.throws(() => assertAuthoredFlowGraph(graph({ omitted: null })), /AuthoredFlowGraph/u);
});
