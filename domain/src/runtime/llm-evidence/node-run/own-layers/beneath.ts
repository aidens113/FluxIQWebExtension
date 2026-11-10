// Of the layers new after one act, which one it opened when one stands over
// another (t869, `./memory.ts`). Classifieds `run-mw3o6pgv-ffa1a04c`: a press
// opened a chooser, and a prompt the page raised in the same instant stood over
// it, covering the chooser's own controls. An act opens one thing, so where a
// new layer's own controls are covered by another new layer, the covered one is
// what the act opened, and what stands over it came from elsewhere. A dialog
// and the backdrop under it are not this: nothing covers the dialog's controls.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webLayerHolds } from "./held-by";

/** Of `fresh`, the layers whose own controls another of them covers on `page`; all of `fresh` where none is. */
export function webLayersBeneathOthers(fresh: readonly string[], page: WebLlmPageEvidence): readonly string[] {
  if (fresh.length < 2) return fresh;
  const byHandle = new Map(page.elements.map((element) => [element.target, element] as const));
  const coveredByAnother = (element: WebLlmEvidenceElement, layer: string) => fresh.some((other) => other !== layer && element.coveredBy?.includes(other) === true);
  const covered = fresh.filter((layer) => page.elements.some((element) => element.target !== layer && !fresh.includes(element.target) && coveredByAnother(element, layer) && webLayerHolds(byHandle, element, layer)));
  return covered.length > 0 ? covered : fresh;
}
