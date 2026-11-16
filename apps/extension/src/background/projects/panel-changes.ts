// What Core's gateway pushes that the panel can act on: `server.activity`
// carries the project and, when the work speaks through one, the conversation
// it belongs to. Each push becomes one `panelChanges` message to the panel,
// so the panel reads again when something changed instead of on a timer.

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { PanelChangesMessage } from "../../shared/protocol";

/** The panel message for one activity payload, or undefined when it names neither a project nor a conversation. */
export function panelChangesFor(activity: unknown, at: number): PanelChangesMessage | undefined {
  if (!activity || typeof activity !== "object") return undefined;
  const { subject, conversationId } = activity as { subject?: { projectId?: unknown } | null; conversationId?: unknown };
  const projectId = typeof subject?.projectId === "string" && subject.projectId ? subject.projectId : null;
  const conversation = typeof conversationId === "string" && conversationId ? conversationId : undefined;
  if (projectId === null && conversation === undefined) return undefined;
  return { type: RUNTIME_MESSAGES.panelChanges, projectId, ...(conversation ? { conversationIds: [conversation] } : {}), at };
}
