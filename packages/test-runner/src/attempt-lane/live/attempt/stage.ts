import type { AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { LAB_PROJECT_DOMAIN_ID, lastingViewOf, readRunDatasets, readSiteState, type ChatAnswerPort, type CreatedFlowAnswerStage, type CreatedFlowDatasetSource, type RunDatasetControl, type SiteBaseline } from "../../../flow-lane/index.js";
import type { AttemptResultRecord } from "./read.js";

/**
 * The attempt's stored rows, from the dataset its record names and the store's own
 * pages: never a candidate's trial and never the record's preview. An attempt that
 * stored none reads as none.
 *
 * The count the pages are held to is the record's `totalRows`, not a summary of the
 * store's, so a disagreement is the attempt's result against its own dataset and is
 * named so: run-mw43h5ew-a04a583d's said "Core stored 4" when 4 was the result's word
 * and the store held 28 collected rows it had not yet processed.
 */
export async function readAttemptRows(control: RunDatasetControl, projectId: string, result: AttemptResultRecord | undefined): Promise<CreatedFlowDatasetSource | null> {
  const rows = result?.rows;
  if (!rows) return null;
  const summaries = [{ datasetId: rows.datasetId, nodeIds: [], recordCount: rows.totalRows, storeTruncated: rows.truncated, invalidCount: 0 }];
  try {
    const extracted = await readRunDatasets(control, { projectId, runId: rows.runId, domainId: LAB_PROJECT_DOMAIN_ID, summaries });
    return { extracted, actions: [], extractionDurationsByNode: new Map() };
  } catch (error) {
    if (!(error instanceof RunnerFailure) || typeof error.details?.readRecords !== "number") throw error;
    throw new RunnerFailure("runtime.behavior", `The attempt's result says its dataset holds ${rows.totalRows} row(s), and Core's dataset served ${error.details.readRecords}`, {
      cause: error,
      details: { ...error.details, countFrom: "attempt_result", attemptId: result.attemptId, datasetId: rows.datasetId },
    });
  }
}

/** Where an attempt's score is read from: the real rows, the real site through its control, and the real chat. */
export function liveAttemptStage(input: {
  control: RunDatasetControl;
  projectId: string;
  scenarioId: string;
  scenarioOrigin: string;
  runToken: string;
  baseline: SiteBaseline;
  result: AttemptResultRecord | undefined;
  chat: ChatAnswerPort;
  standIns: readonly AttemptStandIn[];
}): CreatedFlowAnswerStage {
  const { scenarioOrigin, runToken, scenarioId } = input;
  return Object.freeze({
    readBaseline: async () => input.baseline,
    readSiteView: async () => lastingViewOf(scenarioId)(await readSiteState(scenarioOrigin, runToken, scenarioId)),
    readStoredRows: async () => readAttemptRows(input.control, input.projectId, input.result),
    chat: input.chat,
    secretValues: [],
    standIns: input.standIns,
  });
}
