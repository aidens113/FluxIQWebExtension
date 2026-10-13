// What a page changes by itself, as one Flow's build has seen it (t496): the
// control names, as the hashes a step's effect is made of, that the page was
// seen changing with nothing done to it. An act's effect leaves them out
// (`../act-effect.ts`, `../../../route-state/effect/sign.ts`), so a banner that
// turns on its own is never kept as what an act did.
//
// **Why.** In `run-mv6eq215-a986f1f3` the build's look before "Set as my store"
// caught a rotating banner on its second slide, and the reload the press caused
// put it back on its first. The first slide's link was kept as an added name
// beside the store chip, and the run that found the store already chosen saw the
// effect only while that slide was up: the step ran three times (13 s) on a page
// that never changed.
//
// **Two captures are compared only when nothing can have come between them.**
// The newest capture the build recorded and the next one, when:
//
//   - nothing was sent to the page since the first (`acting`, which the node run
//     calls before its command goes out and around a replay);
//   - both are of one document: the same location, and the same
//     `navigation.timeOrigin`, which is the browser's own identity of the
//     document. A reload, a navigation, or a trial Core ran from the start puts
//     a new document there, so what an act did on the way is never compared;
//   - both described the whole page: a look the capture cut short, or a
//     one-element capture of a way out, says nothing of what is missing, and
//     ends the chain instead.
//
// **Only a page that put something up by itself is changing by itself.** A pair
// in which some name appeared counts, and then every name it gained or lost is
// the page's own: a banner swaps one slide's link for the next. A pair in which
// names only went away does not count: a notice an act raised ("Added to cart")
// fading out leaves on its own, and the next act that raises it really adds it.
//
// Bounded: the newest `PAGES_PER_FLOW` locations, `NAMES_PER_PAGE` names each.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { webAutomationRouteSelfChanges } from "../../../route-state/effect";

const PAGES_PER_FLOW = 64;
const NAMES_PER_PAGE = 512;
const NONE: ReadonlySet<string> = new Set();

export type WebLlmSelfChangingNames = {
  /** A capture the build recorded, as the newest view of its page. */
  captured(binding: WebLlmSnapshotBinding): void;
  /** Something is about to be done to the page: the newest capture no longer says how it stands. */
  acting(): void;
  /** The names the page at `location` was seen changing by itself. */
  of(location: string): ReadonlySet<string>;
};

type Baseline = { location: string; timeOrigin: number; routeState: NonNullable<WebLlmSnapshotBinding["routeState"]> };

export function createWebLlmSelfChangingNames(): WebLlmSelfChangingNames {
  let baseline: Baseline | undefined;
  const pages = new Map<string, Set<string>>();
  return {
    captured(binding) {
      const next = baselineOf(binding);
      const earlier = baseline;
      baseline = next;
      if (next === undefined || earlier === undefined || earlier.location !== next.location || earlier.timeOrigin !== next.timeOrigin) return;
      const { appeared, disappeared } = webAutomationRouteSelfChanges(earlier.routeState, next.routeState);
      if (appeared.length === 0) return;
      const names = pages.get(next.location) ?? new Set<string>();
      pages.delete(next.location);
      pages.set(next.location, names);
      for (const name of [...appeared, ...disappeared]) {
        names.delete(name);
        names.add(name);
      }
      for (const oldest of names) {
        if (names.size <= NAMES_PER_PAGE) break;
        names.delete(oldest);
      }
      for (const oldest of pages.keys()) {
        if (pages.size <= PAGES_PER_FLOW) break;
        pages.delete(oldest);
      }
    },
    acting() {
      baseline = undefined;
    },
    of(location) {
      return pages.get(location) ?? NONE;
    }
  };
}

/** What a capture can be compared by, or nothing when it cannot be compared (header). */
function baselineOf(binding: WebLlmSnapshotBinding): Baseline | undefined {
  const timeOrigin = binding.evidence.navigation?.timeOrigin;
  if (binding.routeState === undefined || binding.evidence.truncated === true || typeof timeOrigin !== "number") return undefined;
  return { location: binding.evidence.location, timeOrigin, routeState: binding.routeState };
}
