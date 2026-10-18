// Where a pager's control leads, and whether that is the document already
// showing: what a move to the next page checks before it follows a link
// (`../page-advance/`), and one of the ways a pager's current page is told
// (`./current-page.ts`). Only addresses are read, and only to compare them.

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

/**
 * Whether two addresses load the same document: origin, path and query alike,
 * the query in any order, the fragment ignored, and a parameter with an empty
 * value counted as absent on either side. A search form submits every field
 * it has, so the page a search lands on carries its empty ones (`cat=`) while
 * the pager's own links leave them out; the two are one document, and a
 * comparison that told them apart missed the numbered link to the page
 * already showing (run-mvd0pbn9-bad36023).
 */
export function sameDocument(left: URL, right: URL): boolean {
  return left.origin === right.origin && left.pathname === right.pathname && sortedQuery(left) === sortedQuery(right);
}

function sortedQuery(url: URL): string {
  const params = [...url.searchParams.entries()]
    .filter(([, value]) => value !== "")
    .sort(([a, x], [b, y]) => (a === b ? (x < y ? -1 : x > y ? 1 : 0) : a < b ? -1 : 1));
  return new URLSearchParams(params).toString();
}
