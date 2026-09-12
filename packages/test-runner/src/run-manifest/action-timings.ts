import { runActionStatuses, type RunActionTiming } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunAction } from "../existing-fluxiq-control.js";

/** A status as `run.json` records it; anything outside the contract is `unknown`. */
export function runActionStatus(value: unknown): RunActionTiming["status"] {
  return typeof value === "string" && (runActionStatuses as readonly string[]).includes(value) ? value as RunActionTiming["status"] : "unknown";
}

/**
 * A persisted Flow's action attempts as run timings, in attempt order. An
 * unfinished attempt has no duration.
 *
 * `actionTypes` maps a Flow node id to the domain output that node dispatches,
 * as `readFlowActionTypes` reads it from the Flow's own nodes. Core records
 * every recorded action as one `builtin.policy.action` node and the stored
 * attempt drops the node's inputs, so `definitionId` reads the same for every
 * recorded action alike and `run.json` cannot say what ran. The attempt's
 * `nodeId` is the surviving link, and this is the join the Flow lane makes.
 *
 * The map is the caller's to read, as it is in the Flow lane: the lane that
 * owns the run decides when the extra Automation Studio calls are worth making
 * and what to do when the Flow declares no output-dispatching node. Omitted,
 * every attempt reports its definition id, which is the pre-join behaviour.
 */
export function flowActionTimings(actions: readonly ExistingRunAction[], actionTypes: ReadonlyMap<string, string> = new Map()): RunActionTiming[] {
  return [...actions].sort((left, right) => left.order - right.order).map((action) => ({
    // The output this attempt's node dispatches, falling back to the definition
    // id for a node the Flow does not declare -- a native node whose definition
    // id is its action.
    actionType: actionTypes.get(action.nodeId) ?? action.definitionId,
    startedAt: new Date(action.startedAt).toISOString(),
    ...(action.finishedAt === undefined ? {} : { durationMs: Math.max(0, Math.round(action.finishedAt - action.startedAt)) }),
    status: runActionStatus(action.status),
  }));
}
