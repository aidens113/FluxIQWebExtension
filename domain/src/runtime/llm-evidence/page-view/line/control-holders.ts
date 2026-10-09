// Which elements hold a visible control of their own (t229): the ones a press
// listener or a cursor alone does not make a control. A feed list that hears
// its buttons' presses, or a card with a pointer whose title is a link, is
// where presses are heard; what a person presses is inside it. The view gives
// such a delegate the line a non-control gets (`./choice.ts`), and a press is
// held to the same reading (`../../plan-resolution/pressable-targets.ts`).

import type { WebLlmEvidenceElement } from "../../elements";
import { webLlmViewTraits } from "../element";
import type { WebLlmPageTree } from "../page-tree";

/** Every element with a visible control under it. */
export function webLlmControlHolders(elements: readonly WebLlmEvidenceElement[], tree: WebLlmPageTree): ReadonlySet<WebLlmEvidenceElement> {
  const holders = new Set<WebLlmEvidenceElement>();
  for (const element of elements) {
    const traits = webLlmViewTraits(element);
    if (!traits.visible || !traits.control) continue;
    for (const ancestor of tree.ancestors(element)) {
      if (holders.has(ancestor)) break;
      holders.add(ancestor);
    }
  }
  return holders;
}
