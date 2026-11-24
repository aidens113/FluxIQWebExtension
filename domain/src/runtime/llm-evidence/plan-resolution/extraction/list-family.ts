// The family of pages a list belongs to, read off an address alone (t1022).
//
// A list is detected on one page, and the same list stands on every page drawn
// from that page's template: page 1 and page 5 of one search, the product page of
// each product a loop visits. So the family is the address's origin and its
// path's shape, the shape the route signature reads a page's path by
// (`../../../route-state/page-features.ts`): lowercased, empty segments dropped,
// a segment holding a digit read as `#`, one longer than 24 characters as `*`.
// The query and the hash are left out, as the list code leaves them out
// (`../../node-run/list-read/code.ts`): a search's terms and page number are
// not another page.
//
// Nothing here reads a page's words: an address and its parts only.

const LONG_SEGMENT = 24;

/** The family of pages `location` is one of, or `undefined` for a location that names no page (`about:blank`, `data:`, not an address). */
export function webPlanListPageFamily(location: string): string | undefined {
  if (!URL.canParse(location)) return undefined;
  const url = new URL(location);
  if (url.origin === "null") return undefined;
  const segments = url.pathname.toLowerCase().split("/").filter((segment) => segment.length > 0);
  return `${url.origin}/${segments.map((segment) => (/\d/u.test(segment) ? "#" : segment.length > LONG_SEGMENT ? "*" : segment)).join("/")}`;
}
