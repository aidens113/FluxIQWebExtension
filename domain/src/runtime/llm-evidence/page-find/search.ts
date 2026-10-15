// A search over the whole page (t223, "`web.find_on_page`").
//
// The page view shows what has visible words or is a control. Everything else
// -- a closed menu's items, a collapsed panel, an icon button's test id, a
// field's name attribute -- is found here. Every element of the capture is
// searched, hidden, off-page and text-less ones included, and exact matches
// are not ranked: they come in page order, fifty to a page, and the last line
// says how to ask for the next fifty. Once they are all shown, close matches
// follow (t491, `./near.ts`): elements holding most or part of the query's
// words but not as written, best first and capped, each marked `near` with
// the query words it lacks.
//
// A match is printed as the view would print the element -- handle, kind, its
// words in quotes -- so a handle found here is copied the same way as one read
// off the page. When the words are not what matched, the field or attribute
// that did is printed beside them, a window of about sixty characters around
// the match, so the model can see why it matched without the whole value.
//
// A control in a fieldset or a named ARIA group prints its group as its view
// line does, `group="Size"` (t605, t610: `../page-view/group-names.ts`), and an
// element's group is searched right after its own words: asking for "Size"
// finds the legend and every option under it.
//
// A search that found nothing says what it searched (F32). On
// `run-muqc07fh-eeffbc86` the model searched the home page twelve times for a
// product name, each answered only `0 matches`, while the page held the site's
// own search box: it took this tool for the site's search. So an empty answer
// says this page holds none of it, that only this page was read, and how to
// look across the site -- the site's search fields by handle, or a link.

import { present } from "../present";
import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import {
  quotedWords,
  undoubledWords,
  webLlmElementKind,
  webLlmElementWhere,
  webLlmElementWords,
  webLlmGroupNames,
  webLlmGroupToken,
  webLlmPageTree,
  webLlmViewTraits,
  type WebLlmGroupNames
} from "../page-view";
import { webLlmNearMatches } from "./near";
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
  const groups = webLlmGroupNames(evidence.elements, webLlmPageTree(evidence.elements));
  const matches = evidence.elements.flatMap((element) => {
    const match = matchOf(element, needle, groups);
    return match === undefined ? [] : [{ element, match }];
  });
  const shown = matches.slice(after, after + WEB_LLM_FIND_PAGE_SIZE);
  const left = matches.length - (after + shown.length);
  const near = left === 0 && after <= matches.length
    ? webLlmNearMatches(evidence.elements, query, new Set(matches.map(({ element }) => element)))
    : { shown: [], more: 0 };
  const lines = [`${matches.length} ${matches.length === 1 ? "match" : "matches"} for ${quotedWords(query)}`];
  if (matches.length === 0 && after === 0) lines.push(nothingHere(evidence, near.shown.length > 0));
  for (const { element, match } of shown) lines.push(matchLine(element, match, evidence, groups));
  if (left > 0) lines.push(`… ${left} more: web.find_on_page ${JSON.stringify({ query, after: after + shown.length })}`);
  const nearCount = near.shown.length + near.more;
  if (nearCount > 0) lines.push(`${nearCount} close ${nearCount === 1 ? "match" : "matches"}, holding most or part of those words but not as written:`);
  for (const { element, lacking } of near.shown) lines.push(nearLine(element, lacking, evidence, groups));
  if (near.more > 0) lines.push(`${near.more} more close ${near.more === 1 ? "match" : "matches"} not shown; search fewer words to narrow them.`);
  return present<WebLlmFindResult>({ schemaVersion: WEB_LLM_FIND_SCHEMA_VERSION, trust: evidence.trust, location: evidence.location, found: lines.join("\n") });
}

/** What an empty search says: only this page was read, and how to look across the site. */
function nothingHere(evidence: WebLlmPageEvidence, nearFollow: boolean): string {
  const fields = evidence.elements.filter((element) => webLlmElementKind(element) === "field[search]").map((element) => element.target);
  const across = fields.length === 0
    ? "To look across the site, follow a link to the page that lists it."
    : `To look across the site, type it into the site's search field ${fields.join(" or ")} and submit it, or follow a link to the page that lists it.`;
  const none = nearFollow
    ? "Nothing on this page holds those words as written, hidden elements included; the close matches below hold most or part of them. find_on_page"
    : "Nothing on this page holds those words, hidden elements included; find_on_page";
  return `${none} reads only the page you are on, never the rest of the site. ${across}`;
}

/** Where an element matched: in its words, or in a named field or attribute's value or name. */
type Match = { inWords: true } | { inWords: false; field: string; value: string; at: number };

function matchOf(element: WebLlmEvidenceElement, needle: string, groups: WebLlmGroupNames): Match | undefined {
  const words = [element.name, element.text, element.ownText, element.label];
  if (words.some((value) => found(value, needle) >= 0)) return { inWords: true };
  const fields: Array<[string, string | undefined]> = [
    ["group", groups.groupOf(element)],
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

function matchLine(element: WebLlmEvidenceElement, match: Match, evidence: WebLlmPageEvidence, groups: WebLlmGroupNames): string {
  const parts = [element.target, webLlmElementKind(element) ?? element.tag];
  const words = wordsOf(element);
  if (words !== undefined) parts.push(quotedWords(cut(words)));
  const group = groupToken(element, groups);
  if (group !== undefined) parts.push(group);
  // A control's group token already says the words a group match found.
  const shownByGroup = group !== undefined && !match.inWords && match.field === "group";
  if (!match.inWords && !shownByGroup) parts.push(`(${match.field}=${quotedWords(windowAround(collapsed(match.value), match.at))})`);
  parts.push(webLlmElementWhere(element, evidence.viewport));
  return parts.join(" ");
}

/** A close match: as an exact one prints, marked `near` with the query words it lacks. */
function nearLine(element: WebLlmEvidenceElement, lacking: string[], evidence: WebLlmPageEvidence, groups: WebLlmGroupNames): string {
  const parts = [element.target, webLlmElementKind(element) ?? element.tag];
  const words = wordsOf(element);
  if (words !== undefined) parts.push(quotedWords(cut(words)));
  const group = groupToken(element, groups);
  if (group !== undefined) parts.push(group);
  parts.push(lacking.length === 0 ? "near, holds every word" : `near, lacks ${quotedWords(lacking.join(" "))}`);
  parts.push(webLlmElementWhere(element, evidence.viewport));
  return parts.join(" ");
}

/** The group a control's view line ends with (`group="Size"`); any other element shows its group only as the field a search matched. */
function groupToken(element: WebLlmEvidenceElement, groups: WebLlmGroupNames): string | undefined {
  return webLlmViewTraits(element).control ? webLlmGroupToken(groups.groupOf(element)) : undefined;
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
