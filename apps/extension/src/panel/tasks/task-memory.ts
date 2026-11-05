// Which task is open, kept in `chrome.storage.local` so a Firefox popup that closed (it does
// whenever focus leaves it) opens on the same task. Storage stays here: the screen only knows
// the `TasksMemory` it is given. A storage that will not answer reads as nothing open, and a
// write that fails is dropped, because the memory is a convenience and never state to trust.

import type { TasksMemory } from "@fluxiq/ui-components";

/** The storage key; one open task per browser profile. */
export const OPEN_TASK_KEY = "fluxiq.panel.openTask";

type Open = { projectId: string; taskId: string };

function stored(value: unknown): Open | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { projectId, taskId } = value as Record<string, unknown>;
  return typeof projectId === "string" && typeof taskId === "string" && projectId !== "" && taskId !== "" ? { projectId, taskId } : undefined;
}

/** The memory over `chrome.storage.local`. */
export function extensionTasksMemory(): TasksMemory {
  return {
    read: () => new Promise<Open | undefined>((resolve) => {
      try {
        chrome.storage.local.get(OPEN_TASK_KEY, (items) => resolve(chrome.runtime.lastError ? undefined : stored(items?.[OPEN_TASK_KEY])));
      } catch {
        resolve(undefined);
      }
    }),
    write: (open) => new Promise<void>((resolve) => {
      try {
        const done = (): void => resolve();
        chrome.storage.local.set({ [OPEN_TASK_KEY]: open ?? null }, done);
      } catch {
        resolve();
      }
    })
  };
}
