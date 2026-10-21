// A run's stored rows judged by the task's own oracle: the live task's
// expected dataset (`expected.extracted` of the step its `expectedDatasetId`
// names, in the scenario manifest Scenario Lab builds), compared by the very
// judgement a created Flow's Lab run is judged by (`judgeCreatedFlowDataset`,
// `createdFlowDatasetHolds`). Nothing here re-implements a comparison.
//
// The judgement counts the Flow's read nodes from the nodes that wrote each
// dataset. A trial that stopped before its read stored anything names none, so
// the caller may state the candidate's read count (`extractNodes`,
// `./script-extract-nodes.ts`) and each read no dataset names is counted under
// a placeholder: a count, never a node of the run.
//
// What comes back is counts and the first failed assertion's message, which
// names steps, counts and field names. Its details, which can hold a record's
// values, are never read.

import { assertCreatedFlowDataset, judgeCreatedFlowDataset, type FlowRunDataset, type PersistedFlowRunOutcome } from "../../flow-lane/index.js";
import { RunnerFailure } from "../../failure.js";
import type { OracleExpectation, OracleTask } from "./oracle-expectation.js";
import type { OracleVerdict } from "../types.js";

/** The extract node's action, which tells the judgement a dataset's node is a read (`judgeFlowExtraction`'s `actionTypes`). */
const EXTRACT_ACTION = "web.dom.extract_list";

export function judgeTrialDatasets(task: Pick<OracleTask, "scenarioOrigin">, oracle: OracleExpectation, runId: string, datasets: readonly FlowRunDataset[], extractNodes?: number | null): OracleVerdict {
  const { workflow, stepId } = oracle;
  const run: PersistedFlowRunOutcome = {
    runId, status: "unknown", actions: [], failure: null, harnessActivations: 0, resultVerification: "unverified",
    harnessRecovery: { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] },
    extracted: [...datasets], extractedNonStringValues: datasets.reduce((sum, dataset) => sum + dataset.nonStringValues, 0),
    extractionDurationsByNode: new Map(), route: null,
  };
  const actionTypes = new Map<string, string>(datasets.flatMap((dataset) => dataset.nodeIds.map((nodeId) => [nodeId, EXTRACT_ACTION] as const)));
  for (let read = actionTypes.size; read < (extractNodes ?? 0); read += 1) actionTypes.set(`unstored-read.${read + 1}`, EXTRACT_ACTION);
  const judgement = judgeCreatedFlowDataset({ workflow, stepId, run, actionTypes, scenarioOrigin: task.scenarioOrigin });
  let failure: OracleVerdict["failure"] = null;
  try {
    assertCreatedFlowDataset(judgement);
  } catch (error) {
    if (!(error instanceof RunnerFailure)) throw error;
    failure = Object.freeze({ category: error.category, message: error.message });
  }
  const measurement = judgement.steps[0]?.measurement;
  return Object.freeze({
    runId, passed: failure === null, datasets: datasets.length,
    storedRecords: datasets.reduce((sum, dataset) => sum + dataset.records.length, 0),
    expectedRecords: measurement?.expectedRecords ?? 0,
    matchedRecords: measurement?.matchedRecords ?? 0,
    matchedInAnyOrder: measurement?.matchedInAnyOrder ?? 0,
    expectedFields: measurement?.expectedFields ?? 0,
    presentFields: measurement?.presentFields ?? 0,
    failure,
  });
}
