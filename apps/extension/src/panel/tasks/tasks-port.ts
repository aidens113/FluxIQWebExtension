// The one seam the tasks screen reads a person's tasks through. The panel's default is this; a spec
// (or the host) passes its own in `PanelPorts.tasks`.
//
// Core keeps a task's attempts per conversation (`taskOutcomes` reads by conversation or by attempt)
// and offers no list of tasks, so `createTasksPort` lists the project's conversations and reads each
// one's attempts. Missing routes, named so they can be added: a list of tasks across conversations,
// rename a task and remove a task. Without them the screen draws no rename or remove, and the list
// holds the newest 100 conversations. The durable steps (`readSteps`) wait on t870's task memory.
// Add budget, Run again and the rows export are the chat's results port.

import type { ChatDownload } from "@fluxiq/ui-components";
import { downloadFile } from "../automations";
import { listenToRuntime } from "../chat";
import { resultsPort, type RuntimeListen } from "../chat/transport/ports";
import type { PanelTasks } from "../shell";
import type { PanelStore } from "../state";
import { createTasksPort } from "./core-tasks-port";
import { createTasksResults } from "./core-tasks-results";

/** The tasks port over the background's messages. `listen` and `download` are the test seams for the runtime's pushes and for saving a file. */
export function extensionTasksPort(request: PanelStore["request"], listen: RuntimeListen = listenToRuntime, download: ChatDownload = downloadFile): PanelTasks {
  const { results, noteTasks } = createTasksResults(request, resultsPort(request, listen, download));
  return { port: createTasksPort(request, results, noteTasks), results };
}
