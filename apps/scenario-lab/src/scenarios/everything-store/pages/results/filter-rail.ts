import { escapeHtml } from "../../../../html.js";
import { SEARCH_PARAMS, STORE_PATHS, type PriceBand, type SearchFilters, type SearchOutcome, type SearchQuery } from "../../catalog/index.js";
import type { StoreClasses, StoreIds } from "../../style/index.js";

const BANDS: ReadonlyArray<readonly [PriceBand, string]> = [["under-25", "Under $25"], ["25-50", "$25 to $50"], ["50-100", "$50 to $100"], ["100-up", "$100 & Above"]];

/**
 * The filter rail. Every refinement is a link that loads a new results page,
 * drawn with a box that looks like a checkbox and is not one. Its semantics
 * are the store's, not the shopper's: the review filter admits anything whose
 * star icon rounds to four, and each price band includes its upper bound, so
 * "$25 to $50" lists a $50.00 pair. The custom range's button is named "Go",
 * like the header's search button.
 */
export function filterRail(css: StoreClasses, ids: StoreIds, query: SearchQuery, outcome: SearchOutcome): string {
  const link = (filters: SearchFilters, active: boolean, label: string, name?: string) => {
    const href = SEARCH_PARAMS.href({ ...query, filters, page: 1 });
    const box = `<span class="${css.railBox}${active ? ` ${css.railBoxOn}` : ""}" aria-hidden="true"></span>`;
    return `<a class="${css.railLink}" href="${escapeHtml(href)}"${name ? ` aria-label="${escapeHtml(name)}"` : ""}>${box}<span>${label}</span></a>`;
  };
  const { filters } = query;
  const bands = BANDS.map(([band, label]) => link({ ...filters, band: filters.band === band ? null : band, low: null, high: null }, filters.band === band, escapeHtml(label))).join("");
  const brands = outcome.brands.map((brand) => {
    const slug = SEARCH_PARAMS.brandSlug(brand);
    const active = filters.brands.includes(slug);
    return link({ ...filters, brands: active ? filters.brands.filter((entry) => entry !== slug) : [...filters.brands, slug] }, active, escapeHtml(brand));
  });
  const hidden = [["k", query.keywords], ...(query.department === "all" ? [] : [["i", query.department]]), ...(query.sort === "featured" ? [] : [["s", query.sort]])]
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value ?? "")}">`).join("");
  const refinements = [...(filters.plus ? ["plus"] : []), ...(filters.stars4 ? ["stars-4"] : []), ...filters.brands.map((brand) => `brand-${brand}`)].join(",");
  const narrowed = filters.plus || filters.stars4 || filters.band !== null || filters.low !== null || filters.high !== null || filters.brands.length > 0;
  const cleared = SEARCH_PARAMS.href({ ...query, page: 1, filters: { plus: false, stars4: false, band: null, low: null, high: null, brands: [] } });
  return `<aside class="${css.rail}" aria-label="Filters">
${narrowed ? `<p><a href="${escapeHtml(cleared)}">Clear all filters</a></p>` : ""}
<div class="${css.railGroup}"><p class="${css.railHeading}">Delivery</p>${link({ ...filters, plus: !filters.plus }, filters.plus, "Brightaisle Plus")}</div>
<div class="${css.railGroup}"><p class="${css.railHeading}">Customer Reviews</p>${link({ ...filters, stars4: !filters.stars4 }, filters.stars4, "&#9733;&#9733;&#9733;&#9733;&#9734; &amp; Up", "4 Stars & Up")}</div>
<div class="${css.railGroup}"><p class="${css.railHeading}">Price</p>${bands}
<form class="${css.priceForm}" method="get" action="${STORE_PATHS.search}">${hidden}${refinements ? `<input type="hidden" name="rh" value="${escapeHtml(refinements)}">` : ""}
<label class="${css.srOnly}" for="${ids.priceLow}">Minimum price</label><input class="${css.priceInput}" id="${ids.priceLow}" name="low" inputmode="decimal" placeholder="$ Min" value="${filters.low === null ? "" : (filters.low / 100).toFixed(2)}">
<label class="${css.srOnly}" for="${ids.priceHigh}">Maximum price</label><input class="${css.priceInput}" id="${ids.priceHigh}" name="high" inputmode="decimal" placeholder="$ Max" value="${filters.high === null ? "" : (filters.high / 100).toFixed(2)}">
<input class="${css.button}" type="submit" value="Go"></form></div>
<div class="${css.railGroup}"><p class="${css.railHeading}">Brands</p>${brands.slice(0, 6).join("")}${brands.length > 6 ? `<details><summary>See more</summary>${brands.slice(6).join("")}</details>` : ""}</div>
</aside>`;
}
