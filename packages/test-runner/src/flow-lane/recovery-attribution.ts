// Which recovery absorbed the fault a run met, and what it cost.
//
// This is the measurement the whole adversarial workstream exists to take, and
// until now there was nothing to take it with. The recovery ladder landed in
// Core, unit-tested and proved to run live, and no variant in the scenario
// corpus was absorbable by it -- the corpus was built to prove *model* repair
// -- so the ladder had never been shown to absorb anything. A declared
// zero-call run says only that nothing was spent. It cannot tell a rung that
// absorbed the fault from a fixture whose arming never reached the page, and
// both of those pass.
//
// So the run has to say which recovery answered, per node, in words the run
// itself wrote:
//
//   - Core publishes `retry` on every attempt after a node's first, naming the
//     ladder rung that asked for it. A node with three attempts whose third
//     succeeded, carrying `rung: "retry_node"`, was absorbed by rung 4.
//   - The browser publishes the `strategy` it found the element by. That is
//     the recovery with no rung: the executor implements no
//     re-resolve-the-target rung because the host has already re-resolved
//     before Core is told anything failed, so a control renamed between
//     authoring and replay is recovered on a *succeeded* first attempt and
//     leaves no other trace at all.
//
// Nothing here judges the oracle, the run's status, or its failure. It reports
// what recovered each node and holds the run to what the fixture declared
// about it, and no more.
import type { ExpectedRecovery, ExpectedRecoveryRung } from "@fluxiq-web-extension/test-contracts";
import { expectedRecoveryRungs } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import type { PersistedHostTargetStrategy, PersistedLadderRung } from "./persisted-attempt.js";
import type { PersistedFlowAction } from "./persisted-flow-run.js";

/**
 * The strategies that mean the browser found the control some way other than
 * the one the recording gave it.
 *
 * `selector` is the recording replaying as authored, and `coordinates` and
 * `active-element` are likewise what a recorded step asked for directly.
 * `fingerprint`, `scored-candidate` and `visual-target` are all the host
 * having had to look for the element -- which is the recovery. It matters that
 * this is a positive list: a strategy the domain adds later is not silently
 * counted as a recovery, and a reader who wants it counted has to say so here.
 */
const RECOVERING_HOST_STRATEGIES: ReadonlySet<PersistedHostTargetStrategy> = new Set<PersistedHostTargetStrategy>(["fingerprint", "scored-candidate", "visual-target"]);

/** One Flow node's attempts, joined back together, and what became of them. */
export type NodeRecoveryAttribution = {
  /** Core's node id, or `null` for an attempt that named none and so could be joined to nothing. */
  nodeId: string | null;
  /** The output the node dispatches, as the lane names it. */
  actionType: string;
  /** How many attempts this node took. */
  attempts: number;
  /** Every rung that asked for a further attempt of this node, in the order they ran, each named once. */
  rungsRun: PersistedLadderRung[];
  /**
   * What resolved this node. `none` covers both a node nothing had to recover
   * and a node nothing did: a node that ended failed is `none`, because a rung
   * that ran and did not resolve it is in `rungsRun` and is not an absorption.
   */
  resolvedBy: ExpectedRecoveryRung;
  /** The strategy the host found the element by on the attempt that ended the node; `null` where it reported none. */
  hostStrategy: PersistedHostTargetStrategy | null;
  /** Whether the node's last attempt succeeded. */
  succeeded: boolean;
};

/** The run's recoveries, per node and summed. */
export type RunRecoveryAttribution = {
  nodes: NodeRecoveryAttribution[];
  /** Every rung that ran anywhere in the run, each named once, in ladder order. */
  rungsRun: PersistedLadderRung[];
  /** Every recovery that actually resolved a node, each named once, in ladder order. `none` is never a member. */
  resolvedBy: ExpectedRecoveryRung[];
  /** The most attempts any one node took. `0` for a run with no attempts. */
  maxAttemptsPerNode: number;
};

/**
 * The run's attempts joined back into nodes.
 *
 * Attempts arrive in Core's own order, one per attempt, so a node the ladder
 * retried appears more than once. Grouping is by node id, and an attempt that
 * names no node is its own group: it cannot be joined to anything, and folding
 * every such attempt together would invent a node with as many attempts as the
 * run had unnamed ones.
 */
export function recoveryAttribution(actions: readonly PersistedFlowAction[]): RunRecoveryAttribution {
  const groups = new Map<string, PersistedFlowAction[]>();
  for (const action of actions) {
    const key = action.nodeId ?? `unnamed:${action.attemptIndex}`;
    const group = groups.get(key);
    if (group) group.push(action); else groups.set(key, [action]);
  }
  const nodes = [...groups.values()].map(nodeAttribution);
  return {
    nodes,
    rungsRun: inLadderOrder(nodes.flatMap((node) => node.rungsRun)) as PersistedLadderRung[],
    resolvedBy: inLadderOrder(nodes.flatMap((node) => node.resolvedBy === "none" ? [] : [node.resolvedBy])),
    maxAttemptsPerNode: nodes.reduce((most, node) => Math.max(most, node.attempts), 0),
  };
}

function nodeAttribution(attempts: readonly PersistedFlowAction[]): NodeRecoveryAttribution {
  // Core sorts the attempts it returns by its own order, and the lane keeps
  // that order, so the last entry is the attempt that ended the node.
  const last = attempts[attempts.length - 1];
  if (!last) throw new RunnerFailure("runtime.behavior", "A node was grouped with no attempts");
  const rungsRun = inLadderOrder(attempts.slice(1).flatMap((attempt) => attempt.retry ? [attempt.retry.rung] : [])) as PersistedLadderRung[];
  const hostStrategy = last.hostTargetResolution?.strategy ?? null;
  const succeeded = last.status === "succeeded";
  return {
    nodeId: last.nodeId,
    actionType: last.actionType,
    attempts: attempts.length,
    rungsRun,
    resolvedBy: resolvedBy(succeeded, last, hostStrategy),
    hostStrategy,
    succeeded,
  };
}

