// Whether a control sits under an open layer of the page: a dialog the page
// declares modal and paints, a layer the hit test finds over the control's own
// centre, or an `inert` ancestor. A person cannot press such a control; a
// script's `click()` can, and the page behind a modal answers it as if the
// modal were not there.
//
// The layers are the interference defence's own (`../../action-runtime/interference/`,
// `overlaysAt`): the modals the page paints and the dialog at the control's
// centre, less any layer that holds the control, which is the one the control
// works in. The sentence is `coveringLayerSentence`'s where the hit test names
// the layer, and a generic one where only the page's declaration does.
//
// A page the layer reading cannot make sense of fails the move (a thrown error
// is `page_fault`) rather than reading as not covered: an unreadable page is not
// proof that nothing stands over the control.

import { coveringLayerSentence, overlaysAt, type Point } from "../../../action-runtime/interference";
import { composedClosest } from "../../../shadow-dom";

/** What stands over `control`, in a sentence, or `undefined` when nothing does; see the header. */
export function layerOverControl(control: Element): string | undefined {
  const point = centreInView(control);
  const layers = overlaysAt(point, control);
  const inert = composedClosest(control, "[inert]") !== null;
  if (layers.length === 0 && !inert) return undefined;
  const named = point === undefined ? undefined : coveringLayerSentence(control, point);
  if (named !== undefined) return named;
  return layers.length > 0 ? "it sits under a dialog the page has open" : "it sits in a part of the page the page has made inert";
}

/** The control's centre when it is inside the viewport, where the hit test can be asked. */
function centreInView(control: Element): Point | undefined {
  if (typeof control.getBoundingClientRect !== "function" || typeof window === "undefined") return undefined;
  const box = control.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return undefined;
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  return x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight ? { x, y } : undefined;
}
