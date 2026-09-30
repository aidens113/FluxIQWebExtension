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
// `succeeded` (and the closed `clearedByPerson` mark derived from Core's ask
// record), or anything the page produced.

/**
 * As much of one attempt as this rule reads: Core's status word, the node it
 * ran, and the stage its failure belongs to.
 *
 * The stage is a closed word of Core's own, in the same class as the status,
 * and it is read for one question only: whether an attempt failed because the
 * node would not run or because the finished run's result was judged wrong.
 * Nothing here reads a failure's message, its expected or actual text, or
 * anything the page produced.
 */
export type NodeAttempt = { readonly status?: unknown; readonly nodeId?: unknown; readonly failure?: { readonly stage?: unknown } | null; readonly clearedByPerson?: unknown };

/**
 * Whether an attempt ended its node well: it succeeded, or it failed on a check
 * only a person could pass and a person cleared it, so the run went on down the
 * node's `success` route with no further attempt (`persisted-flow-run.ts`
 * `clearedByPerson`).
 */
function endedWell(attempt: NodeAttempt | undefined): boolean {
  return attempt?.status === "succeeded" || attempt?.clearedByPerson === true;
}

/**
 * The stage a refuted result's failure carries. Core records the refutation on
 * the last record-storing attempt, so the attempt reads `failed` although the
 * node itself ran exactly as written.
 */
const VERIFICATION_STAGE = "verification";

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
  const ended = new Map<string, boolean>();
  keys.forEach((key, index) => { ended.set(key, endedWell(attempts[index])); });
  return keys.map((key) => ended.get(key) === true);
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

/**
 * Whether every node the run attempted actually ran, counting a node whose only
 * failure was the verdict on the run's result as having run.
 *
 * **Why this is a different question from `everyNodeEndedSucceeded`.** Core
 * records a refuted result as a failure on the last record-storing attempt, so
 * that attempt reads `failed` although the node executed exactly as authored
 * and produced rows. Core's recovery, though, plans from the deterministic
 * diagnosis of an attempt that *would not run*; a refuted result hands it none,
 * so it takes the unclassified path, writes no record, and there is nothing in
 * flight for a reader to wait for.
 *
 * Measured on `run-muher0en-508ddb69`: a three-node Flow whose every node ran,
 * refuted on its result, spent 568 s — 60% of a 949 s run — waiting out the
 * terminal-detail bound and then the full five-minute recovery-record wait for
 * a record that was never going to be written. The exploration that did the
 * actual work took 192 s and the Flow's own actions took 12.6 s.
 */
export function everyNodeRan(attempts: readonly NodeAttempt[]): boolean {
  const ended = new Map<string, NodeAttempt>();
  attempts.forEach((attempt, index) => { ended.set(nodeKey(attempt, index), attempt); });
  for (const attempt of ended.values()) {
    if (endedWell(attempt)) continue;
    if (attempt.failure && attempt.failure.stage === VERIFICATION_STAGE) continue;
    return false;
  }
  return true;
}
