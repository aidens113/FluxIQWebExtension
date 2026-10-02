// Whether an element belongs to a layer (`./layer-element.ts`): the layer is
// among its described ancestors (`parent`), or it sits inside the layer's box
// and the layer does not paint over it -- a layer's own controls answer their
// own clicks, and the page behind it does not.

import type { WebLlmEvidenceElement } from "../elements";

/** How far up the `parent` chain a membership is looked for. */
const MOST_DEPTH = 40;

/** Whether `element` belongs to the layer with handle `cover`, on a page whose elements `byHandle` holds. */
export function webInLayer(byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, element: WebLlmEvidenceElement, cover: string): boolean {
  let at = element.parent;
  for (let depth = 0; at !== undefined && depth < MOST_DEPTH; depth += 1) {
    if (at === cover) return true;
    at = byHandle.get(at)?.parent;
  }
  const outer = byHandle.get(cover)?.box;
  const inner = element.box;
  if (!outer || !inner || element.coveredBy?.includes(cover)) return false;
  const x = inner.x + inner.width / 2;
  const y = inner.y + inner.height / 2;
  return x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height;
}
