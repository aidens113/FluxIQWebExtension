// The `snapshots/flow-lane.json` document a created-Flow run writes. It keeps
// the recorded lane's `actions` shape, because that is where the evaluation
// reads evidence sizes from, and says instead of a recording what was asked,
// what the build did, and what the created Flow was made of: identifiers,
// closed names and counts, never a selector, page text or a value.

import { flowActionsSnapshot, flowExtractionSnapshot } from "../run-flow-lane.js";
import type { CreatedFlowLaneEvidence } from "./lane.js";
import { describeCreatedFlowRequest } from "./request.js";

/**
 * `build` is the build's own record (`CreatedFlowBuild`): its outcome, Core's
 * counted provider calls and token totals, the evidence loop's counts and
 * tool ids, and any refusal code. `flowShape` is the created Flow's node count
 * and its action nodes counted by output. `extraction` is `null` for a task
 * judged by a playback goal.
 */
export function createdFlowLaneSnapshot(evidence: CreatedFlowLaneEvidence) {
  return {
    lane: "created-flow" as const,
    task: describeCreatedFlowRequest(evidence.request),
    build: evidence.build,
    review: evidence.review,
    flowId: evidence.flowId,
    flowShape: evidence.shape,
    runtimeRunId: evidence.run.runId,
    status: evidence.run.status,
    // Core's own word for whether the result was judged, and how it came out.
    // Without it a bundle records a `succeeded` run and nothing that says
    // whether anyone checked what it produced.
    resultVerification: evidence.run.resultVerification,
    reportedVerdict: evidence.observation.reportedVerdict,
    harnessActivations: evidence.run.harnessActivations,
    failure: evidence.run.failure,
    stoppedWithoutFailedAttempt: evidence.run.stoppedWithoutFailedAttempt ?? null,
    // Which route the Router took, and each rule's verdict and reason. Ids and
    // Core's matcher reasons only: a reason names the path and the test, never
    // a value the host observed.
    route: evidence.run.route,
    harnessRecovery: evidence.run.harnessRecovery,
    oracleVerdict: evidence.observation.oracleVerdict,
    extraction: evidence.extraction ? flowExtractionSnapshot(evidence.extraction) : null,
    actions: flowActionsSnapshot(evidence.run),
  };
}
