import { testIdFor } from "../../describe-element";
import { isSensitiveFormControl } from "../../element-traits";
import { textOutsideSensitiveControls } from "../../sensitive-text";
import { statedMoreTightly } from "../value-statement";
import { isTextLeaf } from "./text-leaf";

/** More words-holding elements than this inside a link make it a card rather than a title. */
const MAX_LINK_TEXT_LEAVES = 2;

/**
 * Whether a link's own words are a column of their own.
 *
 * **Until 2026-09-28 they never were.** An `<a href>` offered one source, its
 * URL, and nothing else, so on a listing whose title is `h2 > a` -- most of
 * them -- the only column that held the title held its address. Live run
 * `run-mulwm2dc-0bd95f22` mapped `title` to it, stored twelve rows of URLs, and
 * its verifier said exactly that; the re-author, choosing from the same
 * columns, could not fix it, because no column held the words.
 *
 * A link with no words (an image link) offers none. Nor does one whose words
 * are all one descendant's that is offered on its own -- `<a><span>Title
 * </span></a>` already proposes the span -- so the same value is not put in
 * front of the model twice under two labels -- nor does one inside an element
 * with a test id that says the same words, as the catalog's
 * `<h3 data-testid="product-name"><a data-testid="product-link">` does, since the
 * heading is already offered by its id. Nor does a link that wraps a whole
 * card: its words are every value on the card run together, which is no column
 * at all, and each of those values is offered on its own. The words are read
 * through the one sensitive-text reader, only to decide this, and never carried
 * anywhere.
 *
 * **A mark inside the link is not the link's words, and until 2026-11-27 it
 * was** (t1077). A title link holding a styled "New listing" label before the
 * title span had words that were no single span's, so on the labelled cards
 * the link's words were offered: the label and the title glued together, beside
 * the clean title, under the same first-card sample (`run-mwyt3s48-b943f344`).
 * Now the spans `marked` names -- word marks over the run
 * (`../item-mark/word-mark.ts`), which are offered as columns of their own --
 * are left out first, and a link whose remaining words are one span's offers
 * only its URL. A link with words of its own -- a highlighted search word in a
 * sentence, a title split over two spans that vary -- keeps its words column.
 * `marked` is asked only of a link whose words are not already one span's.
 */
export function offersOwnText(item: Element, link: Element, marked: (leaf: Element) => boolean): boolean {
  const words = collapsed(textOutsideSensitiveControls(link));
  if (words === "" || statedMoreTightly(item, link)) return false;
  const leaves = Array.from(link.querySelectorAll("*")).filter(isTextLeaf);
  if (leaves.length > MAX_LINK_TEXT_LEAVES) return false;
  if (leaves.some((inner) => collapsed(textOutsideSensitiveControls(inner)) === words)) return false;
  for (let outer = link.parentElement; outer && outer !== item; outer = outer.parentElement) {
    if (testIdFor(outer) !== undefined && collapsed(textOutsideSensitiveControls(outer)) === words) return false;
  }
  const marks = new Set(leaves.filter(marked));
  if (marks.size === 0) return true;
  const own = unmarkedWords(link, marks);
  return own !== "" && !leaves.some((inner) => !marks.has(inner) && collapsed(textOutsideSensitiveControls(inner)) === own);
}

/**
 * The link's words with each marked span left out, collapsed, and with every
 * subtree rooted at a sensitive control left out as the sensitive-text reader
 * leaves it out. Only compared, never carried.
 */
function unmarkedWords(link: Element, marks: ReadonlySet<Element>): string {
  let text = "";
  const walk = (parent: Node): void => {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) text += child.nodeValue ?? "";
      else if (child.nodeType === Node.ELEMENT_NODE && !marks.has(child as Element) && !isSensitiveFormControl(child as Element)) walk(child);
    }
  };
  walk(link);
  return collapsed(text);
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
