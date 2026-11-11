import type { ChatResult, ChatTaskRef } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { asRecord, payloadOf, refusalOf } from "../../reply";

const PAGE = 100;
const GONE = "That task is no longer here.";
const UNREADABLE = "FluxIQ's list of your tasks could not be read.";

/**
 * One task's own humanness, from its row in Core's `list-project-tasks`
 * (`listTasks`), which carries `humanness` when the task has a level of its
 * own. Core has no read of one task, so the list is read a page at a time,
 * newest first, until the task is found or the list ends; a task the chat just
 * ran is on the first page. A task not listed is a failed read.
 */
export async function readTaskHumanness(request: PanelStore["request"], task: ChatTaskRef): Promise<ChatResult<{ humanness?: number }>> {
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.listTasks, projectId: task.projectId, limit: PAGE, cursor });
    const refused = refusalOf(reply);
    if (refused !== undefined) return refused;
    const payload = payloadOf(reply);
    if (!payload.ok) return payload;
    const rows = payload.value.tasks;
    if (!Array.isArray(rows)) return { ok: false, sentence: UNREADABLE };
    const row = rows.map(asRecord).find((candidate) => candidate?.taskId === task.taskId);
    if (row !== undefined) {
      const level = row.humanness;
      return { ok: true, value: typeof level === "number" && Number.isFinite(level) ? { humanness: level } : {} };
    }
    const next = payload.value.nextCursor;
    // The list ends with no cursor; a cursor already followed would only read the same pages again.
    if (typeof next !== "string" || next === "" || seen.has(next)) return { ok: false, sentence: GONE };
    seen.add(next);
    cursor = next;
  }
}
