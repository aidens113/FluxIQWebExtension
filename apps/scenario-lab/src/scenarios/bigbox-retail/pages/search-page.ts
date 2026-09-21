import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { findProduct } from "../catalog/index.js";
import { PAGE_SIZE, runSearch, searchHref, SORT_OPTIONS, type SearchState } from "../search/index.js";
import type { BigboxState } from "../types.js";
import { resultsPaginationMarkup } from "./results-pagination.js";
import { resultsSidebarMarkup } from "./results-sidebar.js";
import { renderShell } from "../shell/index.js";
import { listingMarkup, tileDefaultsFor } from "../listing/index.js";

/** Shown under every results page, whatever was searched: more quick-add listings to land on. */
const POPULAR = ["418831402", "418832007", "402918013", "433202210", "402917655"];

/**
 * A results page: the filter sidebar, active-filter chips, the sort, the
 * listings with the page's ads among them, the pagination, and a rail of
 * popular items underneath. Under the `list-layout` experiment the listings
 * are rows of a list instead of tiles of a grid.
 */
export function renderSearchPage(state: BigboxState, context: RenderContext, search: SearchState): string {
  const results = runSearch(search, state.storeId);
  const popular = POPULAR.map((id) => findProduct(id)!.product);
  const shown = results.entries.filter((entry) => !entry.sponsored).length;
  const first = (results.page - 1) * PAGE_SIZE + 1;
  return renderShell({
    state, context, kind: "search", title: search.q === "" ? "Search" : `${search.q}`, query: search.q,
    tileDefaults: tileDefaultsFor([...results.entries.map((entry) => entry.product), ...popular], state.storeId),
    main: (c) => {
      const chips = results.state.facets.map(([group, value]) => `<a class="${c.chip}" href="${escapeHtml(searchHref({ ...results.state, facets: results.state.facets.filter(([g, v]) => g !== group || v !== value), page: 1 }))}">${escapeHtml(value)} &times;</a>`).join("");
      const sort = `<label class="${c.sortRow}">Sort by <select name="sort">${SORT_OPTIONS.map((option) => `<option value="${option.value}"${option.value === results.state.sort ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
      const listings = results.entries.map((entry) => listingMarkup(entry.product, state.storeId, c, state.mode === "list-layout" ? "row" : "grid", entry.sponsored)).join("");
      const body = search.q === ""
        ? `<p class="${c.emptyResults}">Search for something to get started.</p>`
        : results.total === 0
          ? `<p class="${c.emptyResults}">We couldn't find results for &ldquo;${escapeHtml(search.q)}&rdquo;. Check the spelling, or try fewer filters.</p>`
          : state.mode === "list-layout" ? `<ol class="${c.list}">${listings}</ol>` : `<div class="${c.grid}">${listings}</div>`;
      const meta = results.total === 0 ? "" : `<span class="${c.resultsMeta}">${first}&ndash;${first + shown - 1} of ${results.total} results</span>`;
      return `<div class="${c.searchLayout}">${resultsSidebarMarkup(results, c)}<section><div class="${c.resultsHead}"><div><h1 class="${c.resultsTitle}">Results for &ldquo;${escapeHtml(search.q)}&rdquo;</h1>${meta}</div>${sort}</div><div class="${c.chips}">${chips}</div>${body}${resultsPaginationMarkup(results, c)}</section></div>
<section class="${c.rail}"><div class="${c.railHead}"><h2>Popular in your area</h2></div><ul class="${c.railList}">${popular.map((product) => listingMarkup(product, state.storeId, c, "rail")).join("")}</ul></section>`;
    },
    script: (c) => `{
  const go = (mutateUrl) => { const url = new URL(location.href); mutateUrl(url); url.searchParams.delete('page'); location.href = url.toString(); };
  document.querySelectorAll('.${c.facetOption} input[type=checkbox]').forEach((box) => box.addEventListener('change', () => go((url) => {
    const current = (url.searchParams.get('facet') || '').split('||').filter(Boolean);
    const next = box.checked ? [...current, box.value] : current.filter((value) => value !== box.value);
    if (next.length) url.searchParams.set('facet', next.join('||')); else url.searchParams.delete('facet');
  })));
  const sort = document.querySelector('.${c.sortRow} select');
  if (sort) sort.addEventListener('change', () => go((url) => { if (sort.value === 'best_match') url.searchParams.delete('sort'); else url.searchParams.set('sort', sort.value); }));
}`,
  });
}
