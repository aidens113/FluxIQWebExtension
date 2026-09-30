// The activity overlay's entry point: a small status pill in the bottom-left
// corner of the page FluxIQ is automating, saying what FluxIQ is doing now.
// It draws the background's paced `display` (`overlay-view.ts`), in place
// (`status-pill.ts`), which says how it stays out of the page's way.

import type { ActivityContentMessage } from "../../shared/activity";
import { activityOverlayView } from "./overlay-view";
import { StatusPill } from "./status-pill";

/** One overlay per content-script instance; the pill removes any a superseded instance left. */
const pill = new StatusPill();

/** Shows what `message` says, or takes the overlay out of the page when it says nothing is to be shown. */
export function showActivityOverlay(message: ActivityContentMessage): void {
  pill.update(activityOverlayView(message.display, message.overlay));
}
