// Which attempts belong to a node Core passed by its optional way-on.
//
// The companion of `node-recovery.ts` `recoveredByNode`, and grouped the same
// way: by Core's node id, an attempt naming no node being its own group, and
// the last attempt of a node being the one that ended it. A node whose last
// attempt Core bypassed (`attempt-bypass.ts`) did not fail the run, so every
// failure on it -- the bypassed one and any retry before it -- is a note in
// the evidence, never the run's failure.

import type { PersistedOptionalBypass } from "./attempt-bypass.js";

/** As much of an attempt as this rule reads. */
export type BypassedNodeAttempt = { readonly nodeId?: string | null; readonly optionalBypass?: PersistedOptionalBypass };

/** One entry per attempt, in the order given: whether its node ended on an attempt Core bypassed. */
export function bypassedByNode(attempts: readonly BypassedNodeAttempt[]): boolean[] {
  const keys = attempts.map((attempt, index) => (typeof attempt.nodeId === "string" && attempt.nodeId.length > 0 ? `node:${attempt.nodeId}` : `unnamed:${index}`));
  const ended = new Map<string, boolean>();
  keys.forEach((key, index) => { ended.set(key, attempts[index]?.optionalBypass !== undefined); });
  return keys.map((key) => ended.get(key) === true);
}
