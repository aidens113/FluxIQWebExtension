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
 *
 * `authoredNodes` is what each of those action nodes was told to do, screened:
 * the node, its definition, its output and its parameters, with every value the
 * screen would not carry named as withheld rather than dropped. It is here
 * because `flowShape` alone was not enough to diagnose a failure. Six live
 * `product-catalog` extract runs failed identically with `expectedRecords 8,
 * observedRecords 23` -- eight products a page across three pages, so a Flow
 * that walked all three for an instruction asking for the first -- and nothing
 * a run wrote said whether the model had authored `pagination: { mode: "next",
 * maxPages: 3 }`, `mode: "numbered"`, or a scroll with a cap. No Flow document
 * is persisted under `test-runs/`, Core deletes an isolated run's workspace
 * when the run ends, and a fix shipped against the inferred cause did not work.
 */
export function createdFlowLaneSnapshot(evidence: CreatedFlowLaneEvidence) {
  return {
    lane: "created-flow" as const,
    task: describeCreatedFlowRequest(evidence.request),
    build: evidence.build,
    review: evidence.review,
    flowId: evidence.flowId,
    flowShape: evidence.shape,
    authoredNodes: evidence.authoredNodes,
    // Whether the Flow can reach the page it works on, or whether
    // `prepareFlowPage("playback")` reached it for the Flow. A
    // `navigate-and-extract` Flow with no navigation node is measured on a page
    // somebody else opened, so the reading of everything after it depends on
    // this line.
    ownPage: evidence.ownPage,
    runtimeRunId: evidence.run.runId,
    status: evidence.run.status,
    // Core's own word for whether the result was judged, and how it came out.
    // Without it a bundle records a `succeeded` run and nothing that says
    // whether anyone checked what it produced.
    resultVerification: evidence.run.resultVerification,
    reportedVerdict: evidence.observation.reportedVerdict,
    harnessActivations: evidence.run.harnessActivations,
    // The failure that decided the run, which is not the first one it met: a
    // fault the ladder recovered from moves to `recoveredFailures`, so a
    // transient miss cannot become the run's headline.
    failure: evidence.run.failure,
    recoveredFailures: evidence.run.recoveredFailures ?? [],
    stoppedWithoutFailedAttempt: evidence.run.stoppedWithoutFailedAttempt ?? null,
    // Which route the Router took, and each rule's verdict and reason. Ids and
    // Core's matcher reasons only: a reason names the path and the test, never
    // a value the host observed.
    route: evidence.run.route,
    harnessRecovery: evidence.run.harnessRecovery,
    // What Core never finished writing about this run, when the wait for it
    // ran out: today only its recovery record. The run is reported as it
    // stands, so this is the difference between "Core recovered nothing" and
    // "Core never said".
    unsettled: evidence.run.unsettled ?? null,
    oracleVerdict: evidence.observation.oracleVerdict,
    extraction: evidence.extraction ? flowExtractionSnapshot(evidence.extraction) : null,
    actions: flowActionsSnapshot(evidence.run),
  };
}
