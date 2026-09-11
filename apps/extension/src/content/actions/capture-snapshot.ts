// The capture-snapshot verb: report the page as it is now.
//
// It observes and changes nothing, so it has no post-condition to check: its
// validation is `evidence-only`, which is a statement about the verb rather
// than an unfilled gap.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function captureSnapshotAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  return deps.success(action, startedAt, "Snapshot captured.", { status: "none", reason: "evidence-only" }, {
    snapshot: deps.captureSnapshot()
  });
}
