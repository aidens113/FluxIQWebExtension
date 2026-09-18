import { escapeHtml } from "../../html.js";
import { cardShowsAgent, formatBedrooms, formatFloorArea, formatListed, formatPrice, listingPath } from "./format.js";
import { PROPERTY_COUNT } from "./listings.js";
import { PROPERTY_AREA_OPTIONS, PROPERTY_BAND_OPTIONS, PROPERTY_BED_OPTIONS, PROPERTY_SORT_OPTIONS, type PropertyOption } from "./options.js";
import { filterSummaryText, pageStatusText, resultCountText } from "./search.js";
import type { PropertyListing, PropertyResults, PropertyVariant } from "./types.js";

/**
 * The portal's stylesheet. The separators between a card's attributes are
 * drawn by CSS rather than written into the markup, so the text of each
 * attribute is exactly the attribute and a read of it needs no trimming.
 */
export const PROPERTY_STYLE = `
  .search-panel { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; padding: .75rem; background: #f2f5f8; border-radius: .4rem; }
  .search-panel .field { display: grid; gap: .15rem; }
  .results { list-style: none; padding: 0; display: grid; gap: 1rem; }
  .results > li { display: block; border: 1px solid #dde3ea; border-radius: .4rem; padding: .75rem; }
  .price { font-size: 1.25rem; font-weight: 700; margin: 0; }
  .address { font-size: 1rem; margin: .15rem 0; }
  .attributes, .agent, .listed, .reference { margin: .15rem 0; color: #44505e; }
  .attributes span + span::before { content: " \u00b7 "; }
  .label { color: #6b7684; }
  .key-facts { display: grid; grid-template-columns: max-content 1fr; gap: .25rem 1rem; }
  .key-facts dt { color: #6b7684; }
  .key-facts dd { margin: 0; }
  [aria-busy="true"] { opacity: .6; }`;

/** The search page body: the facets, and the results region holding the opening search. */
export function propertyPageBody(results: PropertyResults, variant: PropertyVariant): string {
  return `<header>
  <p class="brand">Harbourline Property</p>
  <h1>Homes for sale</h1>
  <p class="strapline">${PROPERTY_COUNT} homes across five neighbourhoods, updated every morning.</p>
</header>
<main>
  ${searchPanel(variant)}
  <section data-testid="results" aria-labelledby="results-heading" aria-busy="false">${propertyResultsMarkup(results, variant)}</section>
</main>
<style>${PROPERTY_STYLE}</style>`;
}

/** The inside of the results region for one search. The search page and the `results` route share it. */
export function propertyResultsMarkup(results: PropertyResults, variant: PropertyVariant): string {
  const { search, matchCount, items } = results;
  const summary = filterSummaryText(search);
  return [
    `<h2 id="results-heading">Homes for sale</h2>`,
    `<p class="result-count" data-testid="result-count" role="status">${resultCountText(matchCount)}</p>`,
    summary === undefined ? "" : `<p class="filter-summary" data-testid="filter-summary">${escapeHtml(summary)}</p>`,
    items.length > 0
      ? `<ol class="results" data-testid="results-list" aria-label="Search results">${items.map((listing) => listingCard(listing, variant)).join("")}</ol>`
      : `<p class="no-results" data-testid="empty-results">No homes match this search. Try a wider price range or another area.</p>`,
    matchCount > 0 ? pagination(results, variant) : "",
  ].join("");
}

/**
 * One results card. Every fact on it is ordinary visible text under a class
 * the design uses for its layout: nothing here carries a test hook, so a read
 * of a card has to go by the heading, the labels and the words themselves.
 *
 * A home whose agent published no floor area has no floor-area element at all,
 * and under `agent-withheld` the agent line is absent in the same way, so
 * either field reads as no value rather than as empty text.
 */
function listingCard(listing: PropertyListing, variant: PropertyVariant): string {
  const addressId = `${listing.slug}-address`;
  return `<li class="result" data-reference="${listing.reference}"><article aria-labelledby="${addressId}">`
    + `<p class="price">${formatPrice(listing.priceGbp)}</p>`
    + `<h3 class="address" id="${addressId}"><a class="listing-link" href="${listingPath(listing)}">${escapeHtml(listing.address)}</a></h3>`
    + attributes(listing)
    + (cardShowsAgent(listing, variant) ? agentLine(listing) : "")
    + `<p class="listed"><span class="label">Listed</span> <span class="listed-on">${formatListed(listing.listedDaysAgo)}</span></p>`
    + `</article></li>`;
}

/** Bedrooms, the kind of home, and the floor area when the agent published one. */
export function attributes(listing: PropertyListing): string {
  const floorArea = listing.floorAreaSqFt === undefined ? "" : `<span class="floor-area">${formatFloorArea(listing.floorAreaSqFt)}</span>`;
  return `<p class="attributes"><span class="beds">${formatBedrooms(listing.bedrooms)}</span>`
    + `<span class="property-type">${escapeHtml(listing.propertyType)}</span>${floorArea}</p>`;
}

export function agentLine(listing: PropertyListing): string {
  return `<p class="agent"><span class="label">Agent</span> <span class="agent-name">${escapeHtml(listing.agent)}</span></p>`;
}

/**
 * The facets. `redesigned-search` is the panel after a redesign: the Search
 * button is gone and "Show homes" stands where it stood, carrying a different
 * hook, so a recording that pressed Search finds nothing to press.
 */
function searchPanel(variant: PropertyVariant): string {
  const redesigned = variant === "redesigned-search";
  const submit = redesigned
    ? `<button type="submit" data-testid="apply-filters">Show homes</button>`
    : `<button type="submit" data-testid="search-submit">Search</button>`;
  return `<form class="search-panel" data-testid="search-form" aria-label="Property search">
  ${select("area-filter", "Area", "area", PROPERTY_AREA_OPTIONS)}
  ${select("beds-filter", "Bedrooms", "beds", PROPERTY_BED_OPTIONS)}
  ${select("band-filter", "Price", "band", PROPERTY_BAND_OPTIONS)}
  ${select("sort-order", "Sort by", "sort", PROPERTY_SORT_OPTIONS)}
  <label class="facet"><input type="checkbox" name="new" autocomplete="off" data-testid="new-this-week"> New this week</label>
  ${submit}
</form>`;
}

function select(id: string, label: string, name: string, options: readonly PropertyOption[]): string {
  const rendered = options.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<span class="field"><label for="${id}">${escapeHtml(label)}</label>`
    + `<select id="${id}" data-testid="${id}" name="${name}" autocomplete="off">${rendered}</select></span>`;
}

/**
 * The page counter and the control that reaches the next page, absent rather
 * than disabled on the last page. `renamed-pagination` keeps the control in
 * place and its hook unchanged, and changes what it is and what it says: a
 * link reading "More homes", above a reworded counter.
 */
function pagination({ search, pageCount }: PropertyResults, variant: PropertyVariant): string {
  const reworded = variant === "renamed-pagination";
  const status = `<p class="page-status" data-testid="page-status">${pageStatusText(search.page, pageCount, reworded)}</p>`;
  const next = search.page < pageCount ? nextControl(search.page + 1, reworded) : "";
  return `<nav class="pagination" aria-label="Results pages" data-testid="pagination">${status}${next}</nav>`;
}

function nextControl(nextPage: number, reworded: boolean): string {
  return reworded
    ? `<a data-testid="next-page" data-page="${nextPage}" href="?page=${nextPage}">More homes</a>`
    : `<button type="button" data-testid="next-page" data-page="${nextPage}">Next</button>`;
}
