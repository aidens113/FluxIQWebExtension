import type { ChatResult } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { readRunReplies, type DatasetExport } from "../../../../automations";
import { failureOf, refusalOf } from "../../reply";

/** One dataset's export through the background, read: the file, or word that it is too large to send here. Never throws. */
export async function readExport(request: PanelStore["request"], target: { runId: string; datasetId: string; format: "csv" | "json" }): Promise<ChatResult<DatasetExport>> {
  const result = await request({ type: AUTOMATION_PANEL_MESSAGES.exportDataset, ...target });
  if (!result.ok) {
    return failureOf(result);
  }
  const refused = refusalOf(result);
  if (refused !== undefined) {
    return refused;
  }
  const exported = readRunReplies.export(result.value);
  return exported === undefined ? { ok: false, sentence: "FluxIQ's export of the rows could not be read." } : { ok: true, value: exported };
}
