import { RunnerFailure } from "../failure.js";
import type { RunLaneObservation } from "../flow-lane/index.js";
import type { FlowLanePermissionStop } from "./permission-stop.js";

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
 * `permissionStop` is a created-Flow build that stopped to ask the person at
 * the task's declared permission point (`../flow-lane/creation/permission-point.ts`).
 * Stopping there is the right behaviour, and it is still not a working
 * automation: no Flow was built, so nothing did the task. It fails here under
 * its own verdict, `stopped_for_permission`, carried in the failure's details
 * with the consequence and control it stopped at, and is never a pass. Lane
 * t195 once exempted such a stop from this rule, and overnight lane D's bigbox
 * pickup-order then recorded 12 "passes", every one with `flowCreated: false`
 * in its `evaluation.json`. A task designed so that the
 * person grants and the build continues reaches no stop at all, and passes
 * only if the continued build then created its Flow.
 */
export function assertFlowLaneBuiltFlow(input: { flowLane: boolean; evaluated: boolean; published: Pick<RunLaneObservation, "flowCreated"> | undefined; permissionStop?: FlowLanePermissionStop | undefined }): void {
  if (!input.flowLane || !input.evaluated) return;
  const flowCreated = input.published?.flowCreated ?? null;
  if (input.permissionStop) {
    const { consequence, control } = input.permissionStop;
    throw new RunnerFailure("runtime.behavior", `FluxIQ stopped to ask for permission to ${consequence} at the task's declared permission point and built no working Flow: stopped_for_permission, which is not a pass`, { details: { verdict: "stopped_for_permission", consequence, control, flowCreated } });
  }
  if (flowCreated === true) return;
  throw new RunnerFailure("environment.missing", "The Flow lane built no Flow from this run's recording, so the run cannot pass", { details: { flowCreated } });
}
