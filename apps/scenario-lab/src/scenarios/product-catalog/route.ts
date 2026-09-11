import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { catalogFor, listCatalog, normalizeCatalogView } from "./listing.js";
import { productPageMarkup, resultsMarkup } from "./markup.js";
import type { ProductCatalogState } from "./types.js";

const PRODUCT_SUBPATH = /^products\/([a-z0-9-]+)$/;

/**
 * `results?page=&q=&stock=in` serves the results fragment for one view and
 * records that view (`show`); `products/<slug>` serves a product page and
 * records the visit (`view-product`). Both follow the armed variant.
 * Anything else, including a product the variant's catalog lacks, is a 404.
 */
export function routeCatalog(state: ProductCatalogState, request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  if (request.subpath === "results") {
    const listing = listCatalog(state.variant, normalizeCatalogView({
      page: Number(request.query.get("page") ?? "1"),
      query: request.query.get("q") ?? "",
      inStockOnly: request.query.get("stock") === "in",
    }));
    return { status: 200, body: resultsMarkup(listing, state.variant), mutation: { operation: "show", payload: listing.view } };
  }
  const slug = PRODUCT_SUBPATH.exec(request.subpath)?.[1];
  const product = slug === undefined ? undefined : catalogFor(state.variant).find((candidate) => candidate.slug === slug);
  if (!product) return undefined;
  return { status: 200, body: productPageMarkup(product, state.variant), mutation: { operation: "view-product", payload: { slug: product.slug } } };
}
