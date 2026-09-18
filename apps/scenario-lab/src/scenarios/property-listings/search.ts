import { propertyListings } from "./listings.js";
import { PROPERTY_AREA_OPTIONS, PROPERTY_BAND_OPTIONS, PROPERTY_BED_OPTIONS, PROPERTY_SORT_OPTIONS } from "./options.js";
import type { PropertyListing, PropertyResults, PropertySearch, PropertySort } from "./types.js";

/** Homes per page of results, as a portal shows them. */
export const PROPERTY_PAGE_SIZE = 10;

/** How recently a home must have been listed to count as new this week. */
const NEW_THIS_WEEK_DAYS = 7;

/** Page 1 of every home on the market, most recently listed first: what the search page opens on. */
export function defaultPropertySearch(): PropertySearch {
  return { page: 1, area: "", beds: "", band: "", newThisWeek: false, sort: "recent" };
}

/** Coerces untrusted search input: a whole page from 1, values the selects actually offer, and a strictly boolean facet. */
export function normalizePropertySearch(input: {
  page: unknown; area: unknown; beds: unknown; band: unknown; newThisWeek: unknown; sort: unknown;
}): PropertySearch {
  const page = typeof input.page === "number" && Number.isSafeInteger(input.page) && input.page >= 1 ? input.page : 1;
  return {
    page,
    area: offered(PROPERTY_AREA_OPTIONS, input.area),
    beds: offered(PROPERTY_BED_OPTIONS, input.beds),
    band: offered(PROPERTY_BAND_OPTIONS, input.band),
    newThisWeek: input.newThisWeek === true,
    sort: sortOffered(input.sort),
  };
}

/**
 * Applies the facets, orders what is left, and pages it, clamping the page to
 * the last one. A facet nobody set matches everything, as the select's first
 * option says; the bedrooms facet's last option is a floor rather than an
 * exact count.
 */
export function searchProperties(search: PropertySearch): PropertyResults {
  const matches = propertyListings.filter((listing) => matchesSearch(listing, search)).sort(comparing(search.sort));
  const pageCount = Math.max(1, Math.ceil(matches.length / PROPERTY_PAGE_SIZE));
  const page = Math.min(search.page, pageCount);
  const start = (page - 1) * PROPERTY_PAGE_SIZE;
  return {
    search: { ...search, page },
    matchCount: matches.length,
    pageCount,
    items: matches.slice(start, start + PROPERTY_PAGE_SIZE),
  };
}

/** Every home the search matches, in its order and across every page: what a read that follows pagination to its end collects. */
export function allMatchingProperties(search: PropertySearch): readonly PropertyListing[] {
  return propertyListings.filter((listing) => matchesSearch(listing, search)).sort(comparing(search.sort));
}

/** The count the results heading shows. */
export function resultCountText(matchCount: number): string {
  return `${matchCount} home${matchCount === 1 ? "" : "s"} for sale`;
}

/** The page counter under the results, reworded by the `renamed-pagination` rendering. */
export function pageStatusText(page: number, pageCount: number, reworded: boolean): string {
  return reworded ? `Showing page ${page} of ${pageCount}` : `Page ${page} of ${pageCount}`;
}

/** The facets the search is applying, in the words the selects use, or nothing when none is set. */
export function filterSummaryText(search: PropertySearch): string | undefined {
  const parts = [
    labelOf(PROPERTY_AREA_OPTIONS, search.area),
    labelOf(PROPERTY_BED_OPTIONS, search.beds),
    labelOf(PROPERTY_BAND_OPTIONS, search.band),
    search.newThisWeek ? "New this week" : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : `Filters: ${parts.join(" \u00b7 ")}`;
}

function matchesSearch(listing: PropertyListing, search: PropertySearch): boolean {
  const band = PROPERTY_BAND_OPTIONS.find((option) => option.value === search.band);
  const beds = search.beds === "" ? undefined : Number(search.beds);
  return (search.area === "" || slugOf(listing.area) === search.area)
    && (beds === undefined || (beds === 5 ? listing.bedrooms >= 5 : listing.bedrooms === beds))
    && (band === undefined || band.value === "" || withinBand(listing.priceGbp, band.min, band.max))
    && (!search.newThisWeek || listing.listedDaysAgo <= NEW_THIS_WEEK_DAYS);
}

function withinBand(priceGbp: number, min: number | undefined, max: number | undefined): boolean {
  return (min === undefined || priceGbp >= min) && (max === undefined || priceGbp < max);
}

/** Ties break on the reference, so every order is total and the same on every run. */
function comparing(sort: PropertySort): (left: PropertyListing, right: PropertyListing) => number {
  return (left, right) => {
    const primary = sort === "recent"
      ? left.listedDaysAgo - right.listedDaysAgo
      : (left.priceGbp - right.priceGbp) * (sort === "price-desc" ? -1 : 1);
    return primary !== 0 ? primary : left.reference.localeCompare(right.reference);
  };
}

function slugOf(area: string): string {
  return area.toLowerCase().replaceAll(" ", "-");
}

function offered(options: readonly { value: string }[], value: unknown): string {
  return typeof value === "string" && options.some((option) => option.value === value) ? value : "";
}

function sortOffered(value: unknown): PropertySort {
  return typeof value === "string" && PROPERTY_SORT_OPTIONS.some((option) => option.value === value) ? value as PropertySort : "recent";
}

function labelOf(options: readonly { value: string; label: string }[], value: string): string | undefined {
  return value === "" ? undefined : options.find((option) => option.value === value)?.label;
}
