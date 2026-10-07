import { AUTHORED_FLOW_GRAPH_BOUNDS, type AuthoredFlowControlNode, type AuthoredFlowEdge, type AuthoredFlowGraph } from "./graph.js";
import { isCoreIdentifier } from "../harness-recovery-validation.js";
import { add, array, finite, isObject, keys, object, result, uniqueStrings } from "../runtime-validation.js";
import { ContractValidationError, type ValidationIssue, type ValidationResult } from "../validation.js";

const graphKeys = ["controlNodes", "edges", "omitted"] as const satisfies readonly (keyof AuthoredFlowGraph)[];
const controlNodeKeys = ["nodeId", "definitionId"] as const satisfies readonly (keyof AuthoredFlowControlNode)[];
const edgeKeys = ["edgeId", "sourceNodeId", "sourcePortId", "targetNodeId", "targetPortId"] as const satisfies readonly (keyof AuthoredFlowEdge)[];
const omittedKeys = ["controlNodes", "edges"] as const satisfies readonly (keyof AuthoredFlowGraph["omitted"])[];

/**
 * Validates the `authoredGraph` record a created-Flow run's
 * `snapshots/flow-lane.json` carries: the Flow's control nodes and its edges.
 *
 * Every string must be a Core identifier, the one shape that cannot hold a
 * label or page text, and each list must sit inside
 * `AUTHORED_FLOW_GRAPH_BOUNDS`. Control node ids and edge ids are unique.
 */
export function validateAuthoredFlowGraph(input: unknown): ValidationResult<AuthoredFlowGraph> {
  const issues: ValidationIssue[] = [];
  const value = object(input, "$", issues);
  if (value) {
    keys(value, graphKeys, "$", issues);
    array(value.controlNodes, "$.controlNodes", issues, (entry, path) => checkControlNode(entry, path, issues));
    array(value.edges, "$.edges", issues, (entry, path) => checkEdge(entry, path, issues));
    if (Array.isArray(value.controlNodes)) {
      if (value.controlNodes.length > AUTHORED_FLOW_GRAPH_BOUNDS.controlNodes) add(issues, "$.controlNodes", `must hold at most ${AUTHORED_FLOW_GRAPH_BOUNDS.controlNodes} nodes`);
      uniqueStrings(value.controlNodes.filter(isObject).map((entry) => entry.nodeId), "$.controlNodes", issues, "node ids");
    }
    if (Array.isArray(value.edges)) {
      if (value.edges.length > AUTHORED_FLOW_GRAPH_BOUNDS.edges) add(issues, "$.edges", `must hold at most ${AUTHORED_FLOW_GRAPH_BOUNDS.edges} edges`);
      uniqueStrings(value.edges.filter(isObject).map((entry) => entry.edgeId), "$.edges", issues, "edge ids");
    }
    const omitted = object(value.omitted, "$.omitted", issues);
    if (omitted) {
      keys(omitted, omittedKeys, "$.omitted", issues);
      for (const key of omittedKeys) finite(omitted[key], `$.omitted.${key}`, issues, 0, Number.MAX_SAFE_INTEGER, true);
    }
  }
  return result(input, issues);
}

export function assertAuthoredFlowGraph(input: unknown): asserts input is AuthoredFlowGraph {
  const checked = validateAuthoredFlowGraph(input);
  if (!checked.valid) throw new ContractValidationError("AuthoredFlowGraph", checked.issues);
}

function checkControlNode(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues);
  if (!value) return;
  keys(value, controlNodeKeys, path, issues);
  identifier(value.nodeId, `${path}.nodeId`, issues, false);
  identifier(value.definitionId, `${path}.definitionId`, issues, true);
}

function checkEdge(input: unknown, path: string, issues: ValidationIssue[]): void {
  const value = object(input, path, issues);
  if (!value) return;
  keys(value, edgeKeys, path, issues);
  identifier(value.edgeId, `${path}.edgeId`, issues, true);
  identifier(value.sourceNodeId, `${path}.sourceNodeId`, issues, false);
  identifier(value.sourcePortId, `${path}.sourcePortId`, issues, true);
  identifier(value.targetNodeId, `${path}.targetNodeId`, issues, false);
  identifier(value.targetPortId, `${path}.targetPortId`, issues, true);
}

function identifier(input: unknown, path: string, issues: ValidationIssue[], nullable: boolean): void {
  if (nullable && input === null) return;
  if (!isCoreIdentifier(input)) add(issues, path, nullable ? "must be a Core identifier or null" : "must be a Core identifier");
}
