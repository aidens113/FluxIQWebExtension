// The look -- `web.dom.capture_snapshot` addressed to no frame -- takes in every
// frame of the tab, not the top frame alone (t200).
//
// A robot check is an iframe, and so is many a consent wall, a payment step and
// a sign-in widget. The look used to run in the top frame only, so everything
// inside a child frame was absent from every packet a model was given, and the
// model tried to act on a page whose blocking layer it had never been shown.
// The recording path has merged every frame since Phase 1.2
// (`background/connection/dom-snapshot.ts`); the look now takes the same
// merged snapshot, so a child frame's elements arrive addressed exactly as a
// recorded one's are: `frame[<id>] >> <selector>`, with `data-fluxiq-frame-id`
// among its attributes.
//
// The top frame's own capture is the seed of the merge, so it is not taken
// twice. A look addressed to one frame -- by id or by its document's path --
// still describes that frame alone: whoever addressed it asked for that.
//
// A look asked with `includeHidden` (a search's, t223) asks every frame the
// same: the top frame's capture already carries the option, since the action
// reached it whole, and the merge passes it to each child frame it asks.
//
// The merge itself is the background worker's, and is handed in
// (`BrowserActionRunRequest.mergeFrameSnapshots`) rather than imported: the
// connection module imports this runtime, and importing it back would close a
// cycle.

import type { BrowserActionCommand, DomSnapshot } from "../shared/protocol";
import { snapshotCaptureOptionsFor, type SnapshotCaptureOptions } from "../shared/snapshot-capture-options";
import type { BrowserActionRunResult } from "./action-runner";

/** The background worker's frame merge, seeded with the top frame's snapshot; `undefined` when it could not merge. */
export type MergeFrameSnapshots = (
  tabId: number,
  topSnapshot: DomSnapshot,
  waitMs: number | undefined,
  capture: SnapshotCaptureOptions
) => Promise<DomSnapshot | undefined>;

/**
 * `run` with its snapshot replaced by every frame's, when it is a look that
 * named no frame and succeeded; `run` itself otherwise. A merge that fails
 * leaves the top frame's snapshot standing, which is what the look was before.
 *
 * An action carrying its own deadline (`timeoutMs`) lends the merge what is
 * left of it, so the look still answers inside the time its sender waits.
 */
export async function lookAcrossFrames(
  action: BrowserActionCommand,
  run: BrowserActionRunResult,
  addressed: boolean,
  startedAt: number,
  merge: MergeFrameSnapshots | undefined
): Promise<BrowserActionRunResult> {
  if (action.actionType !== "web.dom.capture_snapshot" || addressed || merge === undefined) return run;
  const topSnapshot = run.result.snapshot;
  if (run.result.status !== "succeeded" || topSnapshot === undefined || run.tabId === undefined) return run;
  const merged = await merge(run.tabId, topSnapshot, remainingWaitMs(action, startedAt), snapshotCaptureOptionsFor(action));
  return merged ? { ...run, result: { ...run.result, snapshot: merged } } : run;
}

/** What is left of the action's own deadline, or `undefined` when it set none and the merge's own wait applies. */
function remainingWaitMs(action: BrowserActionCommand, startedAt: number): number | undefined {
  const timeoutMs = action.timeoutMs;
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined;
  return Math.max(0, timeoutMs - (Date.now() - startedAt));
}
