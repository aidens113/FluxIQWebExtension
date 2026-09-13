import { RunnerFailure } from "../failure.js";
import type { RunLaneObservation } from "../flow-lane/index.js";

/**
 * A Flow-lane run passes only if it built a Flow from its recording. The lane
 * publishes its observation, with `flowCreated` true, before it judges any
 * expectation, so every run that reached its Flow has one. A run that never
 * reached the lane has none: before every Flow-lane run bootstrapped a Core
 * identity (`coreIdentityRequired`), such a run skipped pairing, recording and
 * the lane, and passed on the recording's checks alone.
 *
 * `evaluated` is false on the existing and clone targets, which run a
 * pre-existing Flow and are not judged here.
 */
export function assertFlowLaneBuiltFlow(input: { flowLane: boolean; evaluated: boolean; published: Pick<RunLaneObservation, "flowCreated"> | undefined }): void {
  if (!input.flowLane || !input.evaluated || input.published?.flowCreated === true) return;
  throw new RunnerFailure("environment.missing", "The Flow lane built no Flow from this run's recording, so the run cannot pass", { details: { flowCreated: input.published?.flowCreated ?? null } });
}
