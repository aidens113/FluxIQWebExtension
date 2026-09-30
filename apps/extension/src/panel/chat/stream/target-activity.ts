// The live activity that belongs in the chat on screen. No DOM.
//
//   - Work that speaks through another thread (any of its events names a
//     different `conversationId`) belongs to that thread, and never shows in
//     this one, whichever chat this is.
//   - The latest chat shows everything else, as FluxIQ's own chat does.
//   - An automation's chat shows only the work on that automation: events
//     whose subject names its Flow, or that speak through the thread on
//     screen.
//
// The live line follows the paced display only while the unit of work it
// describes is one this chat shows.

import type { ActivityDisplay, ExtensionActivityState } from "../../../shared/activity/index";
import type { ChatTarget } from "../target";

/** The events and the paced display the chat on screen shows. */
export type TargetActivity = { recent: ExtensionActivityState["recent"]; display: ActivityDisplay | null };

/** `state`'s activity for `target`, whose thread on screen is `conversationId` when there is one. */
export function activityForTarget(state: ExtensionActivityState, target: ChatTarget, conversationId: string | undefined): TargetActivity {
  const display = state.display ?? null;
  const elsewhere = new Set(
    conversationId === undefined
      ? []
      : state.recent.filter((event) => event.conversationId !== undefined && event.conversationId !== conversationId).map((event) => event.activityId)
  );
  const recent = state.recent.filter((event) => {
    if (elsewhere.has(event.activityId)) return false;
    if (target.kind === "latest") return true;
    return event.subject.flowId === target.flowId || (conversationId !== undefined && event.conversationId === conversationId);
  });
  if (target.kind === "latest" && elsewhere.size === 0) return { recent, display };
  const shown = display !== null && recent.some((event) => event.activityId === display.activityId);
  return { recent, display: shown ? display : null };
}
