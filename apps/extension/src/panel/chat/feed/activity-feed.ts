// The extension's activity feed: the package's feed over the background's
// relay. `request` reads and sets, `listen` hears the runtime's broadcast
// (`runtime-listener.ts` in the panel, a fake in tests).

import { createActivityFeed as createPackageFeed, type ActivityFeed } from "@fluxiq/ui-components";
import type { PanelStore } from "../../state";
import { activityPort, type RuntimeListen } from "../transport/ports";

/** What the feed reaches the background through. */
export type ExtensionActivityFeedDeps = {
  readonly request: PanelStore["request"];
  readonly listen: RuntimeListen;
};

/** Creates the feed. `onChange` is called after every change to `snapshot()`. */
export function createActivityFeed(deps: ExtensionActivityFeedDeps, onChange: () => void): ActivityFeed {
  return createPackageFeed({ activity: activityPort(deps.request, deps.listen) }, onChange);
}
