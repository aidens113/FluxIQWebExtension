// The capture-snapshot verb: report the page as it is now.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function captureSnapshotAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.success(action, startedAt, "Snapshot captured.", undefined, deps.captureSnapshot());
}
