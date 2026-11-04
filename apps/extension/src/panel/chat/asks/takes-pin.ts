// The one question that takes a PIN: a `panel-command.` confirmation naming a
// class that moves money, deletes or sends. It mirrors Core's own decision
// (`runtime/conversations/panel-command-pin.ts`), which the extension cannot
// import. A permission ask, and any question a task waits on, never takes one,
// whatever class it names (user, 2026-11-03: "NO PIN FOR ANY NORMAL ACTIONS").

import { AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES } from "fluxiq/automation/action-permissions";
import type { AskRecord } from "./ask-record";

const PANEL_COMMAND_ASK_PREFIX = "panel-command.";

/** Whether a yes to `ask` needs the person's PIN. */
export function askTakesPin(ask: Pick<AskRecord, "askId" | "commits">): boolean {
  if (!ask.askId.startsWith(PANEL_COMMAND_ASK_PREFIX)) return false;
  return ask.commits.some((consequence) => (AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES as readonly string[]).includes(consequence));
}
