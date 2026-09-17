// The capture-snapshot verb: report the page as it is now.
//
// It observes and changes nothing, so it has no post-condition to check: its
// validation is `evidence-only`, which is a statement about the verb rather
// than an unfilled gap.
//
// Asked with `detectStructure`, it also answers which repeating structure is
// there (`extraction/detect-structure.ts`). That is still only reading: the
// inference measures the page and changes nothing, so the verb stays
// observe-only and a Flow's snapshot, which never sends the flag, is unchanged.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export function captureSnapshotAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): BrowserActionResult {
  const snapshot = deps.captureSnapshot();
  const structure = action.detectStructure === undefined ? undefined : deps.detectStructure(action.detectStructure);
  return deps.success(action, startedAt, "Snapshot captured.", { status: "none", reason: "evidence-only" }, { snapshot, structure });
}
