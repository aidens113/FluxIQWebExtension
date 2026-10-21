// The detail line as the overlay draws it under the headline: never the
// headline again, either way round.
//
// Core's `isHeadlineEcho` (`fluxiq/ui`) drops a detail that is the headline,
// or only its start ("Waiting for you" under "Waiting for you: finish the
// check on the page"). Round 5 of the breadth reruns still read "Build failed |
// Build failed: FluxIQ could not finish the Flow…": a detail that opens with
// the headline and adds something is not an echo, so it was drawn whole, the
// headline twice. Here such a detail keeps what it adds ("FluxIQ could not
// finish the Flow"), and a detail that only repeats what the headline says
// after its colon ("Finish the check on the page" under "Waiting for you:
// finish the check on the page") is not drawn.
//
// Words are compared as `isHeadlineEcho` compares them: without case,
// punctuation or the small words ("your", "the", "a", "an"). Pure: no DOM.

import { isHeadlineEcho } from "../../shared/activity";

const FILLER = new Set(["your", "the", "a", "an"]);
const WORD = /[\p{L}\p{N}]+/gu;
/** What may stand between the headline's words and what the detail adds. */
const JOIN = /^[\s:;,.!?|—–-]+/u;

type Word = { readonly word: string; readonly end: number };

/** `detail` without any part of it that only says `headline` again; "" when nothing is left. */
export function detailBesideHeadline(headline: string, detail: string): string {
  if (detail === "" || isHeadlineEcho(headline, detail)) return "";
  const said = wordsOf(detail);
  if (said.length === 0) return detail;
  const colon = headline.indexOf(":");
  if (colon >= 0 && sameWords(said, wordsOf(headline.slice(colon + 1)))) return "";
  const heading = wordsOf(headline);
  if (heading.length === 0 || said.length < heading.length || !heading.every((word, index) => said[index]!.word === word.word)) return detail;
  const added = detail.slice(said[heading.length - 1]!.end).replace(JOIN, "");
  return added === "" ? "" : `${added.charAt(0).toUpperCase()}${added.slice(1)}`;
}

/** The words of `text`, lower case, without the small words, each with where it ends in `text`. */
function wordsOf(text: string): Word[] {
  const words: Word[] = [];
  for (const match of text.matchAll(WORD)) {
    const word = match[0].toLowerCase();
    if (!FILLER.has(word)) words.push({ word, end: match.index + match[0].length });
  }
  return words;
}

function sameWords(left: readonly Word[], right: readonly Word[]): boolean {
  return left.length > 0 && left.length === right.length && left.every((word, index) => word.word === right[index]!.word);
}
