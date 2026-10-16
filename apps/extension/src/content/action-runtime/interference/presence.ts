// Whether a wall the defence could clear stands over the page right now.
//
// **Why this is asked.** A target the page hides behind a wall is reported as
// `target_not_found`, not as covered: the wall is not over the target, the
// target is not there yet, because the page draws it only once the wall is
// answered. Live, company-website's quote Flow died that way on every playback
// (lane t174, runs 22, 26 and 31, row R2): step s2 declines the newsletter
// offer, the offer opens four seconds after consent is answered, and a fresh
// visitor meets the "Your privacy choices" wall first -- so s2 found nothing
// fifteen times while the loop waited at a wall it was never going to clear,
// because it cleared only for a refusal that named an obstruction.
//
// So the recovery asks this before it waits on a missing target, and clears
// only when it answers yes: a layer over the page (`overlays.ts`) that is a
// **wall** -- a painted modal, or a layer on a scrim over the viewport's centre
// (`page-wall.ts`) -- and carries a way out the defence may press
// (`pressable-way-out.ts`). A challenge never counts, so a robot check over the
// page is never pressed at on a missing target any more than on a covered one,
// and a page with nothing over it is waited at exactly as before.
//
// **Only a wall (t656).** Until t656 any layer with a way out counted, and
// bigbox-retail's store picker -- a header popover the Flow's previous step had
// opened -- was closed for an optional step whose promotion was already gone
// (`run-mvac0ddx-f52ba929`). A popover covers a few controls; a target is never
// waiting behind it to be drawn. A layer the run opened is not counted either,
// wall or not (`run-opened.ts`). Both rules live in `clearable-layers.ts`,
// which the press loop reads too, so it presses exactly what this looked for.
//
// It never throws, for the reason `clear.ts` gives: it runs inside the
// defence, and in a Node test, where there is no document, it answers no.

import { clearableLayers } from "./clearable-layers";
import type { ClearingTarget } from "./clearing-target";
import { pressableWayOut } from "./pressable-way-out";

/**
 * Whether a wall over the page carries a way out the defence may press,
 * leaving out a layer that holds `spare`, the action's own target -- an element,
 * or what the step says of it (`clearing-target.ts`) -- and every layer the run
 * opened, as the clearing does (`clear.ts`).
 */
export function clearableLayerOverPage(spare?: Element | ClearingTarget): boolean {
  try {
    return clearableLayers(spare, "walls").some((overlay) => pressableWayOut(overlay) !== undefined);
  } catch {
    return false;
  }
}
