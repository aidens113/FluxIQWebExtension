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
 *
 * `stoppedToAsk` is a created-Flow build that stopped to ask the person at the
 * task's declared permission point (`../flow-lane/creation/permission-point.ts`):
 * a consequential task run without permission for its act has that one right
 * ending, and it builds no Flow by construction. Until 2026-09-30 this rule
 * failed exactly that run (lane t195, `run-munovwp3-d898de74`: "FluxIQ stopped
 * to ask at the task's declared permission point", then `environment.missing`).
 */
export function assertFlowLaneBuiltFlow(input: { flowLane: boolean; evaluated: boolean; published: Pick<RunLaneObservation, "flowCreated"> | undefined; stoppedToAsk?: boolean }): void {
  if (!input.flowLane || !input.evaluated || input.published?.flowCreated === true || input.stoppedToAsk === true) return;
  throw new RunnerFailure("environment.missing", "The Flow lane built no Flow from this run's recording, so the run cannot pass", { details: { flowCreated: input.published?.flowCreated ?? null } });
}
