// The activity overlay's entry point: a small status pill on the page FluxIQ
// is automating, saying what FluxIQ is doing now, in a corner where it covers
// nothing the person needs. It draws the background's paced `display`
// (`overlay-view.ts`), in place (`status-pill.ts`), which says how it stays
// out of the page's way.
//
// Two sends can cross: the background answers a new document's readiness at
// once, outside its delivery queue, while a paced send may still be on its
// way. A display older than the one drawn, for the same unit of work, is
// therefore ignored rather than drawn over the newer one.

import type { ActivityContentMessage } from "../../shared/activity";
import { activityOverlayView } from "./overlay-view";
import { StatusPill } from "./status-pill";

/** One overlay per content-script instance; the pill removes any a superseded instance left. */
const pill = new StatusPill();

let drawn: { activityId: string; sequence: number } | undefined;

/** Shows what `message` says, or takes the overlay out of the page when it says nothing is to be shown. */
export function showActivityOverlay(message: ActivityContentMessage): void {
  const display = message.display;
  if (display && drawn?.activityId === display.activityId && display.sequence < drawn.sequence) return;
  drawn = display ? { activityId: display.activityId, sequence: display.sequence } : undefined;
  pill.update(activityOverlayView(display, message.overlay));
}
