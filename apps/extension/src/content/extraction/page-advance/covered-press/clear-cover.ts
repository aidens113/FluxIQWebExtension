// A press the page would not let a person make is not made (t762, from t758's
// trace of everything-store's deal wheel): a Next page, a numbered page or a Load
// more under an open dialog, a scrim or an inert part of the page is *covered*.
// Until 2026-10-27 the step pressed the control with `click()` straight through
// the layer -- the page behind a modal answers a script's click -- so the list
// moved under a promotion nobody had answered.
//
// What is done instead is what the click verb does with a covered target: the
// page's own way out is pressed first, the interference defence's closed
// allow-list of dismissals and none of its consequential ones
// (`../../../action-runtime/interference/`, `clearInterference`, sparing a layer
// that holds the control), and the layer is given `CLEAR_WINDOW_MS` to go. A
// control still covered then fails `control_not_clickable`, the existing word
// for a control that cannot be pressed, with the sentence naming the layer; the
// press is never made.

import { clearInterference } from "../../../action-runtime/interference";
import { waitUntil } from "../../list-wait";
import { PaginationFault } from "../pagination-fault";
import { layerOverControl } from "./layer-over-control";

/** How long a layer is given to go after its way out was pressed: a close animation, not a wait on the page. */
const CLEAR_WINDOW_MS = 1_500;
const POLL_MS = 50;

/**
 * Leaves `control` free of any layer over it, or throws `control_not_clickable`
 * saying what still covers it; see the header.
 */
export async function clearCover(control: Element, deadline: number | undefined): Promise<void> {
  if (layerOverControl(control) === undefined) return;
  clearInterference(control);
  await waitUntil(() => layerOverControl(control) === undefined, CLEAR_WINDOW_MS, POLL_MS, deadline);
  const still = layerOverControl(control);
  if (still === undefined) return;
  throw new PaginationFault("control_not_clickable", `The pagination control was not pressed: ${still}. A person cannot press it until that layer is answered or closed.`);
}
