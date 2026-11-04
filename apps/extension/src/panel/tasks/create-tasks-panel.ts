// The tasks screen as the panel mounts it: the package's screen over the tasks port. The port
// is `PanelPorts.tasks` or the build's own (`extensionTasksPort`); with neither there are no
// tasks to show and the caller shows none. Open in chat goes through the shell, and a task
// that was open when the panel closed brings the Automations tab forward when it reopens.

import { createTasksScreen, type TasksScreen } from "@fluxiq/ui-components";
import "@fluxiq/ui-components/styles/tasks.css";
import type { ChatTarget } from "../chat";
import type { PanelContext, PanelPorts } from "../shell";
import { extensionTasksMemory } from "./task-memory";
import { extensionTasksPort } from "./tasks-port";

/** What the shell does for the tasks screen. */
export type TasksPanelHost = {
  /** Opens `target` in the chat. */
  openInChat(target: ChatTarget): void;
  /** Shows the Chat tab. */
  showChat(): void;
  /** Shows the Automations tab. */
  showAutomations(): void;
};

/** The tasks screen, or `undefined` when this build has no tasks to read. */
export function createTasksPanel(context: PanelContext, ports: PanelPorts, host: TasksPanelHost): TasksScreen | undefined {
  const port = ports.tasks ?? extensionTasksPort(context.store.request);
  if (port === undefined) return undefined;
  return createTasksScreen({
    port,
    ...(ports.results === undefined ? {} : { results: ports.results }),
    memory: ports.taskMemory ?? extensionTasksMemory(),
    projectId: () => {
      const projectId = context.store.current()?.projectId;
      return typeof projectId === "string" && projectId !== "" ? projectId : undefined;
    },
    onOpenInChat: (task) => {
      if (task.conversationId === undefined) return;
      host.openInChat({ kind: "thread", conversationId: task.conversationId, projectId: task.projectId });
      host.showChat();
    },
    onRestored: host.showAutomations
  });
}
