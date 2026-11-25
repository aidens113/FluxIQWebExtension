// The whole page, for a model that asked for it (t1036, D5 and D15): the view a
// look shows, and between its lines, marked `extra`, what only a capture that
// also lists the hidden elements can say -- each hidden element, and each
// element's attributes whole.
//
// The view's own lines are exactly the ordinary view of the same capture, in
// the same order with the same keys: a hidden element never gets a line of the
// ordinary view and never moves a visible element's handle
// (`../stable-handles.ts`), so Core resets the page's base to them and later
// diffs compare with the ordinary view. The extra lines are shown once, in
// page order:
//
//   FULL also lists the hidden elements and each element's attributes   (after the header)
//   t40 hidden link "Claim offer"                                        (key `t40`)
//   t40 attributes: href="~/offer" class="promo"                         (key `t40.attributes`)
//
// An element with no line and nothing hidden about it -- a wrapper with no
// words -- stays out, as it does from the view.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import { quotedWords, webLlmElementKind, webLlmElementWords } from "./element";
import type { WebLlmPageView } from "./keyed-view";
import type { WebLlmPageLine } from "./keyed-line";
import { webLlmPageKey } from "./location-key";
import { webLlmPageViewLines } from "./written-lines";

const FULL_LINE: WebLlmPageLine = { key: "FULL", text: "FULL also lists the hidden elements and each element's attributes", extra: true };

/** The view of `evidence` with its hidden elements and every element's attributes as extra lines. */
export function webLlmFullPageView(evidence: WebLlmPageEvidence): WebLlmPageView {
  const base = webLlmPageViewLines(evidence);
  const separator = base.findIndex((line) => line.key === "-");
  const header = separator < 0 ? base : base.slice(0, separator);
  const body = separator < 0 ? [] : base.slice(separator + 1);
  const taken = new Set(base.map((line) => line.key));
  const extra = (key: string, text: string): WebLlmPageLine => {
    let unique = key;
    for (let next = 2; taken.has(unique); next += 1) unique = `${key}#${next}`;
    taken.add(unique);
    return { key: unique, text, extra: true };
  };
  const elements = evidence.elements;
  const indexOf = new Map(elements.map((element, index) => [element.target, index] as const));
  const lines: WebLlmPageLine[] = [...header, extra(FULL_LINE.key, FULL_LINE.text), ...(separator < 0 ? [] : [base[separator] as WebLlmPageLine])];
  let next = 0;
  // The hidden elements that stand before packet index `end`, each with its attributes.
  const hiddenBefore = (end: number): void => {
    for (; next < end; next += 1) {
      const element = elements[next] as WebLlmEvidenceElement;
      if (element.hidden !== true) continue;
      lines.push(extra(element.target, hiddenLine(element)));
      const attributes = attributesLine(element);
      if (attributes !== undefined) lines.push(extra(`${element.target}.attributes`, attributes));
    }
  };
  // The body in its own order: each element's markers and line, then that element's attributes.
  let chunk: WebLlmPageLine[] = [];
  for (const line of body) {
    chunk.push(line);
    if (line.key.startsWith("^")) continue;
    const at = indexOf.get(line.key);
    if (at !== undefined && at >= next) {
      hiddenBefore(at);
      next = at + 1;
    }
    lines.push(...chunk);
    chunk = [];
    const element = at === undefined ? undefined : elements[at];
    const attributes = element === undefined ? undefined : attributesLine(element);
    if (element !== undefined && attributes !== undefined) lines.push(extra(`${element.target}.attributes`, attributes));
  }
  lines.push(...chunk);
  hiddenBefore(elements.length);
  return { key: webLlmPageKey(evidence.location), lines };
}

/** A hidden element as one line: its handle, `hidden`, its kind and its words. */
function hiddenLine(element: WebLlmEvidenceElement): string {
  const kind = webLlmElementKind(element);
  const words = webLlmElementWords(element) ?? firstWords(element);
  return [element.target, "hidden", ...(kind === undefined ? [`<${element.tag}>`] : [kind]), ...(words === undefined ? [] : [quotedWords(words)])].join(" ");
}

/** The words a hidden element would be read by when the view's own rule gives none: its name, own text, text or label. */
function firstWords(element: WebLlmEvidenceElement): string | undefined {
  const first = [element.name, element.ownText, element.text, element.label].find((value) => value !== undefined && value.trim() !== "");
  return first === undefined ? undefined : first.replace(/\s+/gu, " ").trim();
}

/** An element's attributes whole, as the screened packet holds them, or `undefined` for none. */
function attributesLine(element: WebLlmEvidenceElement): string | undefined {
  const attributes = element.attributes ?? [];
  return attributes.length === 0 ? undefined : `${element.target} attributes: ${attributes.map(([name, value]) => `${name}=${quotedWords(value)}`).join(" ")}`;
}
