// Reading a pager for a move to the next page (`../page-advance/`): which page
// is current, which control is the page after it, and whether the pager shows
// any later page. Split out of `pagination.ts` (t194, 2026-10-01) when lane C's
// and lane D's paging changes together took it past its line limit; the rules
// these implement are said in the page-advance module's files. Which page is
// current is one rule for all three readers (`./current-page.ts`), and where a
// control leads is `./page-address.ts`.
//
// Only numbers and addresses are read, and only to compare and report them: no
// word of the page is carried anywhere.

import { currentPage, pageControlOf, pageNumber } from "./current-page";

/** What the pager beside a `next` control says: the current page's number, the control for the page after it, and whether it shows any later page at all. */
export type PagerReading = { current: number; following: HTMLElement | undefined; later: boolean };

/**
 * The pager beside a `next` control, read for the page after the current one:
 * `current` is the current page's number (what a next-page step reports it
 * moved to), `following` its enabled control numbered one more than that,
 * and `later` whether it shows any page numbered higher -- a control or not, so
 * a pager that skips to its last page still says the list goes on.
 * `undefined` when the pager does not say which page is current
 * (`currentPage`). Only numbers are read, and only to compare them, so no word
 * of the page is carried anywhere.
 */
export function readPager(next: HTMLElement): PagerReading | undefined {
  let pager: Element | null = next.parentElement;
  for (let depth = 0; pager && depth < PAGER_LEVELS; depth += 1, pager = pager.parentElement) {
    const numbered = Array.from(pager.querySelectorAll("*")).filter((element) => element.children.length === 0 && pageNumber(element) !== undefined);
    const current = currentPage(numbered);
    const number = current === undefined ? undefined : pageNumber(current);
    if (number === undefined) continue;
    const following = numbered.map(pageControlOf).find((control) => control !== undefined && pageNumber(control) === number + 1);
    return {
      current: number,
      following: following instanceof HTMLElement && !isDisabled(following) ? following : undefined,
      later: numbered.some((element) => (pageNumber(element) ?? 0) > number)
    };
  }
  return undefined;
}

/** How far out from a `next` control its pager is looked for. */
const PAGER_LEVELS = 3;

/** The page control that follows the current page, or `undefined` when the list has no further page. */
export function followingPageControl(controls: readonly Element[], pagesRead: number): Element | undefined {
  const current = currentPage(controls);
  if (!current) {
    // Nothing says which page is current: count the numbers, not the controls (see the header).
    const numbered = controls.filter((control) => pageNumber(control) !== undefined);
    if (numbered.length === 0) return controls[pagesRead];
    return numbered.find((control) => pageNumber(control) === pagesRead + 1) ?? numbered[pagesRead];
  }
  const number = pageNumber(current);
  if (number === undefined) return controls[controls.indexOf(current) + 1];
  return controls.find((control) => pageNumber(control) === number + 1);
}

/**
 * The number of the page `controls` mark current (`currentPage`), or
 * `undefined` when none of them says. A next-page step counts on from it
 * (`../page-advance/`), since one step carries no count of the pages before.
 */
export function currentPageNumber(controls: readonly Element[]): number | undefined {
  const current = currentPage(controls);
  return current === undefined ? undefined : pageNumber(current);
}

export function isDisabled(control: Element): boolean {
  return control.matches(":disabled") || control.getAttribute("aria-disabled") === "true";
}
