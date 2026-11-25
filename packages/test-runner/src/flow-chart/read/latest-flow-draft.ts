import path from "node:path";
import type { DraftStep } from "./draft-step.js";
import { listFolder } from "./list-folder.js";
import { readJsonFile } from "./read-json-file.js";
import { userMessageText, type RequestMessages } from "./user-message-json.js";

type DraftEvidence = { context?: { evidenceLoop?: { evidence?: { toolId?: string; value?: { steps?: DraftStep[] } }[] } } };

/**
 * The newest draft of the Flow the run's step files hold: each decision's request carries `core.flow_draft` as the
 * amendments and the save left it, so the newest request is the draft nearest the run's end, and it survives a dead
 * browser. `null` when no decision ever held one.
 */
export async function latestFlowDraft(stepsDirectory: string): Promise<DraftStep[] | null> {
  const folders = (await listFolder(stepsDirectory)).filter((name) => /^\d+-decide$/u.test(name)).sort().reverse();
  for (const folder of folders) {
    const request = await readJsonFile<RequestMessages>(path.join(stepsDirectory, folder, "request.json"));
    const text = request === undefined ? undefined : userMessageText(request);
    // A request whose message is not the JSON object the loop sends holds no draft.
    if (text === undefined || !text.startsWith("{")) continue;
    const draft = (JSON.parse(text) as DraftEvidence).context?.evidenceLoop?.evidence?.find((entry) => entry.toolId === "core.flow_draft");
    if (draft?.value?.steps) return draft.value.steps;
  }
  return null;
}
