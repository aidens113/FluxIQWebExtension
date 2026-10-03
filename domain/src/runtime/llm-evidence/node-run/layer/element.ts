// What counts as a layer in front of the page, read off one element's marks
// (`../../layer-marks.ts`): a dialog, a cover the capture recognised by kind
// (consent, promotion, robot check, rate limit, assistant), or one it placed in
// the front layer. `coveredBy` alone is not one: it also marks ordinary
// overlap -- a price's aria-hidden twin, a floating field label, a card's
// stretched link -- and treating those as layers refused live presses that
// would have worked (`../covered-target.ts`).

import type { WebLlmEvidenceElement } from "../../elements";

/** Whether `element` is a layer in front of the page. */
export function webIsLayer(element: WebLlmEvidenceElement | undefined): boolean {
  return element !== undefined && (element.isDialog !== undefined || element.kind !== undefined || element.frontLayer === true);
}
