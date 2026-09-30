// Whether a layer the defence could clear stands over the page right now.
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
// only when it answers yes: a painted modal, or a layer the probes find
// (`overlays.ts`), that carries a way out the defence may press
// (`pressable-way-out.ts`). A challenge never counts, so a robot check over the
// page is never pressed at on a missing target any more than on a covered one,
// and a page with nothing over it is waited at exactly as before.
//
// It never throws, for the reason `clear.ts` gives: it runs inside the
// defence, and in a Node test, where there is no document, it answers no.

import { overlaysOverPage } from "./overlays";
import { pressableWayOut } from "./pressable-way-out";

/** Whether any layer over the page carries a way out the defence may press. */
export function clearableLayerOverPage(): boolean {
  try {
    return overlaysOverPage().some((overlay) => pressableWayOut(overlay) !== undefined);
  } catch {
    return false;
  }
}
