import { runActionStatuses, type RunActionTiming } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunAction } from "../existing-fluxiq-control.js";

/** A status as `run.json` records it; anything outside the contract is `unknown`. */
export function runActionStatus(value: unknown): RunActionTiming["status"] {
  return typeof value === "string" && (runActionStatuses as readonly string[]).includes(value) ? value as RunActionTiming["status"] : "unknown";
}

/** A persisted Flow's action attempts as run timings, in attempt order. An unfinished attempt has no duration. */
export function flowActionTimings(actions: readonly ExistingRunAction[]): RunActionTiming[] {
  return [...actions].sort((left, right) => left.order - right.order).map((action) => ({
    actionType: action.definitionId,
    startedAt: new Date(action.startedAt).toISOString(),
    ...(action.finishedAt === undefined ? {} : { durationMs: Math.max(0, Math.round(action.finishedAt - action.startedAt)) }),
    status: runActionStatus(action.status),
  }));
}
