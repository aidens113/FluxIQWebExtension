import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { searchResults, type SearchQuery, type ShipOrigin } from "../catalog/index.js";
import { searchScript } from "../client/index.js";
import { REGIONS } from "../locale/index.js";
import type { MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { resultCard } from "./cards.js";
import { readSearchQuery, searchHref } from "./links.js";
import { marketDocument } from "./shell.js";

/** Cards the page draws on its own a moment after load; the rest wait until the grid is scrolled to them. */
export const FIRST_BATCH = 10;

const ORIGIN_FILTERS: readonly ShipOrigin[] = ["China", "Spain", "Poland", "Czech Republic"];
const SORT_TABS = [["default", "Best Match"], ["orders", "Orders"], ["newest", "Newest"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"]] as const;
const RELATED = ["usb c hub 7 in 1", "usb c docking station", "usb hub 3.0", "type c adapter", "hdmi adapter", "laptop stand"];

/**
 * A results page. The grid arrives as skeletons: the first ten cards are
 * drawn from an inert template a moment after load, and the rest are fetched
 * when the grid is scrolled to them (`search/cards`). The header count is the
 * unfiltered one on every page, filters or not -- a stale count the live site
 * has shipped for months. Previous and the page numbers are links; Next is a
 * styled div whose handler throws, so it does nothing.
 */
export function renderSearchPage(state: MarketState, context: RenderContext, c: MarketClasses, params: URLSearchParams): string {
  const query = readSearchQuery(params, state.region);
  const results = searchResults(query);
  const layout = state.mode === "list-layout" ? "list" : "grid";
  const first = results.slots.slice(0, FIRST_BATCH).map((slot) => resultCard(slot, c, state.region, layout)).join("");
  const q = escapeHtml(query.q);
  const body = results.slots.length === 0 ? emptyResults(c, query) : `<div class="${c.searchLayout}">
${sidebar(c, query, params, REGIONS[state.region].currency)}
<section>
<div class="${c.resultsHead}"><div><div class="${c.breadcrumb}">All Categories › “${q}”</div><div class="${c.resultCount}">${results.unfilteredCount} results for “${q}”</div></div>${sortBar(c, query)}</div>
${chips(c, query)}
<div class="${layout === "list" ? c.listView : c.grid}">${results.slots.map(() => `<div class="${c.skeleton}"></div>`).join("")}</div>
<template id="fb-first-cards">${first}</template>
${pager(c, query, results.page, results.pageCount)}
<div class="${c.related}">Related searches: ${RELATED.map((text) => `<a class="${c.chip}" href="${searchHref({ q: text })}">${escapeHtml(text)}</a>`).join("")}</div>
</section>
</div>`;
  const pageData = {
    total: results.slots.length,
    firstBatch: FIRST_BATCH,
    cardsHref: `search/cards?${params.toString()}`,
    filterHrefs: [...ORIGIN_FILTERS.map((origin) => toggled(query, { shipFrom: toggleOrigin(query.shipFrom, origin) })), toggled(query, { freeShipping: !query.freeShipping }), toggled(query, { fourStars: !query.fourStars })],
    sortHrefs: SORT_TABS.map(([sort]) => searchHref({ ...hrefBase(query, params), sort, page: 1 })),
    chipHrefs: activeChips(query).map(([, change]) => toggled(query, change)),
    priceBase: searchHref({ ...hrefBase(query, params), minPrice: "", maxPrice: "", page: 1 }),
    jumpBase: searchHref({ ...hrefBase(query, params), page: 1 }),
    page: results.page,
    pageCount: results.pageCount,
  };
  return marketDocument({
    state, context, c, kind: "search", query: query.q,
    title: `${query.q} - Buy ${query.q} with free shipping on Farbazaar`,
    body,
    pageScript: `const pageData = ${JSON.stringify(pageData)};\n${searchScript()}`,
  });
}

/** The cards past the first batch, as the grid fetches them when it is scrolled to. */
export function searchCardsFragment(state: MarketState, c: MarketClasses, params: URLSearchParams): string {
  const results = searchResults(readSearchQuery(params, state.region));
  const layout = state.mode === "list-layout" ? "list" : "grid";
  return results.slots.slice(FIRST_BATCH).map((slot) => resultCard(slot, c, state.region, layout)).join("");
}

function hrefBase(query: SearchQuery, params: URLSearchParams) {
  return {
    q: query.q, shipFrom: query.shipFrom, freeShipping: query.freeShipping, fourStars: query.fourStars,
    minPrice: params.get("minPrice") ?? "", maxPrice: params.get("maxPrice") ?? "", sort: query.sort,
  };
}

function toggled(query: SearchQuery, change: Partial<{ shipFrom: readonly ShipOrigin[]; freeShipping: boolean; fourStars: boolean }>): string {
  return searchHref({ q: query.q, shipFrom: change.shipFrom ?? query.shipFrom, freeShipping: change.freeShipping ?? query.freeShipping, fourStars: change.fourStars ?? query.fourStars, sort: query.sort, page: 1 });
}

function toggleOrigin(selected: readonly ShipOrigin[], origin: ShipOrigin): ShipOrigin[] {
  return selected.includes(origin) ? selected.filter((candidate) => candidate !== origin) : [...selected, origin];
}

function activeChips(query: SearchQuery): Array<[string, Partial<{ shipFrom: readonly ShipOrigin[]; freeShipping: boolean; fourStars: boolean }>]> {
  return [
    ...query.shipFrom.map((origin): [string, { shipFrom: ShipOrigin[] }] => [origin, { shipFrom: toggleOrigin(query.shipFrom, origin) }]),
    ...(query.freeShipping ? [["Free shipping", { freeShipping: false }] as [string, { freeShipping: boolean }]] : []),
    ...(query.fourStars ? [["4★ & up", { fourStars: false }] as [string, { fourStars: boolean }]] : []),
  ];
}

function sidebar(c: MarketClasses, query: SearchQuery, params: URLSearchParams, currency: string): string {
  const option = (label: string, on: boolean) => `<div class="${c.filterOption}"><span class="${c.filterBox}${on ? ` ${c.filterBoxOn}` : ""}"></span>${escapeHtml(label)}</div>`;
  return `<aside class="${c.sidebar}">
<div class="${c.filterGroup}"><div class="${c.filterTitle}">Ships from</div>${ORIGIN_FILTERS.map((origin) => option(origin, query.shipFrom.includes(origin))).join("")}</div>
<div class="${c.filterGroup}"><div class="${c.filterTitle}">Delivery</div>${option("Free shipping", query.freeShipping)}</div>
<div class="${c.filterGroup}"><div class="${c.filterTitle}">Rating</div>${option("4★ & up", query.fourStars)}</div>
<div class="${c.filterGroup}"><div class="${c.filterTitle}">Price (${currency})</div><div class="${c.priceInputs}"><input class="${c.priceInput}" placeholder="Min" value="${escapeHtml(params.get("minPrice") ?? "")}"> – <input class="${c.priceInput}" placeholder="Max" value="${escapeHtml(params.get("maxPrice") ?? "")}"><div class="${c.btn}">OK</div></div></div>
<div class="${c.filterGroup}"><div class="${c.filterTitle}">Brands</div>${["Hubsmith", "Lumora", "Qinport", "Voltbay"].map((brand) => option(brand, false)).join("")}</div>
</aside>`;
}

function sortBar(c: MarketClasses, query: SearchQuery): string {
  return `<div class="${c.sortBar}">${SORT_TABS.map(([sort, label]) => `<div class="${c.sortTab}${sort === query.sort ? ` ${c.sortTabOn}` : ""}">${escapeHtml(label)}</div>`).join("")}</div>`;
}

function chips(c: MarketClasses, query: SearchQuery): string {
  const active = activeChips(query);
  return active.length === 0 ? "" : `<div class="${c.chips}" style="margin-bottom:10px">${active.map(([label]) => `<div class="${c.chip}">${escapeHtml(label)} ×</div>`).join("")}</div>`;
}

function pager(c: MarketClasses, query: SearchQuery, page: number, pageCount: number): string {
  if (pageCount <= 1) return "";
  const at = (target: number) => searchHref({ q: query.q, shipFrom: query.shipFrom, freeShipping: query.freeShipping, fourStars: query.fourStars, sort: query.sort, page: target });
  const previous = page > 1 ? `<a class="${c.pagerItem}" href="${at(page - 1)}">‹ Previous</a>` : `<div class="${c.pagerItem} ${c.pagerDisabled}">‹ Previous</div>`;
  const numbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .map((target) => `<a class="${c.pagerItem}${target === page ? ` ${c.pagerCurrent}` : ""}" href="${at(target)}">${target}</a>`).join("");
  const next = `<div class="${c.pagerItem}${page >= pageCount ? ` ${c.pagerDisabled}` : ""}">Next ›</div>`;
  return `<div class="${c.pager}">${previous}${numbers}${next}<span class="${c.pagerJump}">Go to page <input class="${c.priceInput}" style="width:48px"> <span class="${c.btn}">Go</span></span></div>`;
}

function emptyResults(c: MarketClasses, query: SearchQuery): string {
  return `<div class="${c.panel}" style="text-align:center;padding:48px"><div class="${c.panelTitle}">Sorry, we couldn't find any results for “${escapeHtml(query.q)}”.</div><p>Check the spelling, or try a more general keyword.</p><div class="${c.related}" style="justify-content:center">${RELATED.map((text) => `<a class="${c.chip}" href="${searchHref({ q: text })}">${escapeHtml(text)}</a>`).join("")}</div></div>`;
}
