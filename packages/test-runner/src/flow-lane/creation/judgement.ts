// Judging a created Flow by the records it stored. The recorded Flow lane pairs
// each dataset with a recorded extract step by the recording's order; a created
// Flow has no recording, so it is judged against the one extract step its task
// names, with the datasets in Core's own order, through the same judgement and
// the same record comparison the recorded lane uses.

import type { ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { assertFlowExtraction, judgeFlowExtraction, type FlowExtractionJudgement } from "../expectations.js";
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
}): FlowExtractionJudgement {
  const stepIndex = input.workflow.recordingScript.findIndex((step) => step.operation === "extract" && step.id === input.stepId);
  const step = input.workflow.recordingScript[stepIndex];
  const judgement = judgeFlowExtraction({
    expected: (input.workflow.expected.extracted ?? []).filter((entry) => entry.step === input.stepId),
    script: step ? [step] : [],
    datasets: input.run.extracted,
    actionTypes: input.actionTypes,
    candidateOrder: new Map(),
    durationsByNode: input.run.extractionDurationsByNode,
  });
  const steps = judgement.steps.map((judged) => ({ ...judged, stepIndex, measurement: { ...judged.measurement, stepIndex } }));
  return { ...judgement, steps, measurements: steps.map((judged) => judged.measurement) };
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
