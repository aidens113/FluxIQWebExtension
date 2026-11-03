// The chat's live-activity feed over the extension's background: the package's
// feed (`@fluxiq/ui-components`) built from `request` and the runtime's broadcast.
export type { ActivityFeed, ActivityFeedReach, ActivityFeedSnapshot } from "@fluxiq/ui-components";
export { threadRefreshWanted } from "@fluxiq/ui-components";
export { createActivityFeed, type ExtensionActivityFeedDeps } from "./activity-feed";
export { listenToRuntime } from "./runtime-listener";
