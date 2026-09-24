// Whether the page itself says a list holds more than it is showing.
//
// `detect-pagination.ts` never proposes `scroll`, and for a good reason: a list
// that scrolls looks like any list that happens to end, so guessing would
// propose scrolling every list on the page. What a page can do is say so, and
// there are two ways an author says it.
//
// The ARIA feed pattern is the first: a `role="feed"` container, and articles
// whose `aria-setsize` is `-1` because the total is not known yet.
//
// **A declared row count is the second, and it was not read.** A virtualised
// grid does not use the feed pattern -- it says `role="grid"` and
// `aria-rowcount`, which is the count of rows that exist rather than the count
// mounted. On 2026-09-24 `admin-console-customer-book` was asked for the
// customer book and returned 19 records of 240, starting at `CUS-0005` rather
// than `CUS-0001` (`run-muf1xufy-ecea7867`): the window that happened to be
// mounted, read from wherever the list was standing. The page had said
// `aria-rowcount="240"` over a viewport holding 19, and nothing looked.
//
// That is the same kind of statement as the feed pattern and is treated the
// same way: an author saying the list is longer than the document shows. It is
// still never a guess -- no sentinel element, no "loading more" text, no scroll
// probe -- and a count that is absent, unparseable, `-1` (unknown) or no larger
// than what is mounted says nothing and is not read as a signal.
//
// Structure-detection answers (`detect-structure.ts`) carry the signal beside
// the proposal, never inside it, and only when no pagination control was
// found: a feed with a Load more button pages by the button.

/** How far out from the run's container a `role="feed"` is looked for; the pagination search goes as far. */
const MAX_FEED_ANCESTOR_LEVELS = 6;

/** Whether the run's items or the elements holding them say the list holds more than it shows. */
export function isDeclaredFeed(items: readonly Element[], container: Element | null): boolean {
  if (items.some((item) => item.getAttribute("aria-setsize")?.trim() === "-1")) return true;
  let level: Element | null = container;
  for (let depth = 0; level && depth < MAX_FEED_ANCESTOR_LEVELS; depth += 1, level = level.parentElement) {
    const role = (level.getAttribute("role") ?? "").toLowerCase().split(/\s+/u);
    if (role.includes("feed")) return true;
    if (declaresMoreRowsThanMounted(level, items.length)) return true;
  }
  return false;
}

/**
 * Whether this element declares more rows than the run has mounted.
 *
 * `aria-rowcount` is the count of rows that exist, which is the whole point of
 * declaring it: a grid that renders all of its rows has no reason to. So a
 * count larger than the run in the document is the author saying the rest is
 * reachable, and a count equal to it is a grid that is simply all there.
 *
 * `-1` is ARIA's "not known", which says nothing about whether more exist, and
 * anything unparseable is not a declaration at all.
 */
function declaresMoreRowsThanMounted(element: Element, mounted: number): boolean {
  const declared = element.getAttribute("aria-rowcount");
  if (declared === null) return false;
  const rows = Number.parseInt(declared.trim(), 10);
  return Number.isSafeInteger(rows) && rows > mounted;
}
