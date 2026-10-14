// The group a control sits in, as its line prints it (t605): `group="Size"`,
// the legend of the fieldset around it (`../../elements.ts`, `group`). A bare
// option says what it is only through its group -- `checkbox "ValueRidge
// (23)"` is a seller under "Retailer" and a brand under "Brand" -- so every
// control line in a fieldset carries it, and a search's match does too
// (`../../page-find/search.ts`). Printed last, after the state tokens, since it
// says where the control is rather than what it holds.

import type { WebLlmEvidenceElement } from "../../elements";
import { quotedWords } from "./quoted";

/** `group="<legend>"` for an element the packet placed in a fieldset, or `undefined`. */
export function webLlmGroupToken(element: WebLlmEvidenceElement): string | undefined {
  const group = element.group?.replace(/\s+/gu, " ").trim();
  return group === undefined || group === "" ? undefined : `group=${quotedWords(group)}`;
}
