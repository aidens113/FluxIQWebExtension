import { escapeHtml } from "../../../html.js";
import type { ComposedFeed, FeedQuery } from "../catalog/index.js";
import type { CardLayout } from "./card.js";
import type { ClassSheet } from "./classes.js";
import { batchMarkup, outsideMarkup } from "./feed.js";

/**
 * The results column: a heading, the listing count as it stood when the page
 * was served, and the feed with its first batch already in it.
 *
 * The count is never recomputed. Narrow the results with a filter and the
 * heading still says how many there were before, which is how the shipped
 * page behaves and why nothing should be read off it.
 */
export function resultsMarkup(sheet: ClassSheet, query: FeedQuery, feed: ComposedFeed, heading: string, layout: CardLayout): string {
  const c = sheet.names;
  const count = query.surface === "home" ? "" : `<span class="${c.resultsCount}">${feed.matchCount} listing${feed.matchCount === 1 ? "" : "s"}</span>`;
  const location = query.surface === "home" ? `<kf-location place="Kelford" radius="${query.radius}"></kf-location>` : "";
  const finished = feed.batchCount <= 1 ? outsideMarkup(feed, sheet, layout) : "";
  return `<div class="${c.resultsHead}"><h2 class="${c.resultsTitle}">${escapeHtml(heading)}</h2>${count}${location}</div>
<section class="${c.feed}" aria-label="Collection of Marketplace items">
  <div class="${layout === "grid" ? c.grid : c.list}">${batchMarkup(feed, 0, sheet, layout)}</div>
  <div class="${c.loadMore}"${feed.batchCount <= 1 ? " hidden" : ""}></div>
  ${finished}
</section>`;
}
