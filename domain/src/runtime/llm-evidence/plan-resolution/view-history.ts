// One Flow's view history: every handle any capture of its exploration carried,
// kept after the page it was on moved on (t358).
//
// The packet store (`target-packets.ts`) keeps each page as exploration last
// saw it, which is what exploration's own acts need: a control that left the
// page is not there to press. A candidate submission is a whole Flow written
// afterwards, and its first steps act on pages exploration has since left --
// lane A round 4 (`run-muyrpbnk-fef374e7`) had twelve submissions refused for
// the start page's popup controls, `t478` and `t488`, which the next view of
// that page no longer carried. This keeps, per handle, what every view that
// carried it agrees it names (the store's merge rule, handed in as `across`),
// the newest view that carried it, and that view's number on each page it was
// carried on, so such a handle can still be resolved -- for a submission alone.
//
// A capture counts as one view, numbered from 1 in the order this Flow's
// exploration took them. Bounded: the newest `RETAINED_HANDLES` handles, and
// for each its newest `RETAINED_LOCATIONS` pages.

/** Handles one Flow's history keeps; the one carried longest ago goes first. */
const RETAINED_HANDLES = 8192;
/** Pages one handle remembers being carried on; the oldest goes first. */
const RETAINED_LOCATIONS = 16;

/** The view a handle came from: its number in this Flow's captures, from 1, and the page it showed. */
export type WebLlmTargetView = { view: number; location: string };

export type WebLlmViewHistory<T> = {
  /** One more capture, at `location`: each handle it carries joins the history, or keeps what its views agree on, and becomes the newest kept. */
  record(location: string, targets: ReadonlyMap<string, T>): void;
  /** What the views that carried `handle` agree it names, and the newest of them -- on `location`, when one is named; nothing when none carried it (there). */
  find(handle: string, location: string | undefined): { target: T; shownIn: WebLlmTargetView } | undefined;
};

type Entry<T> = { target: T; view: number; location: string; views: Map<string, number> };

/** A Flow's view history, merging a handle's views with `across` (the earlier view's target, if any, and the newer one). */
export function createWebLlmViewHistory<T>(across: (earlier: T | undefined, target: T) => T): WebLlmViewHistory<T> {
  const entries = new Map<string, Entry<T>>();
  let captures = 0;
  return {
    record(location, targets) {
      captures += 1;
      for (const [handle, target] of targets) {
        const earlier = entries.get(handle);
        const views = earlier?.views ?? new Map<string, number>();
        views.delete(location);
        views.set(location, captures);
        for (const oldest of views.keys()) {
          if (views.size <= RETAINED_LOCATIONS) break;
          views.delete(oldest);
        }
        entries.delete(handle);
        entries.set(handle, { target: across(earlier?.target, target), view: captures, location, views });
      }
      for (const oldest of entries.keys()) {
        if (entries.size <= RETAINED_HANDLES) break;
        entries.delete(oldest);
      }
    },
    find(handle, location) {
      const entry = entries.get(handle);
      if (entry === undefined) return undefined;
      if (location === undefined) return { target: entry.target, shownIn: { view: entry.view, location: entry.location } };
      const view = entry.views.get(location);
      return view === undefined ? undefined : { target: entry.target, shownIn: { view, location } };
    }
  };
}
