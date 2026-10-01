// A press on a control something covers is not sent (t223, C4 and C9 of
// `run-mup2i28c-6c7fc209`).
//
// The look a node takes before it acts marks every control a layer paints over
// with `coveredBy` (`../layers.ts`). Sent anyway, the click lands on the layer:
// live, a store button under a timed email popup was "pressed", the click
// closed the popup through its backdrop, the result said `succeeded` and
// `pageChanged`, and the store chooser it was for never opened. Refused, the
// call carries the page with the layer in it, and says which handles cover the
// control, so the next call deals with the layer and then presses again.

import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import type { WebLlmPageEvidence } from "../sanitize";

export type WebCoveredTarget = {
  /** A modal dialog covers it, or something that is not one -- a banner, an overlay. */
  code: "blocked_by_dialog" | "target_covered";
  /** The control's handle. */
  target: string;
  /** The handles of what covers it, as the page marks them. */
  covers: string[];
};

/** What covers the control `written` names on `page`, or `undefined` when nothing does or it names no control there. */
export function webCoveredTarget(page: WebLlmPageEvidence, written: string | undefined): WebCoveredTarget | undefined {
  const target = canonicalWebLlmTargetHandle(written);
  if (target === undefined) return undefined;
  // Only a layer refuses a press: a dialog, a cover the capture recognised by
  // kind (consent, promotion, robot check, rate limit, assistant), or one it
  // placed in the front layer. `coveredBy` also marks ordinary overlap -- a
  // price's aria-hidden twin, a floating field label, a card's stretched link
  // -- and refusing those refused live presses that would have worked.
  const layer = (handle: string): boolean => {
    const cover = page.elements.find((element) => element.target === handle);
    return cover !== undefined && (cover.isDialog !== undefined || cover.kind !== undefined || cover.frontLayer === true);
  };
  const covers = (page.elements.find((element) => element.target === target)?.coveredBy ?? []).filter(layer);
  if (covers.length === 0) return undefined;
  const modal = covers.some((cover) => page.elements.find((element) => element.target === cover)?.isDialog?.modal === true);
  return { code: modal ? "blocked_by_dialog" : "target_covered", target, covers: [...covers] };
}
