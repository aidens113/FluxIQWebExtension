import { escapeHtml } from "../../../../html.js";
import { SEARCH_PARAMS, STORE_PATHS, resultsPage, searchCatalog, type SearchQuery } from "../../catalog/index.js";
import { searchScript } from "../../client/index.js";
import { filterRail } from "./filter-rail.js";
import type { PageKit } from "../page-kit.js";
import { paginationMarkup } from "./pagination.js";
import { resultCard } from "./result-card.js";
import { resultsMarkup } from "./results-markup.js";
import { storePage } from "../shell.js";

const SORTS: ReadonlyArray<readonly [SearchQuery["sort"], string]> = [["featured", "Featured"], ["price-asc", "Price: Low to High"], ["price-desc", "Price: High to Low"], ["review", "Avg. Customer Review"]];

/** What the results bar says, which is also the page fact the manifest checks. */
function countText(rangeStart: number, rangeEnd: number, total: number | "over 1,000", keywords: string): string {
  if (total === 0) return `No results for "${keywords}"`;
  return `${rangeStart}-${rangeEnd} of ${total === "over 1,000" ? total : total.toLocaleString("en-US")} results for "${keywords}"`;
}

/**
 * A results page. The results themselves arrive in a template and are
 * rendered by the page's script after a moment; until then the list holds
 * placeholder cards that carry the same container attributes as real ones
 * and no content. The last few results of the page load only when the bottom
 * of the list scrolls into view. Under the list sits a "frequently viewed"
 * widget of products that are not results, then the pager.
 */
export function renderSearchPage(kit: PageKit, query: SearchQuery): string {
  const { css, ids, state } = kit;
  const outcome = searchCatalog(query);
  const page = resultsPage(outcome, query.page);
  const href = SEARCH_PARAMS.href({ ...query, page: page.page });
  const moreHref = href.replace(STORE_PATHS.search, STORE_PATHS.searchMore);
  const sort = `<form method="get" action="${STORE_PATHS.search}"><label for="${ids.sort}">Sort by:</label> <select class="${css.sortSelect}" id="${ids.sort}" name="s">${SORTS.map(([value, label]) =>
    `<option value="${value}" data-href="${escapeHtml(SEARCH_PARAMS.href({ ...query, sort: value, page: 1 }))}"${value === query.sort ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></form>`;
  const skeletons = Array.from({ length: 8 }, () => `<div class="${css.skeleton}" data-component="search-result" aria-hidden="true"><div class="${css.skelBlock}"></div><div class="${css.skelBlock}"></div><div class="${css.skelBlock}"></div></div>`).join("");
  const widget = outcome.alsoViewed.length === 0 ? "" : `<div class="${css.widget}" role="region" aria-label="Customers frequently viewed"><p class="${css.carouselHead}">Customers frequently viewed | Popular products in the last 7 days</p><ul class="${css.carouselTrack}">${outcome.alsoViewed.map((product) => resultCard(css, product, { kind: "widget" })).join("")}</ul></div>`;
  const results = page.organic.length === 0
    ? `<div class="${css.noResults}"><p>No results for <strong>${escapeHtml(query.keywords)}</strong>.</p><p>Try checking your spelling or use more general terms.</p></div>`
    : `<div class="${css.results}" id="${ids.results}" role="list" aria-label="Results" aria-busy="true">${skeletons}</div>
<template id="${ids.resultsTemplate}">${resultsMarkup(css, ids, outcome, page, "eager", moreHref)}</template>`;
  const body = `<div class="${css.resultsBar}"><span data-testid="result-count">${escapeHtml(countText(page.rangeStart, page.rangeEnd, outcome.total, query.keywords))}</span>${sort}</div>
<div class="${css.searchLayout}">${filterRail(css, ids, query, outcome)}<div>${results}${widget}${paginationMarkup(css, query, page)}</div></div>`;
  const dealWheel = state.mode === "deal-wheel" && state.nudges.dealWheel === "pending" && page.organic.length > 0;
  return storePage(kit, {
    title: `Brightaisle.com : ${query.keywords}`,
    body,
    script: searchScript(css, ids, { dealWheel }),
    keywords: query.keywords,
    department: query.department,
  });
}
