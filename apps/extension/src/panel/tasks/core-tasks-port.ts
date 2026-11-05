// The tasks port over Core's task routes: `list-project-tasks`, `rename-task` and `remove-task`, which read and change
// what each task remembers, and the chat's results port for a task's attempts. Rename and remove touch only the task's
// own memory entry; a Flow, a saved subflow and a result stay. The durable steps (`readSteps`) wait on t870.

import type { ChatResult, ChatResultsPort, TasksPort, TaskSummary } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../shared/protocol";
import { asRecord, payloadOf, refusalOf } from "../chat/transport/reply";
import { extensionLibraryPort } from "../library";
import type { PanelStore } from "../state";
import { readProjectTasks } from "./read-project-tasks";

const GONE = "That task is no longer here.";
const PAGE = 100;
/** The most pages a search reads: Core has no search over a task's words, so a search reads the list and filters it here. */
const SEARCH_PAGES = 10;

function matches(task: TaskSummary, text: string): boolean {
  return `${task.title} ${task.latest.result?.answerText?.text ?? ""}`.toLowerCase().includes(text);
}

/** The tasks port: each read asks Core, so a result that arrived while the panel was closed shows. */
export function createTasksPort(request: PanelStore["request"], results: ChatResultsPort, onRead: (tasks: readonly TaskSummary[]) => void = () => undefined): TasksPort {
  const everyTask = async (projectId: string): Promise<ChatResult<TaskSummary[]>> => {
    const tasks: TaskSummary[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < SEARCH_PAGES; page += 1) {
      const read = await readProjectTasks(request, { projectId, limit: PAGE, ...(cursor === undefined ? {} : { cursor }) });
      if (!read.ok) return read;
      tasks.push(...read.value.tasks);
      if (read.value.nextCursor === null) break;
      cursor = read.value.nextCursor;
    }
    return { ok: true, value: tasks };
  };
  const library = extensionLibraryPort(request);
  const change = async (message: Record<string, unknown> & { type: string }): Promise<ChatResult<unknown>> => {
    const reply = await request(message);
    return refusalOf(reply) ?? { ok: true, value: undefined };
  };
  return {
    list: async ({ projectId, text, limit, cursor }) => {
      const wanted = text?.trim().toLowerCase() ?? "";
      if (wanted === "") {
        const read = await readProjectTasks(request, { projectId, limit, ...(cursor ? { cursor } : {}) });
        if (read.ok) onRead(read.value.tasks);
        return read;
      }
      const all = await everyTask(projectId);
      if (!all.ok) return all;
      onRead(all.value);
      const found = all.value.filter((task) => matches(task, wanted));
      const from = Number.parseInt(cursor ?? "0", 10);
      const start = Number.isFinite(from) && from > 0 ? from : 0;
      const end = start + Math.max(1, limit);
      return { ok: true, value: { tasks: found.slice(start, end), nextCursor: end < found.length ? String(end) : null } };
    },
    read: async ({ projectId, taskId }) => {
      const all = await everyTask(projectId);
      if (!all.ok) return all;
      onRead(all.value);
      const task = all.value.find((item) => item.taskId === taskId);
      if (task === undefined) return { ok: false, sentence: GONE };
      if (task.conversationId === undefined) return { ok: true, value: { task, attempts: [task.latest] } };
      const thread = await results.readThread({ projectId, conversationId: task.conversationId });
      if (!thread.ok) return thread;
      const attempts = thread.value.outcomes.filter((outcome) => outcome.attempt.taskId === taskId).sort((a, b) => b.attempt.startedAtMs - a.attempt.startedAtMs);
      return { ok: true, value: { task, attempts: attempts.length > 0 ? attempts : [task.latest] } };
    },
    carryOn: async ({ projectId, attemptId }) => {
      if (results.addBudgetAndCarryOn === undefined) return { ok: false, sentence: "I can't carry this one on from here.", unsupported: true };
      const carried = await results.addBudgetAndCarryOn({ projectId, attemptId, addUsd: 0 });
      return carried.ok ? { ok: true, value: { attemptId: carried.value.attemptId } } : carried;
    },
    // "Save this" keeps the Flow's one active primary subflow. A Flow with none, or with several, names none: nothing is guessed.
    subflowToKeep: async ({ projectId, flowId }) => {
      const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.listFlowSubflows, projectId, flowId });
      const refused = refusalOf(reply);
      if (refused !== undefined) return refused;
      const payload = payloadOf(reply);
      if (!payload.ok) return payload;
      const primary = (Array.isArray(payload.value.subflows) ? payload.value.subflows : []).flatMap((item) => {
        const subflow = asRecord(item);
        return subflow?.role === "primary" && subflow.status === "active" && typeof subflow.subflowId === "string" && subflow.subflowId !== "" && typeof subflow.name === "string" && subflow.name.trim() !== ""
          ? [{ subflowId: subflow.subflowId, name: subflow.name.trim() }]
          : [];
      });
      return { ok: true, value: primary.length === 1 ? primary[0] : undefined };
    },
    keepSubflow: (query) => library.save!(query),
    rename: ({ projectId, taskId, title }) => change({ type: AUTOMATION_PANEL_MESSAGES.renameTask, projectId, taskId, title }),
    remove: ({ projectId, taskId }) => change({ type: AUTOMATION_PANEL_MESSAGES.removeTask, projectId, taskId })
  };
}
