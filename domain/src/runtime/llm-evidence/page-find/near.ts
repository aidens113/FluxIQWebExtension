// Close matches for a page search (t491).
//
// On `run-mv6bg7ac-d24d91ce` the model searched the page for an item's full
// name, words and size together. Only a decoy whose title held that exact
// string matched. The right item was a tile with a shorter name and an Options
// link, and its size was a chip carrying the remaining words; a literal search
// never shows either. So after the exact matches come the elements whose own
// words hold most of the query's words, or are made only of them (a chip that
// carries part of the name), each with the query words it lacks, so the model
// can see what an item is missing and look for the control that adds it.
//
// Words are compared case-insensitively over letters and digits only, so
// punctuation never counts; short stop words are ignored and a plural `s` is
// dropped. An element must share at least two of the query's words, so one
// common word is never close. Ranking is by the share of the query's words
// held, then page order. No edit distance: a word is held or it is not, and the
// same page and query always give the same answer.
//
// Every close match is answered (t903). Until t903 ten were listed and the rest
// counted, "search fewer words to narrow them", with no way to see them: a cap
// on what the model sees of the page. They now follow the exact matches in the
// search's own pages of fifty (`./search.ts`), so `after` reaches every one.

import type { WebLlmEvidenceElement } from "../elements";

/** Words too common to say anything about which element was meant. */
const STOP_WORDS: ReadonlySet<string> = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"]);

/** Every close match, best first, each with the query words it lacks in the query's spelling. */
export function webLlmNearMatches(
  elements: readonly WebLlmEvidenceElement[],
  query: string,
  exact: ReadonlySet<WebLlmEvidenceElement>
): Array<{ element: WebLlmEvidenceElement; lacking: string[] }> {
  const wanted = queryWords(query);
  if (wanted.length < 2) return [];
  const keys = new Set(wanted.map((word) => word.key));
  const near = elements.flatMap((element, index) => {
    if (exact.has(element)) return [];
    const held = elementKeys(element);
    const lacking = wanted.filter((word) => !held.has(word.key));
    const holds = wanted.length - lacking.length;
    if (holds < 2) return [];
    const onlyQueryWords = [...held].every((key) => keys.has(key));
    if (holds * 2 < wanted.length && !onlyQueryWords) return [];
    return [{ element, index, holds, lacking: lacking.map((word) => word.word) }];
  });
  near.sort((a, b) => b.holds - a.holds || a.index - b.index);
  return near.map(({ element, lacking }) => ({ element, lacking }));
}

/** The query's significant words, each once, in its own spelling and as compared. */
function queryWords(query: string): Array<{ word: string; key: string }> {
  const seen = new Set<string>();
  return tokens(query).flatMap((word) => {
    const key = keyOf(word);
    if (key === undefined || seen.has(key)) return [];
    seen.add(key);
    return [{ word, key }];
  });
}

/** An element's own words as compared: its name, its own text (all its text when it has no separate own text) and its label. */
function elementKeys(element: WebLlmEvidenceElement): Set<string> {
  const words = [element.name, element.ownText ?? element.text, element.label].flatMap((value) => (value === undefined ? [] : tokens(value)));
  return new Set(words.flatMap((word) => keyOf(word) ?? []));
}

function tokens(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** A word as compared, or undefined for a stop word or a lone letter. */
function keyOf(word: string): string | undefined {
  const lower = word.toLowerCase();
  if (STOP_WORDS.has(lower) || (lower.length < 2 && !/\p{N}/u.test(lower))) return undefined;
  return lower.length > 3 && lower.endsWith("s") && !lower.endsWith("ss") ? lower.slice(0, -1) : lower;
}
