import { page } from "../../html.js";
import { defineScenario } from "../../types.js";
import { propertyClientScript } from "./client-script.js";
import { propertyListingsManifest } from "./manifest.js";
import { propertyPageBody } from "./markup.js";
import { routeProperty } from "./route.js";
import { defaultPropertySearch, searchProperties } from "./search.js";
import { createPropertyState, mutatePropertyState } from "./state.js";
import type { PropertyListingsState } from "./types.js";

/**
 * A property portal with 288 homes on the market, ten to a page, four facets
 * that apply when Search is pressed, and a page per home carrying the tenure,
 * the council tax band and the EPC rating, which no results card shows.
 *
 * The start page always opens on the portal's own first page under the armed
 * rendering; every later page of results comes from the `results` route, which
 * records it through `mutate`. Nothing here reads the lab seed: the market is
 * authored and the manifest's expected records are literal text, so both must
 * read the same on every run.
 */
export const propertyListingsScenario = defineScenario<PropertyListingsState>({
  id: "property-listings",
  title: "Property listings",
  startPath: "/scenarios/property-listings/",
  seed: 161,
  manifest: propertyListingsManifest,
  createState: () => createPropertyState(),
  mutate: mutatePropertyState,
  render: (state) => page(
    "Homes for sale | Harbourline Property",
    propertyPageBody(searchProperties(defaultPropertySearch()), state.variant),
    propertyClientScript(),
  ),
  route: (state, request) => routeProperty(state, request),
});
