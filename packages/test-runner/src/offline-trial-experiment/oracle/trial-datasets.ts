// A trial run's stored rows, read from a copied project store through Core's
// own dataset store (`AutomationStudioProjectRunDatasetStore`) and shaped by
// the Lab's own reader (`flow-lane/run-datasets.ts`), so the rows judged here
// are the rows a Lab judgement reads: the answer Core serves, every schema
// field present, `null` restored where a row lacks one.
//
// The reader asks for pages by Core's endpoint name; this answers that one
// endpoint from the store instead of an HTTP Core. Point it at a copy.

import { WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/node";
import { AutomationStudioProjectDatabasePool, AutomationStudioProjectRunDatasetStore } from "fluxiq/automation-studio";
import { readRunDatasets, runDatasetSummaries, type FlowRunDataset, type RunDatasetControl } from "../../flow-lane/index.js";

const PAGE_ENDPOINT = "get-run-dataset-page";

export async function readTrialDatasets(input: { automationDataDir: string; projectId: string; runId: string }): Promise<FlowRunDataset[]> {
  const pool = new AutomationStudioProjectDatabasePool({ rootDir: input.automationDataDir });
  try {
    const store = await AutomationStudioProjectRunDatasetStore.open({ pool, projectId: input.projectId });
    try {
      const control: RunDatasetControl = {
        async automationStudioCall(endpoint, payload) {
          if (endpoint !== PAGE_ENDPOINT) throw new Error(`The offline dataset reader answers only ${PAGE_ENDPOINT}, not ${endpoint}`);
          return { dataset: await store.getPage({ runId: payload.runId as string, datasetId: payload.datasetId as string, limit: payload.limit, cursor: payload.cursor }) };
        },
      };
      const summaries = runDatasetSummaries({ datasets: await store.listDatasets(input.runId) });
      return await readRunDatasets(control, { projectId: input.projectId, runId: input.runId, domainId: WEB_AUTOMATION_DOMAIN_ID, summaries });
    } finally {
      await store.close();
    }
  } finally {
    await pool.closeAll();
  }
}
