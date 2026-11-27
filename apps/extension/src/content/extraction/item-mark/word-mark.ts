// A mark drawn in words: an element that says the same words on every item of
// the run that has it, on two items or more but not on all of them -- a styled
// "New listing", "Sponsored" or "Breaking" label some cards carry before their
// title.
//
// **Until 2026-11-27 such a label was read as part of the title.** The auction
// marketplace draws a listing under a day old as
// `<a><div><span class="<badge>">New listing</span><span>Title</span></div></a>`.
// The label was already a column of its own, but the link's words were offered
// too, because on a labelled card they were no single span's: they were the
// label's and the title's, read with no space between. Columns are merged over
// the run, so the two labelled cards put that glued column in front of the
// model beside the clean title, both with card 1's sample; the model chose the
// glued one, and one title of ten read "New listingKestrel 35…"
// (`run-mwyt3s48-b943f344`, t1077).
//
// So a word mark is decided over the run, as `../badge-name.ts` decides an icon
// badge's constant name: the words must be the same wherever the element is,
// and seen on at least two items, so one record's value is never taken for one.
// It is a mark, not a value, only where some items lack it -- a label every
// item carries tells no item apart -- only where its words are not an amount
// (`../value-shape.ts`), since two cards priced alike are two values, and only
// where it says a word, two letters or more in a row: a lone character is a
// letter of a word drawn one letter per span, as the same marketplace draws its
// "Sponsored" label to defeat scrapers, or an initial or a size, never a label
// drawn in words. A word
// mark is offered as a `badge` mark column (`../infer-fields.ts`), and its
// words are left out of a link's own words when inference asks whether the
// link says anything its spans do not (`../link-words/`).

import { constantBadgeName } from "../badge-name";
import { valueShape } from "../value-shape";

/** Two letters in a row, in any script: what makes a mark's words a word rather than a lone character (header). */
const WORD = /\p{L}{2}/u;

/** Whether a selector names a word mark over the run; each selector is decided once. */
export type WordMarks = (selector: string) => boolean;

/** The word-mark rule over one run (header), deciding each selector the first time it is asked. */
export function wordMarks(run: readonly Element[]): WordMarks {
  const decided = new Map<string, boolean>();
  return (selector) => {
    let marked = decided.get(selector);
    if (marked === undefined) {
      marked = namesWordMark(run, selector);
      decided.set(selector, marked);
    }
    return marked;
  };
}

/**
 * Whether the selector's element is missing from some item of the run, and
 * says the same words, a word and not an amount, in every item that has it, at
 * least two.
 * The selector is one inference built and has already run in every item, so a
 * throw here is a fault, as `constantBadgeName` holds.
 */
function namesWordMark(run: readonly Element[], selector: string): boolean {
  if (!run.some((item) => item.querySelector(selector) === null)) return false;
  const words = constantBadgeName(run, selector, undefined);
  return words !== undefined && WORD.test(words) && valueShape([words]) === undefined;
}
