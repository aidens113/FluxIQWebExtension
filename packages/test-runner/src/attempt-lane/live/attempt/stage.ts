import type { AttemptStandIn } from "@fluxiq-web-extension/test-contracts";
import { LAB_PROJECT_DOMAIN_ID, lastingViewOf, readRunDatasets, readSiteState, type ChatAnswerPort, type CreatedFlowAnswerStage, type CreatedFlowDatasetSource, type RunDatasetControl, type SiteBaseline } from "../../../flow-lane/index.js";
import type { AttemptResultRecord } from "./read.js";

/**
 * The attempt's stored rows, from the dataset its record names and the store's own
 * pages: never a candidate's trial and never the record's preview. An attempt that
 * stored none reads as none.
 */
export async function readAttemptRows(control: RunDatasetControl, projectId: string, result: AttemptResultRecord | undefined): Promise<CreatedFlowDatasetSource | null> {
  const rows = result?.rows;
  if (!rows) return null;
  const summaries = [{ datasetId: rows.datasetId, nodeIds: [], recordCount: rows.totalRows, storeTruncated: rows.truncated, invalidCount: 0 }];
  const extracted = await readRunDatasets(control, { projectId, runId: rows.runId, domainId: LAB_PROJECT_DOMAIN_ID, summaries });
  return { extracted, actions: [], extractionDurationsByNode: new Map() };
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
