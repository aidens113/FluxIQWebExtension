import { defaultPropertySearch, normalizePropertySearch, searchProperties } from "./search.js";
import { propertyListings } from "./listings.js";
import { propertyVariants, type PropertyListingsState, type PropertyResults, type PropertyVariant } from "./types.js";

const HISTORY_LIMIT = 50;

/** The portal as it ships, on its opening search. The lab seed reaches none of it (see `listings.ts`). */
export function createPropertyState(): PropertyListingsState {
  return withResults({ variant: "baseline", searchHistory: [], listingViews: [] }, searchProperties(defaultPropertySearch()));
}

/**
 * `show` records a search the page served; `set-variant` arms a rendering
 * (`baseline` restores) and returns the page to its opening search, which is
 * where a run begins; `view-listing` records a listing page that was opened.
 * Any other operation, or a payload the page could not have sent, leaves the
 * state unchanged.
 */
export function mutatePropertyState(state: PropertyListingsState, operation: string, payload: unknown): PropertyListingsState {
  if (!isRecord(payload)) return state;
  if (operation === "show") {
    const results = searchProperties(normalizePropertySearch({
      page: payload.page, area: payload.area, beds: payload.beds,
      band: payload.band, newThisWeek: payload.newThisWeek, sort: payload.sort,
    }));
    return { ...withResults(state, results), searchHistory: [...state.searchHistory, results.search].slice(-HISTORY_LIMIT) };
  }
  const variant = payload.variant;
  if (operation === "set-variant" && isPropertyVariant(variant)) {
    return withResults({ ...state, variant }, searchProperties(defaultPropertySearch()));
  }
  const slug = payload.slug;
  if (operation === "view-listing" && typeof slug === "string" && propertyListings.some((listing) => listing.slug === slug)) {
    return { ...state, listingViews: [...state.listingViews, slug].slice(-HISTORY_LIMIT) };
  }
  return state;
}

function withResults(state: Omit<PropertyListingsState, "search" | "oracle">, results: PropertyResults): PropertyListingsState {
  return {
    ...state,
    search: results.search,
    oracle: {
      matchCount: results.matchCount,
      pageCount: results.pageCount,
      references: results.items.map((listing) => listing.reference),
    },
  };
}

function isPropertyVariant(value: unknown): value is PropertyVariant {
  return typeof value === "string" && (propertyVariants as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
