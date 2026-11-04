// A scripted model's replies per task, and the helpers a script reads real evidence
// with. Test fixtures: they name their task, and nothing in product guidance sees them.
import type { ScriptedModelScript } from "../script.js";
import { COMPANY_WEBSITE_APPRENTICES_SCRIPT } from "./company-website-apprentices.js";

export { currentPageOf, evidenceOf, latestOf, pageLine, pressOf, toolCall, type EvidenceEntry } from "./evidence.js";

const SCRIPTS: readonly ScriptedModelScript[] = [COMPANY_WEBSITE_APPRENTICES_SCRIPT];

/** The built-in script for a task, or a refusal naming the tasks that have one. */
export function scriptedModelScriptFor(taskId: string): ScriptedModelScript {
  const script = SCRIPTS.find((candidate) => candidate.taskId === taskId);
  if (!script) throw new Error(`--scripted-model has no script for ${taskId}. Tasks with one: ${SCRIPTS.map((candidate) => candidate.taskId).join(", ")}`);
  return script;
}
