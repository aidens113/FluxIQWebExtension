// The repair lane's record for a created Flow whose own judgement failed.
//
// The created-Flow lane publishes the run before it judges it, then throws on
// a failed judgement (its oracle, or one before it). The repair lane used to run
// only after a pass, so a failed oracle left no `snapshots/repair-lane.json` at
// all, and the gate's P4 was inferred from absence (run-mv6v2hx5-f448e662).
// This wraps the lane: it remembers the run the lane published, and when the
// lane then throws, it has the repair lane record that run beside the failure
// (which applies nothing, `LiveRepairLaneInput.laneFailure`) before the
// failure is rethrown unchanged. A lane that threw before publishing a run has
// no run to record, and is rethrown alone.

import { liveRepairLaneFailure } from "./lane-failure.js";
import type { LiveRepairLaneFailure } from "./run-repair-lane.js";

/** Wraps the lane's publish hook so the run it publishes is remembered first. */
export type JudgedRunWatch<E> = (publish: (evidence: E) => Promise<void>) => (evidence: E) => Promise<void>;

/**
 * Runs `lane`, handing it `seen` to wrap its publish hook with, and on a throw
 * after a published run calls `record` with that run and the failure's closed
 * words, then rethrows the failure.
 */
export async function recordFailedJudgement<E, R>(
  lane: (seen: JudgedRunWatch<E>) => Promise<R>,
  record: (evidence: E, failure: LiveRepairLaneFailure) => Promise<unknown>,
): Promise<R> {
  let judged: { evidence: E } | undefined;
  const seen: JudgedRunWatch<E> = (publish) => async (evidence) => {
    judged = { evidence };
    await publish(evidence);
  };
  try {
    return await lane(seen);
  } catch (error) {
    if (judged) await record(judged.evidence, liveRepairLaneFailure(error)).catch(/* best-effort: the judgement's own failure, rethrown below, is the run's finding */ () => undefined);
    throw error;
  }
}
