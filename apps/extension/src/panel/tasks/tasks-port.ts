// The one seam the tasks screen reads and changes a person's tasks through. The panel's
// default is this; a spec (or the host) passes its own in `PanelPorts.tasks`.
//
// It answers `undefined` today, so the Automations tab looks as it always did and nothing
// dead shows. What fills it:
//   t869  Core's task records: `list`, `read` and the attempts behind them (the same records
//         the answer turn reads), plus `carryOn` for an attempt a restart cut off, `rename`
//         and `remove`, each through a background message, answered as checked `ChatResult`s.
//   t870  the task memory behind `readSteps` (the durable steps). What was taken from saved steps
//         and what was worked out again arrives on each outcome (`ChatTaskOutcome.provenance`).
// Add budget, Run again and the rows export are the chat's `ChatResultsPort`, which is why this
// answers the two together: a tasks port with no results port does not compile.

import type { PanelTasks } from "../shell";
import type { PanelStore } from "../state";

/** The tasks port over the background's messages, or `undefined` while none exists. */
export function extensionTasksPort(_request: PanelStore["request"]): PanelTasks | undefined {
  return undefined;
}
