// Core replays nothing after a reconnect, so a session that is ready again may
// have missed changes. One `panelChanges` message naming no conversation tells
// the chat to read everything again.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelChangesMessage } from "../../shared/protocol";

/** The panel message that asks for a full re-read. */
export function resyncChange(at: number): PanelChangesMessage {
  return { type: RUNTIME_MESSAGES.panelChanges, projectId: null, at };
}
