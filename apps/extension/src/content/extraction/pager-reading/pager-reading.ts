// Reading a pager and the addresses its controls lead to, for a move to the
// next page (`../page-advance/`): which page is current, which control is the
// page after it, whether the pager shows any later page, and whether a link
// leads back to the document already showing. Split out of `pagination.ts`
// (t194, 2026-10-01) when lane C's and lane D's paging changes together took it
// past its line limit; the rules these implement are said in the page-advance
// module's files.
//
// Only numbers and addresses are read, and only to compare and report them: no
// word of the page is carried anywhere.

import { parsedUrl } from "../../../shared/parsed-url";

/**
 * Whether the control is a link whose address is the document already showing:
 * the same page, with its query in any order, whatever its fragment. A link to
 * a fragment alone (`href="#"`) is not one, because that is how a page marks a
 * control its own script handles, and a script-driven Next is a working Next.
 */
export function leadsToThisPage(control: HTMLElement): boolean {
  const address = linkAddress(control);
  return address !== undefined && sameDocument(address, new URL(document.URL));
}

/** What the pager beside a `next` control says: the current page's number, the control for the page after it, and whether it shows any later page at all. */
export type PagerReading = { current: number; following: HTMLElement | undefined; later: boolean };

/**
 * The pager beside a `next` control, read for the page after the current one:
 * `current` is the current page's number (what a next-page step reports it
 * moved to), `following` its enabled control numbered one more than that,
 * and `later` whether it shows any page numbered higher -- a control or not, so
 * a pager that skips to its last page still says the list goes on.
 * `undefined` when the pager does not say which page is current.
 *
 * The current page is the number marked `aria-current`, or the one number the
 * pager shows as something other than a control -- which is how a pager draws
 * the page you are on (`<b>2</b>` among links). Only numbers are read, and only
 * to compare them, so no word of the page is carried anywhere.
 */
export function readPager(next: HTMLElement): PagerReading | undefined {
  let pager: Element | null = next.parentElement;
  for (let depth = 0; pager && depth < PAGER_LEVELS; depth += 1, pager = pager.parentElement) {
    const numbered = Array.from(pager.querySelectorAll("*")).filter((element) => element.children.length === 0 && pageNumber(element) !== undefined);
    const current = numbered.find((element) => isCurrentPage(element) || isCurrentPage(element.closest(PAGE_CONTROL) ?? element))
      ?? onlyOne(numbered.filter((element) => !isControl(element)));
    const number = current === undefined ? undefined : pageNumber(current);
    if (number === undefined) continue;
    const following = numbered.map((element) => element.closest(PAGE_CONTROL) ?? element).find((element) => isControl(element) && pageNumber(element) === number + 1);
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

/** What a pager's page controls are. */
const PAGE_CONTROL = 'a[href],button,[role="link"],[role="button"]';

function isControl(element: Element): boolean {
  return element.matches(PAGE_CONTROL) || element.closest(PAGE_CONTROL) !== null;
}

function onlyOne<T>(items: readonly T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
}

/** The page control that follows the current page, or `undefined` when the list has no further page. */
export function followingPageControl(controls: readonly Element[], pagesRead: number): Element | undefined {
  const current = controls.find(isCurrentPage) ?? controls.find(linksToThisPage);
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
 * The number of the page `controls` mark current -- `aria-current`, or the
 * numbered control that links to the document already showing -- or
 * `undefined` when none of them says. A next-page step counts on from it
 * (`../page-advance/`), since one step carries no count of the pages before.
 */
export function currentPageNumber(controls: readonly Element[]): number | undefined {
  const current = controls.find(isCurrentPage) ?? controls.find(linksToThisPage);
  return current === undefined ? undefined : pageNumber(current);
}

/** A numbered page control that is a link to the document already showing: a pager's current page when nothing is marked. */
function linksToThisPage(control: Element): boolean {
  return pageNumber(control) !== undefined && control instanceof HTMLElement && leadsToThisPage(control);
}

function isCurrentPage(control: Element): boolean {
  const current = control.getAttribute("aria-current");
  return current !== null && current !== "false";
}

/** The page number a control shows as its whole text, or `undefined` when it shows something else. */
function pageNumber(control: Element): number | undefined {
  const text = (control.textContent ?? "").trim();
  return /^\d+$/u.test(text) ? Number(text) : undefined;
}

export function isDisabled(control: Element): boolean {
  return control.matches(":disabled") || control.getAttribute("aria-disabled") === "true";
}

/**
 * Where the control goes when it is a link to a page: its `href` resolved
 * against its base, when that is http or https. `undefined` for anything else,
 * and for a link to a fragment alone, which a page's own script handles.
 */
export function linkAddress(control: HTMLElement): URL | undefined {
  const link = control.closest("a[href]");
  const href = link?.getAttribute("href")?.trim();
  // An address that does not parse is not a link to a page, which is what
  // `undefined` means here.
  if (!link || !href || href.startsWith("#")) return undefined;
  const url = parsedUrl(href, link.baseURI);
  if (!url) return undefined;
  return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
}

/** Whether two addresses load the same document: origin, path and query alike, the query in any order, the fragment ignored. */
export function sameDocument(left: URL, right: URL): boolean {
  return left.origin === right.origin && left.pathname === right.pathname && sortedQuery(left) === sortedQuery(right);
}

function sortedQuery(url: URL): string {
  const params = [...url.searchParams.entries()].sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  return new URLSearchParams(params).toString();
}
