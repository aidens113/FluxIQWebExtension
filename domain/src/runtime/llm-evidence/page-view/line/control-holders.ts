// Which elements hold a visible control of their own (t229): the ones a press
// listener or a cursor alone does not make a control. A feed list that hears
// its buttons' presses, or a card with a pointer whose title is a link, is
// where presses are heard; what a person presses is inside it. The view gives
// such a delegate the line a non-control gets (`./choice.ts`), and a press is
// held to the same reading (`../../plan-resolution/pressable-targets.ts`).
//
// A control drawn only by a cursor the same as the one of the element around it
// that has its own does not make that element a delegate. It is a second place
// to press inside a pressable element -- a close cross on a greeting bubble that
// opens a chat, an icon on a card -- and not the only one: both get a control
// line. The capture reports such a cursor only since it reads the page's own
// style rules (`apps/extension/src/content/evidence/declared-cursor.ts`, lane 4);
// before, the inner cursor read as inherited, and the outer element was a
// control. A cursor unlike the outer one (a refusing `not-allowed` option in a
// pointer picker) still makes a delegate, as it did.

import type { WebLlmEvidenceElement } from "../../elements";
import { webLlmViewTraits } from "../element";
import type { WebLlmPageTree } from "../page-tree";

/** Every element with a visible control under it. */
export function webLlmControlHolders(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): ReadonlySet<WebLlmEvidenceElement> {
  const holders = new Set<WebLlmEvidenceElement>();
  for (const element of elements) {
    const traits = webLlmViewTraits(element);
    if (!traits.visible || !traits.control || cursorWithinLikeCursor(element, traits.drawn, tree)) continue;
    for (const ancestor of tree.ancestors(element)) {
      if (holders.has(ancestor)) break;
      holders.add(ancestor);
    }
  }
  return holders;
}

/** A control only by its cursor, inside an element whose own cursor (the nearest one around it) is the same. */
function cursorWithinLikeCursor(element: WebLlmEvidenceElement, drawn: boolean, tree: WebLlmPageTree): boolean {
  if (!drawn || element.hasClickHandler === true || element.cursor === undefined) return false;
  return tree.ancestors(element).find((ancestor) => ancestor.cursor !== undefined)?.cursor === element.cursor;
}
