// The host runtime's memory of the places of its own latest snapshots (t609).
//
// Core hands `inspectStateDiff` the two snapshot refs it was given, and a ref's
// summary is the page as a model reads it: it is returned to a recovery model
// as `core.state_snapshot`, so it may carry neither a selector nor a page's
// worth of opaque tokens. The places (`./snapshot.ts`) are therefore kept here,
// beside the summaries rather than in them, by the `stateRef` Core hands back,
// and only for the last few snapshots: a step's diff reads the snapshot just
// before it and the one just after, and the page the previous step ended on
// (t480). A ref this memory no longer holds -- an old one, one restored from a
// saved run -- has no places, and its diff names none.

import type { WebStateSnapshotPlaces } from "./snapshot";

/** Snapshots remembered: a step's two, the previous step's, and room for retries and a repair's test. */
const REMEMBERED_SNAPSHOTS = 16;

export type WebStatePlacesMemo = {
  keep(stateRef: string, places: WebStateSnapshotPlaces): void;
  of(stateRef: string | undefined): WebStateSnapshotPlaces | undefined;
};

/** A memory of the places of the last `limit` snapshots, oldest forgotten first. */
export function createWebStatePlacesMemo(limit = REMEMBERED_SNAPSHOTS): WebStatePlacesMemo {
  const kept = new Map<string, WebStateSnapshotPlaces>();
  return {
    keep(stateRef, places) {
      kept.delete(stateRef);
      kept.set(stateRef, places);
      for (const oldest of kept.keys()) {
        if (kept.size <= limit) break;
        kept.delete(oldest);
      }
    },
    of: (stateRef) => (stateRef === undefined ? undefined : kept.get(stateRef))
  };
}
