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
// It may wait for the page to draw that list, which is why the verb is async;
// a snapshot that was not asked to detect waits for nothing and is unchanged.

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

export async function captureSnapshotAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  // The detection first, because it may wait for the page to draw its list,
  // and the snapshot beside it has to be the page the detection answered for.
  const structure = action.detectStructure === undefined ? undefined : await deps.detectStructure(action.detectStructure, action.timeoutMs);
  const snapshot = deps.captureSnapshot();
  return deps.success(action, startedAt, "Snapshot captured.", { status: "none", reason: "evidence-only" }, { snapshot, structure });
}
