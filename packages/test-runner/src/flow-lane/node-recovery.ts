// Whether each attempt's node ended on a successful attempt.
//
// Core keeps every attempt of a node, so a node the ladder retried appears once
// per attempt and the failed one is still in the list beside the success that
// followed it. Two readers ask the same question of that list, and each used to
// answer it its own way: which failure decided the run
// (`persisted-flow-run.ts`), and whether a recovery could still be running for
// it (`terminal-run-wait.ts`). One grouping rule, in one place, so the two
// cannot drift.
//
// The grouping is `recovery-attribution.ts`'s: by Core's node id, and an
// attempt that names no node is its own group, because it can be joined to
// nothing and folding every such attempt together would invent a node with as
// many attempts as the run had unnamed ones.
//
// Nothing here reads a failure record, a status word other than Core's own
// `succeeded`, or anything the page produced.

/** As much of one attempt as this rule reads: Core's status word, and the node it ran. */
export type NodeAttempt = { readonly status?: unknown; readonly nodeId?: unknown };

/**
 * One entry per attempt, in the order given: whether the node that ran that
 * attempt ended on a successful one.
 *
 * Every attempt of a node carries the same answer, which is the point -- it is
 * what turns "this attempt failed" into "this attempt's failure was recovered
 * from" or "this attempt's failure is where the run stopped", and a reader
 * holding an attempt's index needs no second pass to tell which.
 *
 * Core sorts the attempts it returns by its own order and every caller keeps
 * that order, so the last entry for a node is the attempt that ended it.
 */
export function recoveredByNode(attempts: readonly NodeAttempt[]): boolean[] {
  const keys = attempts.map((attempt, index) => nodeKey(attempt, index));
  const ended = new Map<string, unknown>();
  keys.forEach((key, index) => { ended.set(key, attempts[index]?.status); });
  return keys.map((key) => ended.get(key) === "succeeded");
}

/**
 * Whether every node the run attempted ended on a successful attempt: a run
 * that met no fault, or met one and recovered from every one of them.
 *
 * A run with no attempt at all answers `true` vacuously, so a caller that
 * cares must establish it has attempts first.
 */
export function everyNodeEndedSucceeded(attempts: readonly NodeAttempt[]): boolean {
  return recoveredByNode(attempts).every((recovered) => recovered);
}

/** An attempt that names no node is its own group; a named one joins its node. */
function nodeKey(attempt: NodeAttempt, index: number): string {
  return typeof attempt.nodeId === "string" && attempt.nodeId.length > 0 ? `node:${attempt.nodeId}` : `unnamed:${index}`;
}
