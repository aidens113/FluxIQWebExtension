// The "outside" marks on one list item (t810): each button, `role="button"` or
// link inside it whose own name offers to bring the person into the item's set
// (`./offer-words.ts`), as `{ kind: "outside", said, entity? }`.
//
// `said` is the control's words as the page shows them; `entity` the linked name
// it sits beside where that is clear (`./linked-name.ts`). A read keeps these
// beside each row it leaves out so Core can refute a judge that calls the row
// asked for (`../rejected-samples.ts`). Nothing is clicked or changed; the same
// control twice says one mark.

import type { WebAutomationExtractionItemMark } from "@fluxiq-web-extension/domain/client";
import { controlName } from "./control-name";
import { linkedNameBeside } from "./linked-name";
import { offerWords } from "./offer-words";

const CONTROLS = 'button, [role="button"], a[href]';

/** The marks the item carries, in document order, or `null` where it offers nothing. */
export function itemOfferMarks(item: Element): WebAutomationExtractionItemMark[] | null {
  // An item that cannot be searched (a bare stand-in in a test) offers nothing.
  if (typeof item.querySelectorAll !== "function") return null;
  const marks: WebAutomationExtractionItemMark[] = [];
  for (const control of item.querySelectorAll(CONTROLS)) {
    const said = controlName(control);
    if (!offerWords(said)) continue;
    const entity = linkedNameBeside(control, item);
    if (marks.some((mark) => mark.said === said && mark.entity === entity)) continue;
    marks.push({ kind: "outside", said, ...(entity === undefined ? {} : { entity }) });
  }
  return marks.length > 0 ? marks : null;
}
