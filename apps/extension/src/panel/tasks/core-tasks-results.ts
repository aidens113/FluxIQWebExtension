// The results port the tasks screen is given: the chat's own, with Run again answered from the tasks
// list. The chat's port can only run again a task it held this session, and the tasks screen reads
// tasks Core kept, so a task read from a list is run again through the Flow its attempts name.

import type { ChatResult, ChatResultsPort, TaskSummary } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../shared/protocol";
import { readRunReplies } from "../automations";
import { refusalOf } from "../chat/transport/reply";
import type { PanelStore } from "../state";

/** The chat's results port with Run again over the Flows the listed tasks name; `noteTasks` is told each list as it is read. */
export function createTasksResults(request: PanelStore["request"], base: ChatResultsPort): { results: ChatResultsPort; noteTasks: (tasks: readonly TaskSummary[]) => void } {
  const flows = new Map<string, string>();
  const key = (projectId: string, taskId: string): string => `${projectId}\n${taskId}`;
  const results: ChatResultsPort = {
    ...base,
    runAgain: async ({ projectId, taskId }): Promise<ChatResult<{ attemptId: string }>> => {
      const flowId = flows.get(key(projectId, taskId));
      if (flowId === undefined) return base.runAgain({ projectId, taskId });
      const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId });
      const refused = refusalOf(reply);
      if (refused !== undefined) return refused;
      const started = readRunReplies.run(reply.ok ? reply.value : undefined);
      return started === undefined
        ? { ok: false, sentence: "FluxIQ's answer to starting the run could not be read." }
        : { ok: true, value: { attemptId: `attempt-${started.run.runId}` } };
    }
  };
  return {
    results,
    noteTasks: (tasks) => {
      for (const task of tasks) if (task.flowId !== undefined) flows.set(key(task.projectId, task.taskId), task.flowId);
    }
  };
}
