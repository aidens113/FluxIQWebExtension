// Which snippets of shown text most resemble the text a wait wanted, and how
// each is cut to fit the bound (t369, `domain/src/actions/text-sighting.ts`).
//
// Pure: it is handed strings and returns strings, so it is tested in Node and
// knows nothing of the page. The page side (`sight-text.ts`) decides which
// strings are shown and safe to read.
//
// Resemblance is two measures added: how many of the wanted text's words the
// snippet holds, and how much of its character pairs it shares (a Dice
// coefficient over lowercase bigrams), so "Cart" beside "Cart (3)" ranks
// above "Your cart is empty" by the second when the first ties. A word is two
// characters or more: a lone "0" or "3" is in half the product titles on a
// shop page and says nothing about resemblance. A snippet that shares no word
// is near only when its character pairs are a good part alike
// (`MIN_PAIR_LIKENESS`), so a page of unrelated lines returns nothing rather
// than its least unlike three.

import { WEB_AUTOMATION_VISIBLE_NEAR_MAX_ITEMS, WEB_AUTOMATION_VISIBLE_NEAR_MAX_LENGTH } from "@fluxiq-web-extension/domain/client";

const ELLIPSIS = "…";
/** Characters kept before the first wanted word when a long snippet is cut around it. */
const LEAD = 20;
/** The bigram likeness a snippet sharing no word with the awaited text needs to count as near. */
const MIN_PAIR_LIKENESS = 0.35;

/** Up to three of `candidates`, most like `wanted` first, each within 80 characters; ties keep page order. */
export function nearestSnippets(wanted: string, candidates: Iterable<string>): string[] {
  const words = wordsOf(wanted);
  const pairs = bigramsOf(wanted);
  const scored: Array<{ text: string; score: number; order: number }> = [];
  const seen = new Set<string>();
  let order = 0;
  for (const raw of candidates) {
    const text = raw.replace(/\s+/gu, " ").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const score = resemblance(words, pairs, text);
    if (score !== undefined) scored.push({ text, score, order: order++ });
  }
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  const chosen: string[] = [];
  for (const { text } of scored) {
    const cut = bounded(text, words);
    if (!chosen.includes(cut)) chosen.push(cut);
    if (chosen.length === WEB_AUTOMATION_VISIBLE_NEAR_MAX_ITEMS) break;
  }
  return chosen;
}

/** How alike the snippet is to the awaited text, or `undefined` when it is not near at all. */
function resemblance(words: readonly string[], pairs: ReadonlyMap<string, number>, text: string): number | undefined {
  const own = new Set(wordsOf(text));
  const sharedWords = words.length ? words.filter((word) => own.has(word)).length / words.length : 0;
  const likeness = dice(pairs, bigramsOf(text));
  if (sharedWords === 0 && likeness < MIN_PAIR_LIKENESS) return undefined;
  return sharedWords + likeness;
}

function dice(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
  let total = 0;
  let shared = 0;
  for (const count of a.values()) total += count;
  for (const [pair, count] of b) {
    total += count;
    shared += Math.min(count, a.get(pair) ?? 0);
  }
  return total === 0 ? 0 : (2 * shared) / total;
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 2);
}

function bigramsOf(text: string): Map<string, number> {
  const flat = text.toLowerCase().replace(/\s+/gu, " ").trim();
  const pairs = new Map<string, number>();
  for (let index = 0; index < flat.length - 1; index += 1) {
    const pair = flat.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  return pairs;
}

/** The snippet whole when it fits; otherwise a window starting a little before the first wanted word, marked where it was cut. */
function bounded(text: string, words: readonly string[]): string {
  const max = WEB_AUTOMATION_VISIBLE_NEAR_MAX_LENGTH;
  if (text.length <= max) return text;
  const lower = text.toLowerCase();
  const hits = words.map((word) => lower.indexOf(word)).filter((index) => index >= 0);
  const first = hits.length ? Math.min(...hits) : 0;
  let start = Math.max(0, Math.min(first - LEAD, text.length - (max - 1)));
  if (start === 1) start = 0;
  const lead = start > 0 ? ELLIPSIS : "";
  const room = max - lead.length;
  const body = text.slice(start, start + room);
  if (start + room >= text.length) return `${lead}${body}`;
  return `${lead}${body.slice(0, room - 1)}${ELLIPSIS}`;
}
