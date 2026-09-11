// The snapshot a message reply carries, taken once this frame knows where it sits.

import { captureSnapshot } from "../dom-snapshot";
import { isTopFrame, requestFrameGeometry } from "../frame-geometry";
import type { DomSnapshot } from "../types";

/** A child frame needs its offset before its bounds mean anything to the caller. */
export async function captureSnapshotForResponse(): Promise<DomSnapshot> {
  if (!isTopFrame()) await requestFrameGeometry();
  return captureSnapshot();
}
