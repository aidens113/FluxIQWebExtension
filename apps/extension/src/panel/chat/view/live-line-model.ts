// What the live line at the end of the chat says while FluxIQ works: the
// paced display's headline and detail (`ExtensionActivityState.display`), and
// the step. The background paces the display, so this line changes at a
// readable rate however fast Core's events arrive. Between a send and the
// first activity it says the message is on its way. No DOM.

import type { ActivityDisplay } from "../../../shared/activity/index";
import { stepText } from "../header";

/** The live line's words; null hides it. */
export type LiveLineModel = { headline: string; detail: string; step: string };

const SENDING = "Sending your message";

/** The live line for `display`, or for a send still on its way. */
export function liveLineModel(display: ActivityDisplay | null | undefined, sending: boolean): LiveLineModel | null {
  if (display?.working === true) {
    return {
      headline: display.headline.trim() || "Working",
      detail: display.detail?.trim() ?? "",
      step: stepText(display.step ?? undefined) ?? ""
    };
  }
  return sending ? { headline: SENDING, detail: "", step: "" } : null;
}
