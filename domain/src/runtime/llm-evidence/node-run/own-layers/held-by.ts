// Whether an element is a layer's own, as the build's layer memory reads it
// (`./memory.ts`): inside it by the page's structure, or, for a dialog, within
// its box. Never by the box alone otherwise: a backdrop's box holds the whole
// page, and what a dialog covers behind it is no control of the backdrop's.

import type { WebLlmEvidenceElement } from "../../elements";
import { webInLayer } from "../layer";

/** How far up the `parent` chain a layer's own control is looked for, as `../layer/member.ts` looks. */
const MOST_DEPTH = 40;

/** Whether `element` is the layer `layer`'s own, on a page whose elements `byHandle` holds. */
export function webLayerHolds(byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, element: WebLlmEvidenceElement, layer: string): boolean {
  if (element.inDialog === layer) return true;
  if (byHandle.get(layer)?.isDialog !== undefined) return webInLayer(byHandle, element, layer);
  let at = element.parent;
  for (let depth = 0; at !== undefined && depth < MOST_DEPTH; depth += 1) {
    if (at === layer) return true;
    at = byHandle.get(at)?.parent;
  }
  return false;
}
