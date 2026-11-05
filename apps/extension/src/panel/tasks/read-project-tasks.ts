import type { ChatResult, TaskSummary } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../shared/protocol";
import { payloadOf, refusalOf } from "../chat/transport/reply";
import type { PanelStore } from "../state";
import { projectTaskOf } from "./project-task-of";

const UNREADABLE = "FluxIQ's list of your tasks could not be read.";

/** One page of the project's tasks, newest first, through Core's `list-project-tasks`. A task that does not read fails the page, so a list is never quietly partial. */
export async function readProjectTasks(request: PanelStore["request"], query: { projectId: string; limit: number; cursor?: string }): Promise<ChatResult<{ tasks: TaskSummary[]; nextCursor: string | null }>> {
  const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.listTasks, projectId: query.projectId, limit: query.limit, ...(query.cursor ? { cursor: query.cursor } : {}) });
  const refused = refusalOf(reply);
  if (refused !== undefined) return refused;
  const payload = payloadOf(reply);
  if (!payload.ok) return payload;
  const listed = payload.value.tasks;
  if (!Array.isArray(listed)) return { ok: false, sentence: UNREADABLE };
  const tasks: TaskSummary[] = [];
  for (const value of listed) {
    const task = projectTaskOf(value, query.projectId);
    if (task === undefined) return { ok: false, sentence: UNREADABLE };
    tasks.push(task);
  }
  const next = payload.value.nextCursor;
  return { ok: true, value: { tasks, nextCursor: typeof next === "string" && next !== "" ? next : null } };
}
