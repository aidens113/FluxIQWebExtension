// The seams between the shell and the screens it hosts. There is one UI: a
// top bar, and under it exactly one screen at a time (see `screen-state.ts`).

import type { ChatResultsPort, SubflowLibraryPort, TasksMemory, TasksPort } from "@fluxiq/ui-components";
import type { SetupPort } from "../getting-started";
import type { PanelStore } from "../state";

/** Which browser surface mounted the panel. */
export type PanelSurface = "popup" | "sidepanel";

/** What every screen is given when it is built: the one status store, and the surface. */
export type PanelContext = { readonly store: PanelStore; readonly surface: PanelSurface };

/**
 * What the screens read and do through a port rather than the background's messages today. Each field
 * is optional: a screen whose port is absent shows nothing of it. `mountPanel`'s default comes from
 * the one named seam of each (`panel/getting-started`, `panel/tasks`, `panel/library`); a spec passes fakes.
 */
export type PanelPorts = {
  /** Reads the model key for the setup card; the default reads the background's model readiness (`extensionSetupPort`). */
  readonly setup?: SetupPort;
  /** Reads and changes the person's tasks; the default is `extensionTasksPort`, which has none yet, so the tab shows no tasks. */
  readonly tasks?: TasksPort;
  /** The subflow library; the default is `extensionLibraryPort`, absent until its messages land, so the tab shows no Library. */
  readonly library?: SubflowLibraryPort;
  /** Add budget, Run again and the rows export of a task's answer; absent, those are not offered. */
  readonly results?: ChatResultsPort;
  /** Which task is open, so a panel that closed reopens on it; the default keeps it in `chrome.storage.local`. */
  readonly taskMemory?: TasksMemory;
};
