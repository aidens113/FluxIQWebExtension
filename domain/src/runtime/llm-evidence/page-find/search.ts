// A search over the whole page (t223, "`web.find_on_page`").
//
// The page view shows what has visible words or is a control. Everything else
// -- a closed menu's items, a collapsed panel, an icon button's test id, a
// field's name attribute -- is found here. Every element of the capture is
// searched, hidden, off-page and text-less ones included, and exact matches
// are not ranked: they come in page order, fifty to a page, and the last line
// says how to ask for the next fifty. After them come the close matches
// (t491, `./near.ts`): elements holding most or part of the query's words but
// not as written, best first, each marked `near` with the query words it lacks.
// They share the exact matches' pages, so `after` reaches every one; none is
// left uncounted or unshown (t903).
//
// A match is printed as the view would print the element -- handle, kind, its
// words in quotes -- so a handle found here is copied the same way as one read
// off the page. When the words are not what matched, the field or attribute
// that did is printed beside them, so the model can see why it matched.
//
// Nothing a match prints is cut (t903). Words were once cut at eighty
// characters and a matching value at a sixty-character window. On
// `run-mwbkuxqt-c57f42cb` the line the task asked for sat in a closed menu,
// so only this search could show it, and it showed `"Followed stores: Hubsmith
// Global Store; Mirafone Accessories; Qinport Official S…"`: the model's own
// view of the page lost the end of the line it had to copy. The model sees the
// whole page, hidden parts included, so a match prints its words and the
// value that matched in full, as the page view prints an element's words.
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
//
// Rerun 3's job note: ten searches for a control drawn only as an icon -- no
// text, label or title, printed by the view as `clickable icon class="..."`
// (`../page-view/element/icon-hints.ts`) -- each answered as above, which
// steered the model to the site's search and away from the page's own
// wordless controls. So when the page holds such controls, an empty answer
// also names the first few and says how to learn what one does.

import { present } from "../present";
import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmPageEvidence } from "../sanitize";
import {
  chosenWebLlmLines,
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
/** How many wordless icon controls an empty answer names. */
const ICONS_NAMED = 3;

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
  const near = webLlmNearMatches(evidence.elements, query, new Set(matches.map(({ element }) => element)));
  // One sequence, exact matches then close ones, paged together (header).
  const entries: Array<{ exact: true; element: WebLlmEvidenceElement; match: Match } | { exact: false; element: WebLlmEvidenceElement; lacking: string[] }> = [
    ...matches.map(({ element, match }) => ({ exact: true as const, element, match })),
    ...near.map(({ element, lacking }) => ({ exact: false as const, element, lacking }))
  ];
  const shown = entries.slice(after, after + WEB_LLM_FIND_PAGE_SIZE);
  const left = entries.length - (after + shown.length);
  const lines = [`${matches.length} ${matches.length === 1 ? "match" : "matches"} for ${quotedWords(query)}`];
  if (matches.length === 0 && after === 0) lines.push(nothingHere(evidence, near.length > 0));
  for (const [index, entry] of shown.entries()) {
    if (entry.exact) {
      lines.push(matchLine(entry.element, entry.match, evidence, groups));
      continue;
    }
    if (index === 0 || shown[index - 1]!.exact) {
      const continued = after + index > matches.length ? ", continued" : "";
      lines.push(`${near.length} close ${near.length === 1 ? "match" : "matches"}${continued}, holding most or part of those words but not as written:`);
    }
    lines.push(nearLine(entry.element, entry.lacking, evidence, groups));
  }
  if (left > 0) lines.push(`… ${left} more: web.find_on_page ${JSON.stringify({ query, after: after + shown.length })}`);
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
  const icons = wordlessIcons(evidence);
  return `${none} reads only the page you are on, never the rest of the site. ${across}${icons === undefined ? "" : ` ${icons}`}`;
}

/** The sentence naming the page's first few wordless icon controls, or `undefined` when it has none. */
function wordlessIcons(evidence: WebLlmPageEvidence): string | undefined {
  const handles = chosenWebLlmLines(evidence.elements, webLlmPageTree(evidence.elements))
    .filter((line) => line.role === "control" && line.icon?.includes("icon") === true)
    .map((line) => line.element.target);
  if (handles.length === 0) return undefined;
  const named = handles.slice(0, ICONS_NAMED);
  const more = handles.length - named.length;
  const list = more > 0 ? `${named.join(", ")} and ${more} more` : listed(named);
  return `Some controls here show no words, only an icon: ${list}. What one does is written nowhere, so describe one (web.describe_element) or watch what it changes.`;
}

function listed(handles: readonly string[]): string {
  return handles.length <= 1 ? handles.join("") : `${handles.slice(0, -1).join(", ")} and ${handles.at(-1)}`;
}

/** Where an element matched: in its words, or in a named field or attribute's value or name. */
type Match = { inWords: true } | { inWords: false; field: string; value: string };

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
    if (found(value, needle) >= 0) return { inWords: false, field, value: value! };
  }
  for (const [name, value] of element.attributes ?? []) {
    if (found(value, needle) >= 0 || found(name, needle) >= 0) return { inWords: false, field: name, value };
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
  if (words !== undefined) parts.push(quotedWords(words));
  const group = groupToken(element, groups);
  if (group !== undefined) parts.push(group);
  // A control's group token already says the words a group match found.
  const shownByGroup = group !== undefined && !match.inWords && match.field === "group";
  if (!match.inWords && !shownByGroup) parts.push(`(${match.field}=${quotedWords(collapsed(match.value))})`);
  parts.push(webLlmElementWhere(element, evidence.viewport));
  return parts.join(" ");
}

/** A close match: as an exact one prints, marked `near` with the query words it lacks. */
function nearLine(element: WebLlmEvidenceElement, lacking: string[], evidence: WebLlmPageEvidence, groups: WebLlmGroupNames): string {
  const parts = [element.target, webLlmElementKind(element) ?? element.tag];
  const words = wordsOf(element);
  if (words !== undefined) parts.push(quotedWords(words));
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
