// The group a control sits in, as its line prints it (t605): `group="Size"`,
// the name of the nearest named set of options around it -- a fieldset's
// legend, or an ARIA group's name (t610, `../group-names.ts`). A bare option
// says what it is only through its group -- `checkbox "ValueRidge (23)"` is a
// seller under "Retailer" and a brand under "Brand" -- so every control line in
// a group carries it, and a search's match does too
// (`../../page-find/search.ts`). Printed last, after the state tokens, since it
// says where the control is rather than what it holds.

import { quotedWords } from "./quoted";

/** `group="<name>"` for the group a control sits in, or `undefined` for none. */
export function webLlmGroupToken(group: string | undefined): string | undefined {
  const words = group?.replace(/\s+/gu, " ").trim();
  return words === undefined || words === "" ? undefined : `group=${quotedWords(words)}`;
}
