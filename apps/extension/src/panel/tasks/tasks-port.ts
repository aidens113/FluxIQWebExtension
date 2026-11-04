// The one seam the tasks screen reads and changes a person's tasks through. The panel's
// default is this; a spec (or the host) passes its own in `PanelPorts.tasks`.
//
// It answers `undefined` today, so the Automations tab looks as it always did and nothing
// dead shows. What fills it:
//   t869  Core's task records: `list`, `read` and the attempts behind them (the same records
//         the answer turn reads), plus `carryOn` for an attempt a restart cut off, `rename`
//         and `remove`, each through a background message, answered as checked `ChatResult`s.
//   t870  the task memory behind `readSteps` (the durable steps) and `readProvenance`
//         (`taskMemory.provenance`, what was taken from saved steps and what was worked out again).
// Add budget and Run again are the chat's `ChatResultsPort`, passed in `PanelPorts.results`.

import type { TasksPort } from "@fluxiq/ui-components";
import type { PanelStore } from "../state";

/** The tasks port over the background's messages, or `undefined` while none exists. */
export function extensionTasksPort(_request: PanelStore["request"]): TasksPort | undefined {
  return undefined;
}
