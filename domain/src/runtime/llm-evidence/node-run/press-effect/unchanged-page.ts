// Whether two looks at a page show the same page, apart from where it is drawn
// (t511). What a node call reports as `pageChanged` (`../run.ts`) and whether a
// press had no effect (`./no-effect.ts`) both read it.
//
// Until t511 `pageChanged` compared the two packets whole, and each element's
// box, whether it is on screen and the window's scroll position are in the
// packet. Classifieds step 0038 of `run-mv6qrcdu-a31b44b8` pressed Apply in an
// open dialog. Nothing in the dialog or on the page changed, but the look
// after it was scrolled 19 pixels further, so the press was answered
// `pageChanged: true`.
//
// **The same page** means the same address, title and document; the same
// loading state (busy, navigating, as many loading indicators); the same
// elements by handle and in the same order, wordless and hidden ones included;
// and every line of the page view (`../../page-view/line/facts.ts`) reading the
// same words and state tokens -- a field's value, checked/unchecked,
// open/closed (aria-expanded), pressed (aria-pressed), selected, current,
// marked, disabled, a select's options. Only these are set aside: where an
// element is drawn against the window (its box, whether it is on screen, which
// controls a fixed layer happens to cover there) and where focus sits, which a
// press moves to the control it pressed. None of them is an effect.

import { webLlmLineFacts, type WebLlmLineFact } from "../../page-view";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";

/** State tokens that say where an element is drawn or where focus sits. */
const DRAWN_ONLY_TOKEN = /^(?:focused$|covered-by |covers \d)/u;

/** True where the two looks show the same page in every respect but where it is drawn and where focus sits. */
export function webPageUnchanged(before: WebLlmPageEvidence, after: WebLlmPageEvidence): boolean {
  return samePage(before, after) && sameElements(before.elements, after.elements) && sameLines(webLlmLineFacts(before), webLlmLineFacts(after));
}

function samePage(before: WebLlmPageEvidence, after: WebLlmPageEvidence): boolean {
  if (before.location !== after.location || before.title !== after.title) return false;
  const was = before.navigation?.timeOrigin;
  const now = after.navigation?.timeOrigin;
  if (was !== undefined && now !== undefined && was !== now) return false;
  if (before.loading?.busy !== after.loading?.busy || before.loading?.pendingNavigation !== after.loading?.pendingNavigation) return false;
  return (before.loading?.indicators?.length ?? 0) === (after.loading?.indicators?.length ?? 0);
}

/** The same elements, by handle, in the same order: none appeared or went, a wordless one included. */
function sameElements(before: readonly WebLlmEvidenceElement[], after: readonly WebLlmEvidenceElement[]): boolean {
  return before.length === after.length && before.every((element, index) => element.target === after[index]!.target && element.hidden === after[index]!.hidden);
}

function sameLines(before: readonly WebLlmLineFact[], after: readonly WebLlmLineFact[]): boolean {
  return before.length === after.length && before.every((line, index) => {
    const now = after[index]!;
    return line.handle === now.handle && line.kind === now.kind && line.words === now.words && drawnless(line.tokens) === drawnless(now.tokens);
  });
}

function drawnless(tokens: readonly string[]): string {
  return tokens.filter((token) => !DRAWN_ONLY_TOKEN.test(token)).join(" ");
}
