// The words of a column's element that has none of its own: its described
// descendants' words, in page order, joined as the page reads them (live run
// `run-mvd0pbn9-bad36023`, step 0015).
//
// A price drawn as pieces -- a container whose words sit only in child spans
// "", "9", ",87", " €" -- reached the model with no sample, beside a sibling
// column whose element held the struck-through original "21,48 €" as its own
// words. The model chose the column it could read and read the wrong price for
// eight revisions. So such a container's sample is composed from its
// descendants (`./field-sample.ts`): each descendant's own words, walked up
// the capture's own `parent` links as `../node-run/layer/member.ts` walks them,
// joined with one space except before a piece that starts with "," or "." and
// after one that ends with an opening bracket.
//
// A form control below the container is passed over, never read; a piece the
// screen withholds withholds the whole composition, since half a value read as
// the value would mislead. The caller screens and bounds the result.

import type { WebLlmEvidenceElement } from "../elements";
import { isWithheldText, screenedPageText } from "../withheld";

/** How far up the `parent` chain a descendant is looked for. */
const MOST_DEPTH = 40;
const FORM_CONTROL = /^(?:input|select|textarea|option)$/u;
const NO_SPACE_BEFORE = /^[,.]/u;
const NO_SPACE_AFTER = /[([{]$/u;

/**
 * The words of `container`'s described descendants in `page` (the capture's
 * elements, in page order), joined as the page reads them; `undefined` when
 * none has words or one of them is withheld.
 */
export function webLlmContainerWords(container: WebLlmEvidenceElement, page: readonly WebLlmEvidenceElement[]): string | undefined {
  const byHandle = new Map(page.map((element) => [element.target, element]));
  let joined = "";
  for (const element of page) {
    if (element.target === container.target || formControl(element) || !within(byHandle, element, container.target)) continue;
    const raw = ownWords(element);
    if (raw === undefined) continue;
    const said = screenedPageText(raw);
    if (said === undefined || isWithheldText(said)) return undefined;
    const piece = said.replace(/\s+/gu, " ").trim();
    if (piece === "") continue;
    joined = joined === "" || NO_SPACE_BEFORE.test(piece) || NO_SPACE_AFTER.test(joined) ? `${joined}${piece}` : `${joined} ${piece}`;
  }
  return joined === "" ? undefined : joined;
}

/**
 * An element's own words: `ownText` where the capture sent it, which it does
 * wherever they differ from `text` (the empty string for words only in its
 * children); else its text, or the name the page reads it by where the text
 * was that name.
 */
function ownWords(element: WebLlmEvidenceElement): string | undefined {
  return element.ownText ?? element.text ?? element.name;
}

function within(byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, element: WebLlmEvidenceElement, ancestor: string): boolean {
  let at = element.parent;
  for (let depth = 0; at !== undefined && depth < MOST_DEPTH; depth += 1) {
    if (at === ancestor) return true;
    const next = byHandle.get(at);
    if (next === undefined || formControl(next)) return false;
    at = next.parent;
  }
  return false;
}

function formControl(element: WebLlmEvidenceElement): boolean {
  return FORM_CONTROL.test(element.tag.toLowerCase()) || element.inputType !== undefined || element.controlType !== undefined;
}
