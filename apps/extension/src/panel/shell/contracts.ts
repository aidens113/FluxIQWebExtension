// The seams between the shell and the views it hosts, verbatim from the UI
// audit, section 5 ("Contracts pinned by this spec"). Workstreams B (simple
// view) and C (Advanced view) build against these, so a change here is a
// change to their briefs.

import type { PanelStore } from "../state";

/** The Advanced view's tabs, in display order. */
export type AdvancedTab = "activity" | "recordings" | "step" | "connection";

/** Where the panel is: the simple view, or one Advanced tab. */
export type PanelRoute = { mode: "simple" } | { mode: "advanced"; tab: AdvancedTab };

/** Which browser surface mounted the panel. */
export type PanelSurface = "popup" | "sidepanel";

/** A mounted view: its root element, shown for a route and hidden otherwise. */
export type PanelView = { readonly element: HTMLElement; show(route: PanelRoute): void; hide(): void };

/** What every view is given when it is mounted. */
export type PanelViewContext = { store: PanelStore; navigate(route: PanelRoute): void; surface: PanelSurface };

/** The two views a surface mounts. */
export type PanelViews = { simple(context: PanelViewContext): PanelView; advanced(context: PanelViewContext): PanelView };

/** Every Advanced tab, for validating a stored or requested tab. */
export const ADVANCED_TABS: readonly AdvancedTab[] = ["activity", "recordings", "step", "connection"];
