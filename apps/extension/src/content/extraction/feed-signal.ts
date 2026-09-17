// Whether the page itself says a list is an infinite feed.
//
// `detect-pagination.ts` never proposes `scroll`, and for a good reason: an
// infinite feed looks like any list that happens to end, so guessing would
// propose scrolling every list on the page. What a page can do is say so. The
// ARIA feed pattern is that statement: a `role="feed"` container, and articles
// whose `aria-setsize` is `-1` because the total is not known yet. Only those
// two are read -- no sentinel element, no "loading more" text, no scroll
// probe -- so a list is reported as a feed only when its author declared one.
//
// Structure-detection answers (`detect-structure.ts`) carry the signal beside
// the proposal, never inside it, and only when no pagination control was
// found: a feed with a Load more button pages by the button.

/** How far out from the run's container a `role="feed"` is looked for; the pagination search goes as far. */
const MAX_FEED_ANCESTOR_LEVELS = 6;

/** Whether the run's items or the elements holding them declare the ARIA feed pattern. */
export function isDeclaredFeed(items: readonly Element[], container: Element | null): boolean {
  if (items.some((item) => item.getAttribute("aria-setsize")?.trim() === "-1")) return true;
  let level: Element | null = container;
  for (let depth = 0; level && depth < MAX_FEED_ANCESTOR_LEVELS; depth += 1, level = level.parentElement) {
    if ((level.getAttribute("role") ?? "").toLowerCase().split(/\s+/u).includes("feed")) return true;
  }
  return false;
}
