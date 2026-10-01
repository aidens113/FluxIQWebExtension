// A search over the whole page (t223, "`web.find_on_page`").
//
// The page view shows what has visible words or is a control. Everything else
// -- a closed menu's items, a collapsed panel, an icon button's test id, a
// field's name attribute -- is found here. Every element of the capture is
// searched, hidden, off-page and text-less ones included, and nothing is
// ranked: matches come in page order, fifty to a page, and the last line says
// how to ask for the next fifty.
//
// A match is printed as the view would print the element -- handle, kind, its
// words in quotes -- so a handle found here is copied the same way as one read
// off the page. When the words are not what matched, the field or attribute
// that did is printed beside them, a window of about sixty characters around
// the match, so the model can see why it matched without the whole value.

import { present } from "../present";
import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import { quotedWords, undoubledWords, webLlmElementKind, webLlmElementWhere, webLlmElementWords } from "../page-view";
import { WEB_LLM_FIND_SCHEMA_VERSION } from "./schema-version";

/** Matches to one page of the answer. */
const WEB_LLM_FIND_PAGE_SIZE = 50;
/** How much of a match's words is printed before `…`. */
const WORDS_SHOWN = 80;
/** About how much of a matching value is printed around the match. */
const WINDOW = 60;

export type WebLlmFindResult = {
  schemaVersion: typeof WEB_LLM_FIND_SCHEMA_VERSION;
  trust: WebLlmPageEvidence["trust"];
  /** Where the search was made, exactly as a page's `location`. */
  location: string;
  /** The count, one line per match on this page of the answer, and how to ask for more. */
  found: string;
};

/** Every element matching `query`, in page order, from match `after`, as the model reads them. */
export function webLlmFindOnPage(evidence: WebLlmPageEvidence, query: string, after: number): WebLlmFindResult {
  const needle = query.toLowerCase();
  const matches = evidence.elements.flatMap((element) => {
    const match = matchOf(element, needle);
    return match === undefined ? [] : [{ element, match }];
  });
  const shown = matches.slice(after, after + WEB_LLM_FIND_PAGE_SIZE);
  const lines = [`${matches.length} ${matches.length === 1 ? "match" : "matches"} for ${quotedWords(query)}`];
  for (const { element, match } of shown) lines.push(matchLine(element, match, evidence));
  const left = matches.length - (after + shown.length);
  if (left > 0) lines.push(`… ${left} more: web.find_on_page ${JSON.stringify({ query, after: after + shown.length })}`);
  return present<WebLlmFindResult>({ schemaVersion: WEB_LLM_FIND_SCHEMA_VERSION, trust: evidence.trust, location: evidence.location, found: lines.join("\n") });
}

/** Where an element matched: in its words, or in a named field or attribute's value or name. */
type Match = { inWords: true } | { inWords: false; field: string; value: string; at: number };

function matchOf(element: WebLlmEvidenceElement, needle: string): Match | undefined {
  const words = [element.name, element.text, element.ownText, element.label];
  if (words.some((value) => found(value, needle) >= 0)) return { inWords: true };
  const fields: Array<[string, string | undefined]> = [
    ["value", element.value],
    ["selected", element.selectedValue],
    ...(element.options ?? []).map((option): [string, string] => ["option", option.label]),
    ["href", element.href]
  ];
  for (const [field, value] of fields) {
    const at = found(value, needle);
    if (at >= 0) return { inWords: false, field, value: value!, at };
  }
  for (const [name, value] of element.attributes ?? []) {
    const atValue = found(value, needle);
    if (atValue >= 0) return { inWords: false, field: name, value, at: atValue };
    if (found(name, needle) >= 0) return { inWords: false, field: name, value, at: 0 };
  }
  return undefined;
}

/** Where `needle` starts in `value`, compared case-insensitively over collapsed whitespace, or -1. */
function found(value: string | undefined, needle: string): number {
  if (value === undefined) return -1;
  return collapsed(value).toLowerCase().indexOf(needle);
}

function collapsed(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function matchLine(element: WebLlmEvidenceElement, match: Match, evidence: WebLlmPageEvidence): string {
  const parts = [element.target, webLlmElementKind(element) ?? element.tag];
  const words = wordsOf(element);
  if (words !== undefined) parts.push(quotedWords(cut(words)));
  if (!match.inWords) parts.push(`(${match.field}=${quotedWords(windowAround(collapsed(match.value), match.at))})`);
  parts.push(webLlmElementWhere(element, evidence.viewport));
  return parts.join(" ");
}

/** The words the view would print, or for an element the view gives no line, the first words it has. */
function wordsOf(element: WebLlmEvidenceElement): string | undefined {
  const printed = webLlmElementWords(element);
  if (printed !== undefined) return printed;
  const first = [element.name, element.ownText, element.text, element.label].find((value) => value !== undefined && value.trim() !== "");
  if (first === undefined) return undefined;
  const undoubled = undoubledWords(collapsed(first));
  return undoubled === "" ? undefined : undoubled;
}

function cut(words: string): string {
  const characters = [...words];
  return characters.length <= WORDS_SHOWN ? words : `${characters.slice(0, WORDS_SHOWN).join("")}…`;
}

/** About {@link WINDOW} characters of `value` around the match at `at`, with `…` at each end that was cut. */
function windowAround(value: string, at: number): string {
  if (value.length <= WINDOW) return value;
  const start = Math.max(0, Math.min(at - Math.floor(WINDOW / 3), value.length - WINDOW));
  const end = Math.min(value.length, start + WINDOW);
  return `${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}
