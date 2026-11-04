// The person's tasks in the Automations tab: the package's screen over a port. `tasks-port.ts`
// is the one named seam the background's task records fill; `task-memory.ts` keeps which task
// is open in `chrome.storage`; `create-tasks-panel.ts` mounts the screen for the shell.
export { createTasksPanel, type TasksPanelHost } from "./create-tasks-panel";
export { extensionTasksMemory, OPEN_TASK_KEY } from "./task-memory";
export { extensionTasksPort } from "./tasks-port";
