// The seams between the shell and the screens it hosts. There is one UI: a
// top bar, and under it exactly one screen at a time (see `screen-state.ts`).

import type { PanelStore } from "../state";

/** Which browser surface mounted the panel. */
export type PanelSurface = "popup" | "sidepanel";

/** What every screen is given when it is built: the one status store, and the surface. */
export type PanelContext = { readonly store: PanelStore; readonly surface: PanelSurface };