/**
 * What answered for this node.
 *
 * The rung that asked for the attempt that finally succeeded is the one that
 * absorbed the fault, which is why this reads the *last* attempt's `retry`
 * rather than the list: a node that waited for state, failed anyway, and then
 * succeeded on a plain retry was absorbed by the retry, and the wait is
 * reported in `rungsRun` as a rung that ran and did not answer.
 *
 * A node that succeeded on its first attempt was absorbed by no rung, and the
 * only recovery that could have happened is the host's, before Core saw
 * anything.
 */
function resolvedBy(succeeded: boolean, last: PersistedFlowAction, hostStrategy: PersistedHostTargetStrategy | null): ExpectedRecoveryRung {
  if (!succeeded) return "none";
  if (last.retry) return last.retry.rung;
  return hostStrategy !== null && RECOVERING_HOST_STRATEGIES.has(hostStrategy) ? "host_target_resolution" : "none";
}

/** Each name once, in the order the contract lists them, which is ladder order. */
function inLadderOrder(rungs: readonly ExpectedRecoveryRung[]): ExpectedRecoveryRung[] {
  const seen = new Set(rungs);
  return expectedRecoveryRungs.filter((rung) => seen.has(rung));
}

/**
 * Whether every failure this run met was absorbed: something failed, and every
 * node still ended on a successful attempt.
 *
 * It is here because the rest of the lane could not previously tell an
 * absorbed run from a failed one, and read every absorption as a defect. Core
 * records the *first* failure it meets on the run, and keeps the failed
 * attempt in the trace, so a run the retry rung rescued arrives carrying a
 * failure record and a failed attempt beside its `succeeded` status. Measured
 * on `delayed-ui/late-recoverable`: the wait ran out after 5,025 ms, the rung
 * attempted it again, the second attempt succeeded after 1,885 ms, the Flow
 * finished and the oracle passed -- and the run was failed for "an unexpected
 * timeout failure" it had recovered from.
 *
 * A failed attempt is evidence of what the page did, and Core is right to keep
 * it. What it is not is the run's outcome.
 */
export function absorbedEveryFailure(actions: readonly PersistedFlowAction[]): boolean {
  if (actions.every((action) => action.status === "succeeded")) return false;
  return recoveryAttribution(actions).nodes.every((node) => node.succeeded);
}

/**
 * Holds a run to what its scenario declared about which recovery absorbs the
 * armed condition.
 *
 * With no declaration this does nothing, so every scenario that has not
 * declared one runs exactly as it did.
 *
 * With one, it is an expectation and not a report. A condition declared
 * absorbed by `retry_node` that is instead absorbed by the host's
 * re-resolution has stopped measuring what it was written to measure, and a
 * condition that stops being absorbed at all has found the regression this
 * whole lane exists to find -- both of which would otherwise pass, because the
 * run still ends green and still spends nothing.
 *
 * It narrows one judgement and no other: the oracle, the declared final state,
 * the extraction judgement, the failure and the provider-call declaration are
 * each judged exactly as they were.
 */
export function assertRecoveryAsDeclared(declared: ExpectedRecovery | undefined, attribution: RunRecoveryAttribution): void {
  if (!declared) return;
  const details = { absorbedBy: declared.absorbedBy, resolvedBy: attribution.resolvedBy, rungsRun: attribution.rungsRun, maxAttemptsPerNode: attribution.maxAttemptsPerNode };
  if (declared.absorbedBy === "none") {
    if (attribution.resolvedBy.length > 0) {
      throw new RunnerFailure("runtime.behavior", `Declared recovery: the scenario declares that nothing recovers this run (${declared.because}), and ${attribution.resolvedBy.join(", ")} did.`, { details });
    }
  } else if (!attribution.resolvedBy.includes(declared.absorbedBy)) {
    const what = attribution.resolvedBy.length ? `${attribution.resolvedBy.join(", ")} did` : "nothing did";
    throw new RunnerFailure("runtime.behavior", `Declared recovery: the scenario declares that ${declared.absorbedBy} absorbs this run (${declared.because}), and ${what}.`, { details });
  }
  if (declared.maxAttemptsPerNode !== undefined && attribution.maxAttemptsPerNode > declared.maxAttemptsPerNode) {
    throw new RunnerFailure("runtime.behavior", `Declared recovery: the scenario allows at most ${declared.maxAttemptsPerNode} attempt(s) of any node, and one node took ${attribution.maxAttemptsPerNode}.`, { details });
  }
}

/**
 * The attribution as the Flow-lane snapshot states it: node ids, closed rung
 * names, closed strategy names and counts. It is written before any
 * expectation is judged, so a run that fails its declaration still says what
 * recovered what.
 */
export function recoveryAttributionSnapshot(attribution: RunRecoveryAttribution) {
  return {
    resolvedBy: attribution.resolvedBy,
    rungsRun: attribution.rungsRun,
    maxAttemptsPerNode: attribution.maxAttemptsPerNode,
    nodes: attribution.nodes.map((node) => ({
      nodeId: node.nodeId,
      actionType: node.actionType,
      attempts: node.attempts,
      succeeded: node.succeeded,
      resolvedBy: node.resolvedBy,
      rungsRun: node.rungsRun,
      hostStrategy: node.hostStrategy,
    })),
  };
}
