import { feedBatch, type ComposedFeed } from "../catalog/index.js";
import { cardMarkup, type CardLayout } from "./card.js";
import type { ClassSheet } from "./classes.js";

/** One batch's cards, as the feed sends them and the page appends them. */
export function batchMarkup(feed: ComposedFeed, index: number, sheet: ClassSheet, layout: CardLayout): string {
  return feedBatch(feed, index).map((entry) => cardMarkup(entry, sheet, layout)).join("\n");
}

/**
 * What follows the last batch. The real results simply stop -- there is no
 * "that's everything" line -- and "Results outside your search" follows at
 * once with more cards of the same component, which is where a read that
 * does not know where the results end keeps going.
 */
export function outsideMarkup(feed: ComposedFeed, sheet: ClassSheet, layout: CardLayout): string {
  const c = sheet.names;
  if (feed.outside.length === 0) return `<div class="${c.feedEnd}">No more listings</div>`;
  const cards = feed.outside.map((listing) => cardMarkup({ kind: "listing", listing }, sheet, layout)).join("\n");
  return `<h3 class="${c.outsideHead}">Results outside your search</h3>
<div class="${c.resultsCount}">These listings don't match all of your filters.</div>
<div class="${layout === "grid" ? c.grid : c.list}">${cards}</div>`;
}
