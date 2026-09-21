import { escapeHtml } from "../../../html.js";
import { SITE_ROOT } from "../catalog/index.js";
import { searchHref, type SearchResults } from "../search/index.js";
import type { BigboxClasses } from "../theme/index.js";

/**
 * Previous, the page numbers, and Next. The numbers and Previous keep every
 * filter and the sort. Next is built by an older helper that knows only the
 * query and the page, so on a filtered or re-sorted result set it silently
 * drops both and lands on the next page of everything.
 */
export function resultsPaginationMarkup(results: SearchResults, c: BigboxClasses): string {
  if (results.pageCount <= 1) return "";
  const { page, pageCount, state } = results;
  const numbers = Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (number === page
    ? `<a class="${c.pageLink} ${c.pageCurrent}" aria-current="page" href="${escapeHtml(searchHref({ ...state, page: number }))}">${number}</a>`
    : `<a class="${c.pageLink}" href="${escapeHtml(searchHref({ ...state, page: number }))}">${number}</a>`)).join("");
  const previous = page > 1 ? `<a class="${c.pageArrow}" href="${escapeHtml(searchHref({ ...state, page: page - 1 }))}" aria-label="Previous page">&lsaquo;</a>` : `<span class="${c.pageArrowOff}" aria-hidden="true">&lsaquo;</span>`;
  const next = page < pageCount ? `<a class="${c.pageArrow}" href="${escapeHtml(`${SITE_ROOT}search?q=${encodeURIComponent(state.q)}&page=${page + 1}`)}" aria-label="Next page">&rsaquo;</a>` : `<span class="${c.pageArrowOff}" aria-hidden="true">&rsaquo;</span>`;
  return `<nav class="${c.pagination}" aria-label="Pagination">${previous}${numbers}${next}</nav>`;
}
