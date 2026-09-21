import { categoryBySlug, composeFeed, type FeedQuery } from "../catalog/index.js";
import { FEED_SCRIPT, LOCATION_ELEMENT_SCRIPT } from "../client/index.js";
import type { ClassifiedsState } from "../types.js";
import { filtersMarkup, resultsMarkup, shellMarkup } from "../view/index.js";
import { classifiedsDocument, type PageBuild } from "./document.js";

/**
 * The marketplace's front page ("Today's picks"), a category, or a search: the
 * same page with the first batch of its feed already in it. Only a category
 * or a search has filters; the front page has the location picker alone.
 *
 * The `list-layout` rendering serves every feed as rows instead of tiles.
 */
export function resultsPage(build: PageBuild, state: ClassifiedsState, query: FeedQuery): string {
  const feed = composeFeed(query, build.seed);
  const layout = state.mode === "list-layout" ? "list" : "grid";
  const heading = query.surface === "home" ? "Today's picks"
    : query.surface === "category" ? (categoryBySlug(query.category ?? "")?.label ?? "Marketplace")
      : `Results for "${query.text}"`;
  const main = resultsMarkup(build.sheet, query, feed, heading, layout);
  const body = shellMarkup({
    sheet: build.sheet,
    ids: build.ids,
    state,
    section: query.surface === "home" ? "browse" : query.surface === "category" ? "category" : "other",
    ...(query.category === null ? {} : { category: query.category }),
    ...(query.surface === "home" ? {} : { sidebarExtra: filtersMarkup(build.sheet, build.ids, query) }),
    main,
  });
  const title = query.surface === "home" ? "Marketplace | Kerbfind" : `${heading} | Kerbfind Marketplace`;
  return classifiedsDocument(build, state, title, body, [LOCATION_ELEMENT_SCRIPT, FEED_SCRIPT], {
    feed: { surface: query.surface, category: query.category, next: feed.batchCount > 1 ? 1 : null, layout },
  });
}
