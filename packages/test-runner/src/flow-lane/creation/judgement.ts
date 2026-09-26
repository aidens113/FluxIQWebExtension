// Judging a created Flow by the records it stored. The recorded Flow lane pairs
// each dataset with a recorded extract step by the recording's order; a created
// Flow has no recording, so it is judged against the one extract step its task
// names, with the datasets in Core's own order, through the same judgement and
// the same record comparison the recorded lane uses.

import type { ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { assertFlowExtraction, judgeFlowExtraction, type FlowExtractionJudgement } from "../expectations.js";
import { extractionReadsByNode } from "../extraction-read.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";

/**
 * The run's datasets against the expected dataset `stepId` names, which must
 * be an `extract` step of `workflow` (`resolveCreatedFlowRequest` has already
 * refused a task for which it is not). Never throws, so a run whose records
 * are wrong is still published with its measurement. The measurement keeps the
 * step's real position in the workflow's script.
 */
export function judgeCreatedFlowDataset(input: {
  workflow: ResolvedScenarioWorkflow;
  stepId: string;
  run: PersistedFlowRunOutcome;
  actionTypes: ReadonlyMap<string, string>;
  /** Where the run's scenario was served from, as `judgeFlowExtraction` takes it. */
  scenarioOrigin: string;
}): FlowExtractionJudgement {
  const stepIndex = input.workflow.recordingScript.findIndex((step) => step.operation === "extract" && step.id === input.stepId);
  const step = input.workflow.recordingScript[stepIndex];
  const judgement = judgeFlowExtraction({
    expected: (input.workflow.expected.extracted ?? []).filter((entry) => entry.step === input.stepId),
    script: step ? [step] : [],
    datasets: input.run.extracted,
    actionTypes: input.actionTypes,
    // The order the Flow's own nodes ran in.
    //
    // **It was an empty map, and an empty map is not "no order" — it is an
    // arbitrary one.** Every dataset then sorts to the same position and
    // `ordered[0]` is whichever set Core happened to return first, so a Flow
    // with two extraction nodes had its expected step paired with either of
    // them by chance. Measured on `run-muhrf6c4-9714939f`: Core stored "8
    // records, across 2 record sets", the judged step measured **0**, and the
    // 8 were in the other one. The Flow had found the answer and this scored
    // the empty table, then reported the run as returning nothing.
    //
    // A created Flow has no recording to take an order from, which is why this
    // was empty; it has its own execution instead. The node that ran first is
    // first, which pairs the scenario's single expected step with the Flow's
    // first extraction rather than with a coin toss.
    candidateOrder: executionOrder(input.run.actions),
    durationsByNode: input.run.extractionDurationsByNode,
    readsByNode: extractionReadsByNode(input.run.actions),
    scenarioOrigin: input.scenarioOrigin,
  });
  const steps = judgement.steps.map((judged) => ({ ...judged, stepIndex, measurement: { ...judged.measurement, stepIndex } }));
  return { ...judgement, steps, measurements: steps.map((judged) => judged.measurement) };
}

/**
 * Each node's position in the order its first attempt ran, for nodes that ran
 * at all.
 *
 * First attempt rather than last: a node the ladder retried ran where it first
 * ran, and a retry late in the run must not move its dataset behind one that
 * started after it.
 */
function executionOrder(actions: readonly { nodeId?: string | null }[]): ReadonlyMap<string, number> {
  const order = new Map<string, number>();
  for (const action of actions) {
    const nodeId = action.nodeId;
    if (typeof nodeId !== "string" || !nodeId || order.has(nodeId)) continue;
    order.set(nodeId, order.size);
  }
  return order;
}

/**
 * Fails a created Flow whose records do not match. A Flow with no extract node
 * fails first and as exactly that: it could not have collected anything, and
 * blaming a record count would hide why.
 */
export function assertCreatedFlowDataset(judgement: FlowExtractionJudgement): void {
  if (judgement.steps.length === 0 || judgement.expectation !== "judged") {
    throw new RunnerFailure("fixture.invalid", "The task's expected dataset names no expected extract step of its workflow, so nothing could be judged");
  }
  if (judgement.extractNodes === 0) {
    throw new RunnerFailure("runtime.behavior", "The created Flow has no extract node, so it could not collect the records the task asks for", { details: { extractNodes: 0 } });
  }
  assertFlowExtraction(judgement);
}

/** Whether the records matched, for the run's oracle verdict. */
export function createdFlowDatasetHolds(judgement: FlowExtractionJudgement): boolean {
  try { assertCreatedFlowDataset(judgement); return true; }
  catch { return false; }
}
