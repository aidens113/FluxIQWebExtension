const OUTPUT_NAME = /^(?:[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+|\(unrecognized\))$/u;

/**
 * The created Flow's make-up from `snapshots/flow-lane.json` `flowShape`:
 * node counts and its action nodes counted by output. Only output-shaped names
 * and whole counts are kept; `null` for a run that created no Flow.
 */
export function createdFlowShape(flowLane) {
  const shape = flowLane?.lane === "created-flow" ? flowLane.flowShape : null;
  if (!shape || typeof shape !== "object") return null;
  const count = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
  const nodeTypes = Object.fromEntries(Object.entries(shape.actionTypes ?? {}).filter(([name, n]) => OUTPUT_NAME.test(name) && count(n) !== null).sort(([a], [b]) => a.localeCompare(b)));
  return { nodeCount: count(shape.nodeCount), actionNodeCount: count(shape.actionNodeCount), nodeTypes, extractNodes: count(shape.extractNodes), navigationNodes: count(shape.navigationNodes) };
}
