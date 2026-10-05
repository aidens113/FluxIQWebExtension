// Whether a display's detail must not be drawn as the overlay's action line.
//
// The overlay says the phase and the current action only (D6 of the
// run-musp4h2f-72e8ed99 UI review). The model's words -- its reason for a
// step, a refused edit with its own summary as the thing not done, a recovery
// choice -- are said in the chat. The background's pacer already keeps them
// out of the detail and marks the display `kind: "thought"`
// (`shared/activity/model-thought.ts`, `background/activity/pacer.ts`); this
// keys on that mark, so a thought is never drawn as status whatever event
// rides beside the display. The raw `activity` in the same message says
// nothing of what the display was built from: the relay's four-a-second gate
// can carry a newer event than the one displayed.

import type { ActivityDisplay } from "../../shared/activity";

/** True when `display`'s newest event was the model's words, so its detail is not taken as a new action line. */
export function isModelProse(display: ActivityDisplay): boolean {
  return display.kind === "thought";
}
