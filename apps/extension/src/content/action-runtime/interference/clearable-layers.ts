// The layers the clearing may press a way out of, in the order it presses them.
//
// One list, read by both the press loop (`press-ways-out.ts`) and the question
// whether a missing target is worth clearing for (`presence.ts`), so what is
// looked for and what is pressed cannot drift. It is every layer over the page
// (`overlays.ts`), less:
//
// - the layer the step works in (`clearing-target.ts`, t401), as before;
// - a layer the run opened and that has not left (`run-opened.ts`, t656): the
//   Flow's own menu, drawer or picker is its state, not interference;
// - for a target that is missing rather than covered, every layer that is not a
//   wall (`page-wall.ts`, t656): a target can be waiting behind a consent wall
//   to be drawn, never behind a header's popover.
//
// Classification (`overlaysAt`, for a refusal's code) and the rate-limit reader
// still see every layer: they describe what is over the page, and the layers
// the run opened are over it.

import type { ClearingTarget } from "./clearing-target";
import { overlaysOverPage } from "./overlays";
import { isPageWall } from "./page-wall";
import { runOpenedLayers } from "./run-opened";

/** Which layers a clearing is for: any in the way of a covered target, or only walls, for a target that is missing. */
export type ClearingScope = "any" | "walls";

/** The layers the clearing may press, less those `spare` and the run hold, and less every non-wall for `walls`. */
export function clearableLayers(spare: Element | ClearingTarget | undefined, scope: ClearingScope): Element[] {
  return overlaysOverPage(undefined, spare).filter((layer) => !runOpenedLayers.has(layer) && (scope === "any" || isPageWall(layer)));
}
