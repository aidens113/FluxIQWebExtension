// Which of a pager's numbered page controls is the page already showing: the
// one rule `readPager`, `currentPageNumber` and `followingPageControl`
// (`./pager-reading.ts`) all decide it by, so a next-page step, the page it
// reports, and a numbered step never disagree about where the list is.
//
// Only numbers, addresses and class lists are read, and only to compare them:
// no word of the page is carried anywhere.

import { leadsToThisPage } from "./page-address";

/** What a pager's page controls are. */
const PAGE_CONTROL = 'a[href],button,[role="link"],[role="button"]';

/**
 * The element among `candidates` that is the page already showing, or
 * `undefined` when the pager does not say. Tried in this order, the first that
 * names one deciding:
 *
 * 1. **`aria-current`**, on the element or on the control it is drawn as: the
 *    pager says so itself.
 * 2. **The one number that is not a control**, which is how a pager draws the
 *    page you are on among links (`<b>2</b>`). Before rule 3: a script-driven
 *    pager whose address never changes draws page 2 as plain text while its
 *    link "1" still leads to the document showing, and rule 3 first would read
 *    page 1 (lane 2 lead, review of run-mvd0pbn9-bad36023's fix).
 * 3. **A numbered link to the document already showing.** A pager that marks
 *    nothing still draws the current page as a link to itself (t194-w26 G5),
 *    and that link may leave out the empty parameters the address of a
 *    search's landing page carries (`sameDocument`, run-mvd0pbn9-bad36023).
 * 4. **The one numbered control styled apart**: exactly one whose class list
 *    differs, while the others -- at least two -- share one identical class
 *    list. A pager that draws every number as a link to its page, the current
 *    one included, marks it only by an extra class; with nothing else to read,
 *    no current page was found, and the step pressed a script's Next that did
 *    nothing rather than the following number (run-mvd0pbn9-bad36023). At
 *    least two alike is what makes one of them the odd one out rather than
 *    simply one of two.
 *
 * A candidate is a page number (its whole text is a number), or for rule 1 any
 * control: a pager may mark its current page with a label rather than a bare
 * number, and the caller then counts on from its position.
 */
export function currentPage(candidates: readonly Element[]): Element | undefined {
  const marked = candidates.find((candidate) => isCurrentPage(candidate) || isCurrentPage(pageControlOf(candidate) ?? candidate));
  if (marked !== undefined) return marked;
  const numbered = candidates.filter((candidate) => pageNumber(candidate) !== undefined);
  return onlyOne(numbered.filter((candidate) => pageControlOf(candidate) === undefined))
    ?? numbered.find(linksToThisPage)
    ?? styledApart(numbered);
}

/**
 * The control a page number is drawn as: itself or the control around it, or
 * the one inside it when a pager's item wraps its link (`<li><a>2</a></li>`);
 * `undefined` when the number is not a control at all.
 */
export function pageControlOf(element: Element): Element | undefined {
  return element.closest(PAGE_CONTROL) ?? element.querySelector(PAGE_CONTROL) ?? undefined;
}

/** The page number a control shows as its whole text, or `undefined` when it shows something else. */
export function pageNumber(control: Element): number | undefined {
  const text = (control.textContent ?? "").trim();
  return /^\d+$/u.test(text) ? Number(text) : undefined;
}

function isCurrentPage(control: Element): boolean {
  const current = control.getAttribute("aria-current");
  return current !== null && current !== "false";
}

/** A page number drawn as a link to the document already showing (rule 3). */
function linksToThisPage(candidate: Element): boolean {
  const control = pageControlOf(candidate) ?? candidate;
  return control instanceof HTMLElement && leadsToThisPage(control);
}

/** The one numbered control whose class list differs from the identical one the others, at least two, share (rule 4). */
function styledApart(numbered: readonly Element[]): Element | undefined {
  const styles = new Map<string, Element[]>();
  for (const candidate of numbered) {
    const control = pageControlOf(candidate);
    if (control === undefined) continue;
    const style = classListOf(control);
    styles.set(style, [...(styles.get(style) ?? []), candidate]);
  }
  if (styles.size !== 2) return undefined;
  const [first, second] = [...styles.values()];
  if (first === undefined || second === undefined) return undefined;
  const [apart, alike] = first.length === 1 ? [first, second] : [second, first];
  return apart.length === 1 && alike.length >= 2 ? apart[0] : undefined;
}

/** A control's classes, in a fixed order, so two lists that hold the same classes read as one. */
function classListOf(control: Element): string {
  return (control.getAttribute("class") ?? "").split(/\s+/u).filter((name) => name !== "").sort().join(" ");
}

function onlyOne<T>(items: readonly T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
}
