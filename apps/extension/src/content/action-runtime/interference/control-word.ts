// The closed word that names the way out the clearing pressed, for the result's
// record of it (t401, `domain/src/actions/cleared-layers.ts`).
//
// The record never carries a control's own label: "No thanks, I would rather
// pay full price" is page text. It carries the allow-list phrase the label
// begins with, which is the vocabulary's own word and the reason the control
// was pressed at all. A control admitted by `data-dismiss`, or by a close glyph
// alone, is a "Close".

import type { WebAutomationClearedControlWord } from "@fluxiq-web-extension/domain/client";

/** Each phrase a way out may begin with, most specific first, and the word it is recorded as. */
const WORDS: ReadonlyArray<readonly [RegExp, WebAutomationClearedControlWord]> = [
  [/^[×✕✖╳xX]$/u, "Close"],
  [/^close/iu, "Close"],
  [/^dismiss/iu, "Dismiss"],
  [/^minimi[sz]e/iu, "Minimise"],
  [/^hide/iu, "Hide"],
  [/^not now/iu, "Not now"],
  [/^no,? thank(?:s| you)?/iu, "No thanks"],
  [/^maybe later/iu, "Maybe later"],
  [/^remind me later/iu, "Remind me later"],
  [/^later/iu, "Later"],
  [/^skip/iu, "Skip"],
  [/^not interested/iu, "Not interested"],
  [/^continue without accepting/iu, "Continue without accepting"],
  [/^continue without/iu, "Continue without"],
  [/^reject/iu, "Reject"],
  [/^decline/iu, "Decline"],
  [/^refuse/iu, "Refuse"],
  [/^deny/iu, "Deny"],
  [/^(?:(?:use |allow )?(?:only )?(?:strictly )?(?:necessary|essential|required)|only (?:allow |use )?(?:strictly )?(?:necessary|essential|required))/iu, "Necessary only"],
  [/^(?:ok|okay)[.!]?$/iu, "OK"],
  [/^got it/iu, "Got it"],
  [/^(?:understood|i understand)/iu, "Understood"]
];

/** The recorded word for the way out this control is: from its name, then its own text; "Close" when neither says. */
export function clearedControlWord(control: Element): WebAutomationClearedControlWord {
  for (const label of ownLabels(control)) {
    const word = wordFor(label);
    if (word) return word;
  }
  return "Close";
}

/** The word a label begins with, or `undefined`. */
function wordFor(label: string): WebAutomationClearedControlWord | undefined {
  const text = label.replace(/\s+/gu, " ").trim();
  for (const [phrase, word] of WORDS) {
    if (phrase.test(text)) return word;
  }
  return undefined;
}

/** The names `way-out.ts` reads a control by, in its order: accessible name or title, then a leaf's own text. */
function ownLabels(control: Element): string[] {
  const labels = [control.getAttribute("aria-label") ?? control.getAttribute("title") ?? ""];
  if (control.childElementCount === 0) labels.push(control.textContent ?? "");
  return labels.filter((label) => label.trim().length > 0);
}
