// Whether one address is another row's, by the shape of the row's own link.
//
// A row's values carry its link when the read read one. A page or a link of the
// very shape of that link, with one path segment different, is the same template
// on another item: `/item/1003/` beside a row whose link is `/item/1054/`. It takes
// the same origin, the same number of segments, the same first segment on a longer
// path, and the differing segment of one kind (an id beside an id, not `saved`
// beside `1054`), or, on one path, the same query keys with other values.
//
// A site's own page may answer a link at a fuller address (`/p/123` at
// `/p/123-oak-table`), so a segment that begins with the other, up to a word's end,
// is the same item.

import { normalizedText } from "../../identity";
import { parsedUrl } from "../../../shared/parsed-url";

const LINK_SHAPED = /^(?:https?:\/\/|\/)/iu;
const HAS_LETTER = /\p{L}/u;

/** The link among a row's values, resolved: the first that reads as an address. */
function rowLink(values: readonly string[], base: string | undefined): URL | undefined {
  for (const value of values) {
    if (!LINK_SHAPED.test(value)) continue;
    const parsed = parsedUrl(value, base);
    if (parsed && (parsed.protocol === "http:" || parsed.protocol === "https:")) return parsed;
  }
  return undefined;
}

const segmentsOf = (url: URL): string[] => url.pathname.split("/").filter(Boolean);

/** One segment names the other's item, the rest of it being words a site adds. */
function sameItem(one: string, other: string): boolean {
  const [short, long] = one.length <= other.length ? [one, other] : [other, one];
  return long === short || (long.startsWith(short) && !/[\p{L}\p{N}]/u.test(long.charAt(short.length)));
}

/** Whether `address` is the same template as `row`, on another item (header). */
function anotherItem(address: URL, row: URL): boolean {
  if (address.origin !== row.origin) return false;
  const [mine, theirs] = [segmentsOf(address), segmentsOf(row)];
  if (mine.length !== theirs.length) return false;
  const differing = mine.flatMap((segment, index) => (sameItem(segment, theirs[index] as string) ? [] : [index]));
  if (differing.length === 0) {
    const keys = (url: URL): string => [...new Set(url.searchParams.keys())].sort().join("&");
    return address.search !== row.search && keys(address) !== "" && keys(address) === keys(row);
  }
  if (differing.length !== 1) return false;
  const at = differing[0] as number;
  if (at === 0 && mine.length > 1) return false;
  return /\d/u.test(mine[at] as string) === /\d/u.test(theirs[at] as string);
}

/** What a link element is pointing at, resolved against its page. */
function linkOf(element: Element, base: string | undefined): URL | undefined {
  const href = element.getAttribute("href");
  return href ? parsedUrl(href, base) : undefined;
}

/** The address this page's relative links resolve against, where there is a page to ask. */
function pageBase(): string | undefined {
  return typeof location === "undefined" ? undefined : location.href;
}

/** How a link element stands to a pass row's own link: it is that link, another row's of its shape, or says nothing of rows. */
export function linkToRow(element: Element, values: readonly string[]): "own" | "another" | "unrelated" {
  const base = pageBase();
  const row = rowLink(values, base);
  const link = linkOf(element, base);
  if (!row || !link) return "unrelated";
  if (link.href === row.href) return "own";
  return anotherItem(link, row) ? "another" : "unrelated";
}

/** The first element of the page, of `shape`, that links to the pass row's own link. */
export function elementLinkingToRow(values: readonly string[], candidates: Iterable<Element>): Element | undefined {
  const base = pageBase();
  const row = rowLink(values, base);
  if (!row) return undefined;
  for (const candidate of candidates) {
    if (linkOf(candidate, base)?.href === row.href) return candidate;
  }
  return undefined;
}

/**
 * Whether the page in hand is another row's own page: its address is the pass row's
 * link on another item, and neither the page's title nor a main heading names the
 * row, which is what a page reached at some other address of the same item would do.
 * A row with no link says nothing here, and nor does a page with no address.
 */
export function onAnotherRowsPage(values: readonly string[]): boolean {
  const base = pageBase();
  const row = rowLink(values, base);
  if (!row || !base) return false;
  const here = parsedUrl(base);
  return here !== undefined && here.href !== row.href && anotherItem(here, row) && !pageNamesRow(values);
}

function pageNamesRow(values: readonly string[]): boolean {
  const names = values.filter((value) => !LINK_SHAPED.test(value) && HAS_LETTER.test(value)).map((value) => normalizedText(value)?.toLowerCase()).filter((value): value is string => value !== undefined);
  if (names.length === 0 || typeof document === "undefined") return false;
  const headings = [...(document.querySelectorAll?.("h1") ?? [])].map((heading) => heading.textContent ?? "");
  const said = [document.title ?? "", ...headings].map((text) => normalizedText(text)?.toLowerCase() ?? "");
  return names.some((name) => said.some((text) => text.includes(name)));
}
