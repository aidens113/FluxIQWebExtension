import type { TaskSummary } from "@fluxiq/ui-components";
import { asRecord } from "../chat/transport/reply";
import { readTaskOutcome } from "../chat/transport/ports/results";

/**
 * One task of Core's `list-project-tasks` as the tasks screen's summary, or nothing when it is not what the contract
 * says or is not of the project asked about: the latest attempt is read through the contract's own parsers, as the
 * chat reads one. `title` is the person's name for it, else its Flow's, else empty (the screen says "Untitled task").
 */
export function projectTaskOf(value: unknown, projectId: string): TaskSummary | undefined {
  const task = asRecord(value);
  const latest = readTaskOutcome(task?.latest);
  if (task === undefined || latest === undefined || latest.attempt.projectId !== projectId) return undefined;
  if (typeof task.taskId !== "string" || task.taskId === "" || task.taskId !== latest.attempt.taskId) return undefined;
  const flowId = typeof task.flowId === "string" && task.flowId !== "" ? task.flowId : undefined;
  const conversationId = typeof task.conversationId === "string" && task.conversationId !== "" ? task.conversationId : undefined;
  return {
    taskId: task.taskId,
    projectId,
    title: typeof task.title === "string" ? task.title.trim() : "",
    ...(conversationId === undefined ? {} : { conversationId }),
    ...(flowId === undefined ? {} : { flowId }),
    latest,
    attemptCount: typeof task.attemptCount === "number" && task.attemptCount > 0 ? task.attemptCount : 1,
    updatedAtMs: latest.attempt.endedAtMs ?? latest.attempt.startedAtMs
  };
}
