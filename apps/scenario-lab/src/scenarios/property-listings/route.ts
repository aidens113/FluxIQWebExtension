import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { listingPageMarkup } from "./listing-page.js";
import { propertyListings } from "./listings.js";
import { propertyResultsMarkup } from "./markup.js";
import { normalizePropertySearch, searchProperties } from "./search.js";
import type { PropertyListingsState } from "./types.js";

const LISTING_SUBPATH = /^listings\/([a-z0-9-]+)$/;

/**
 * `results?page=&area=&beds=&band=&new=&sort=` serves the results fragment for
 * one search and records that search (`show`); `listings/<reference>` serves a
 * home's own page and records the visit (`view-listing`). Both follow the
 * armed rendering. Anything else is a 404.
 */
export function routeProperty(state: PropertyListingsState, request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  if (request.subpath === "results") {
    const results = searchProperties(normalizePropertySearch({
      page: Number(request.query.get("page") ?? "1"),
      area: request.query.get("area") ?? "",
      beds: request.query.get("beds") ?? "",
      band: request.query.get("band") ?? "",
      newThisWeek: request.query.get("new") === "yes",
      sort: request.query.get("sort") ?? "recent",
    }));
    return { status: 200, body: propertyResultsMarkup(results, state.variant), mutation: { operation: "show", payload: results.search } };
  }
  const slug = LISTING_SUBPATH.exec(request.subpath)?.[1];
  const listing = slug === undefined ? undefined : propertyListings.find((candidate) => candidate.slug === slug);
  if (!listing) return undefined;
  return { status: 200, body: listingPageMarkup(listing), mutation: { operation: "view-listing", payload: { slug: listing.slug } } };
}
