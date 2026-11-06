// A scripted model's replies per task, and the helpers a script reads real evidence
// with. Test fixtures: they name their task, and nothing in product guidance sees them.
import type { ScriptedModelScript } from "../script.js";
import { COMPANY_WEBSITE_APPRENTICES_SCRIPT } from "./company-website-apprentices.js";
import { CROSSBORDER_MARKETPLACE_FREE_HUBS_UNDER_TEN_SCRIPT } from "./crossborder-marketplace-free-hubs-under-ten.js";
import { EVERYTHING_STORE_DOUBLE_ADD_SCRIPT } from "./everything-store-batteries-and-descaler.js";
import { professionalNetworkAcceptMessagedScript } from "./professional-network-accept-messaged-invitations.js";
import { localClassifiedsSaveDiningTablesScript } from "./local-classifieds-save-dining-tables.js";

export { currentPageOf, evidenceOf, latestOf, pageLine, pressOf, toolCall, type EvidenceEntry } from "./evidence.js";

/** Which form of a task's script to run (`FLUXIQ_ATTEMPT_SCRIPT_FORM`), where it has more than one: `lab attempt` takes no such option, since a live run has no script. */
export const SCRIPTED_MODEL_FORM_ENV = "FLUXIQ_ATTEMPT_SCRIPT_FORM";

const SCRIPTS: Readonly<Record<string, (form?: string) => ScriptedModelScript>> = Object.freeze({
  "company-website-apprentices": () => COMPANY_WEBSITE_APPRENTICES_SCRIPT,
  "crossborder-marketplace-free-hubs-under-ten": () => CROSSBORDER_MARKETPLACE_FREE_HUBS_UNDER_TEN_SCRIPT,
  "everything-store-batteries-and-descaler": () => EVERYTHING_STORE_DOUBLE_ADD_SCRIPT,
  "professional-network-accept-messaged-invitations": professionalNetworkAcceptMessagedScript,
  "local-classifieds-save-dining-tables": localClassifiedsSaveDiningTablesScript,
});

/** The built-in script for a task, or a refusal naming the tasks that have one. A form it does not have is refused by the script. */
export function scriptedModelScriptFor(taskId: string, form?: string): ScriptedModelScript {
  const script = Object.hasOwn(SCRIPTS, taskId) ? SCRIPTS[taskId] : undefined;
  if (!script) throw new Error(`--scripted-model has no script for ${taskId}. Tasks with one: ${Object.keys(SCRIPTS).join(", ")}`);
  return script(form || undefined);
}
