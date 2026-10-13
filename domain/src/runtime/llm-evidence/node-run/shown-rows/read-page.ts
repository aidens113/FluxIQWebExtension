// Which page of a list a read read, said beside its rows (t489).
//
// Lane C round 13 (`run-mv66s8yl-fbbfa221`) moved to page 2 of the search
// results, then read the list there five times believing it was reading page 1
// ("Reading page 1 of the wireless earbuds results ..."). The read said
// `url: ...&page=2`, and in its sentence "21 records from 1 page": a count of
// the pages that one read went through, which reads as "page 1". Nothing said
// which page it was.
//
// So a read's account says it as one sentence: the page it read, with that
// page's number where its own address states one, and that the count beside it
// is not that number. The number is read only where an address states it the
// way paged lists commonly do -- a `page`, `pg`, `paged`, `pageNumber` or
// `page_number` query value, or a `/page/<n>` path segment -- and is a positive
// whole number. Anything else names no number, and the sentence says the
// address does not number it rather than guessing page 1. A `p` parameter is
// not read: on many sites it is a product, not a page.

/** Query names an address commonly states its page number in, compared without case. */
const PAGE_QUERY_NAMES: ReadonlySet<string> = new Set(["page", "pg", "paged", "pagenumber", "page_number"]);
/** A `/page/<n>` path segment. */
const PAGE_PATH = /\/page\/(\d{1,6})(?:\/|$)/iu;

/**
 * The sentence naming the page a read read, or nothing when the read names no
 * page. `pagesRead` is the read's own count of pages, said apart from it.
 */
export function webNodeReadPage(url: unknown, pagesRead: unknown): string | undefined {
  if (typeof url !== "string" || url === "") return undefined;
  const number = pageNumber(url);
  const which = number === undefined ? `the page at ${url}, whose address states no page number` : `page ${number} of the list by its address, ${url}`;
  const counted = typeof pagesRead === "number" && Number.isSafeInteger(pagesRead) && pagesRead > 0
    ? `; pagesRead (${pagesRead}) counts the pages this one read went through, not which page it was`
    : "";
  return `This read read ${which}${counted}.`;
}

/** The page number the address states, or nothing (header). */
function pageNumber(url: string): number | undefined {
  if (!URL.canParse(url)) return undefined;
  const address = new URL(url);
  for (const [name, value] of address.searchParams) {
    if (PAGE_QUERY_NAMES.has(name.toLowerCase())) return positive(value);
  }
  const path = PAGE_PATH.exec(address.pathname);
  return path === null ? undefined : positive(path[1]!);
}

function positive(text: string): number | undefined {
  if (!/^\d{1,6}$/u.test(text)) return undefined;
  const number = Number(text);
  return number > 0 ? number : undefined;
}
