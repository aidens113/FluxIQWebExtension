// Whether FluxIQ is working right now, before any holding: the raw input to
// `working-hold.ts`, which the record, extract and Run controls wait on.
//
// The paced activity display (`ExtensionActivityState.display`, the one the
// overlay and the chat show) is the authority while the relay is live: the
// background already paces it, and a build keeps it working from start to
// finish. `status.runtime.state` is only the fallback for a build with no
// relay or a Core that does not stream activity, because it flips to running
// for every internal page read and back, many times during one build.

import type { ExtensionStatus } from "../../shared/protocol";
import type { ActivityFeedSnapshot } from "../chat";

/** FluxIQ is working, by the paced display when there is one, else by the runtime. */
export function workingInput(status: ExtensionStatus | undefined, feed: ActivityFeedSnapshot | undefined): boolean {
  if (feed?.reach === "ready" && feed.state.live) return feed.state.display?.working === true;
  return status?.runtime?.state === "running";
}
