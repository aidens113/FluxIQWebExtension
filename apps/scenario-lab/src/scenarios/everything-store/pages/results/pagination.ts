import { escapeHtml } from "../../../../html.js";
import { SEARCH_PARAMS, type ResultsPage, type SearchQuery } from "../../catalog/index.js";
import type { StoreClasses } from "../../style/index.js";

/** The page numbers a pager shows: the first three, the current one and its neighbours, and the last. */
function shownPages(current: number, count: number): number[] {
  const pages = new Set<number>([1, 2, 3, current - 1, current, current + 1, count]);
  return [...pages].filter((page) => page >= 1 && page <= count).sort((left, right) => left - right);
}

/**
 * The pager under the results. It has a bug the store never fixed: on page
 * two, Next links to page two again, while still announcing itself as the way
 * to page three. A shopper who notices goes on by page number.
 */
export function paginationMarkup(css: StoreClasses, query: SearchQuery, page: ResultsPage): string {
  if (page.pageCount <= 1) return "";
  const at = (target: number) => escapeHtml(SEARCH_PARAMS.href({ ...query, page: target }));
  const previous = page.page > 1
    ? `<a class="${css.pageLink}" href="${at(page.page - 1)}" aria-label="Go to previous page, page ${page.page - 1}">Previous</a>`
    : `<span class="${css.pageDisabled}" aria-disabled="true">Previous</span>`;
  const nextTarget = page.page === 2 ? 2 : page.page + 1;
  const next = page.page < page.pageCount
    ? `<a class="${css.pageLink}" href="${at(nextTarget)}" aria-label="Go to next page, page ${page.page + 1}">Next</a>`
    : `<span class="${css.pageDisabled}" aria-disabled="true">Next</span>`;
  const numbers: string[] = [];
  let last = 0;
  for (const target of shownPages(page.page, page.pageCount)) {
    if (target > last + 1) numbers.push(`<span class="${css.pageGap}" aria-hidden="true">&hellip;</span>`);
    numbers.push(target === page.page
      ? `<span class="${css.pageCurrent}" aria-current="page" aria-label="Current page, page ${target}">${target}</span>`
      : `<a class="${css.pageLink}" href="${at(target)}" aria-label="Go to page ${target}">${target}</a>`);
    last = target;
  }
  return `<nav class="${css.pagination}" role="navigation" aria-label="pagination">${previous}${numbers.join("")}${next}</nav>`;
}
