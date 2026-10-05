// The activity overlay's entry point: a small status pill on the page FluxIQ
// is automating, saying what FluxIQ is doing now, in a corner where it covers
// nothing the person needs. It draws the background's paced `display`
// (`overlay-view.ts`), in place (`status-pill.ts`), which says how it stays
// out of the page's way.
//
// It draws each display as it arrives, as the panel's status row does. The
// background's pacer is the one pace both follow (`background/activity/
// pacer.ts`: any three seconds show at most two paced changes). A dwell of the
// overlay's own, on top of that pace, made it lag the panel by most of a
// second, so the two said different things at the same moment (D7 of the t174
// UI review of run-musp8nz1-dbd3905a).
//
// Two sends can cross: the background answers a new document's readiness at
// once, outside its delivery queue, while a paced send may still be on its
// way. A display older than the one received, for the same unit of work, is
// therefore ignored rather than drawn over the newer one.
//
// The overlay says the phase and the current action only. A display the
// background marked as the model's words (`kind: "thought"`, `model-prose.ts`)
// keeps the action line already up for that unit of work, so a thought is
// never drawn as status (D6 and D13 of the run-musp4h2f-72e8ed99 UI review).
//
// The starting status (`kind: "starting"`) is drawn like any other display:
// the background puts it up the moment the person sends a message FluxIQ
// takes on and replaces it with Core's first activity
// (`background/activity/send-start.ts`). Nothing here times it.

import type { ActivityContentMessage, ActivityDisplay } from "../../shared/activity";
import { isModelProse } from "./model-prose";
import { activityOverlayView } from "./overlay-view";
import { StatusPill } from "./status-pill";

/** One overlay per content-script instance; the pill removes any a superseded instance left. */
const pill = new StatusPill();

let received: { activityId: string; sequence: number } | undefined;
/** The last action line drawn, for its unit of work: what a display of prose shows instead. */
let action: { activityId: string; detail: string | null } | undefined;

/** Shows what `message` says, or takes the overlay out of the page when it says nothing is to be shown. */
export function showActivityOverlay(message: ActivityContentMessage): void {
  const display = message.display;
  if (display && received?.activityId === display.activityId && display.sequence < received.sequence) return;
  received = display ? { activityId: display.activityId, sequence: display.sequence } : undefined;
  const shown = display ? actionOnly(display) : null;
  action = shown ? { activityId: shown.activityId, detail: shown.detail } : undefined;
  pill.update(activityOverlayView(shown, message.overlay));
}

/** `display`, with the action line already up in place of a detail that is the model's prose. */
function actionOnly(display: ActivityDisplay): ActivityDisplay {
  if (!isModelProse(display)) return display;
  return { ...display, detail: action?.activityId === display.activityId ? action.detail : null };
}
