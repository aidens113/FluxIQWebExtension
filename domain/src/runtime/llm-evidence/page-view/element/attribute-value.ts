// One attribute of a packet element, by name, as the packet published it
// (screened). Attributes travel as `[name, value]` pairs (`../../attributes.ts`);
// the first of a repeated name wins, as it does in a browser.

import type { WebLlmEvidenceElement } from "../../elements";

/** The attribute's published value, or `undefined` when the element has none by that name. */
export function attributeValue(element: WebLlmEvidenceElement, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return element.attributes?.find(([key]) => key.toLowerCase() === wanted)?.[1];
}
