// Which recovery absorbed the fault a run met, as a campaign row states it,
// from `snapshots/flow-lane.json`'s `recovery` block.
//
// This is the other half of the adversarial measurement. `providerCalls` on
// the row already says what a run spent; on its own it cannot tell a rung that
// absorbed the fault from a fixture whose arming never reached the page,
// because both spend nothing and both pass. `resolvedBy` says which recovery
// answered, in the run's own words -- the ladder rung Core published on the
// attempt it asked for, or the strategy the browser found the control by.
//
// Closed words and counts only: every value here comes from a fixed list the
// Flow lane narrowed before it wrote the snapshot.

const RUNGS = new Set(["none", "host_target_resolution", "skip_satisfied_node", "await_recorded_state", "clear_interference", "retry_node"]);

/**
 * The run's rung attribution, or `null` for a run that reached no Flow lane
 * and so recovered nothing anywhere.
 *
 * - `resolvedBy`: every recovery that resolved a node, each named once. Empty
 *   is a run where nothing had to recover -- which is the answer a control
 *   condition wants and a defect in an armed one.
 * - `rungsRun`: every rung that ran, answering or not. A rung in `rungsRun`
 *   and not in `resolvedBy` tried and did not settle it.
 * - `maxAttemptsPerNode`: the cost, in attempts of the busiest node.
 * - `nodes`: how many action nodes the run attempted, and how many of those
 *   needed a recovery at all.
 */
export function rungAttribution(flowLane) {
  const recovery = flowLane?.recovery;
  if (!recovery || typeof recovery !== "object") return null;
  const nodes = Array.isArray(recovery.nodes) ? recovery.nodes.filter((node) => node && typeof node === "object") : [];
  return {
    resolvedBy: words(recovery.resolvedBy),
    rungsRun: words(recovery.rungsRun),
    maxAttemptsPerNode: isCount(recovery.maxAttemptsPerNode) ? recovery.maxAttemptsPerNode : null,
    nodeCount: nodes.length,
    recoveredNodeCount: nodes.filter((node) => RUNGS.has(node.resolvedBy) && node.resolvedBy !== "none").length,
  };
}

function words(value) {
  return Array.isArray(value) ? value.filter((word) => RUNGS.has(word)) : [];
}

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
