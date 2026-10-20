// A stateful control's own state as one opaque token (L1 reset settlement,
// "Control states"): its name -- a toggle's words change with it -- and what
// it says it is pressed, checked or selected. Two reads of one control at one
// place agree on it exactly when a person would see the same control.
//
// A control the page gave no name (l1 D5) is read by the words the page view
// prints for it (`webLlmElementWords`) -- its text, label, title or tooltip --
// so a toggle whose words change while its name stays empty still has two
// states. The view's own word rule, not a new one: what the model reads as the
// control is what tells its states apart. With neither, the name part is
// empty and only the pressed, checked and selected states can differ; several
// controls at one place still count by state (`./states.ts`).

import type { WebLlmEvidenceElement } from "../elements";
import { webLlmElementWords } from "../page-view";
import { webControlSpotToken } from "./token";

/** The state token of `element` (header). */
export function webControlState(element: WebLlmEvidenceElement): string {
  const attribute = (key: string) => element.attributes?.find(([name]) => name.toLowerCase() === key)?.[1] ?? null;
  const checked = element.checked ?? attribute("aria-checked");
  const words = (element.name?.trim() ? element.name : webLlmElementWords(element)) ?? null;
  return webControlSpotToken("scope", `state\0${JSON.stringify([words, attribute("aria-pressed"), checked, attribute("aria-selected")])}`);
}
