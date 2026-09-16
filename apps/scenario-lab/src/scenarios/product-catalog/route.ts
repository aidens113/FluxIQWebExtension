import type { ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { CATALOG_PLACEHOLDER_SLUG } from "./format.js";
import { catalogFor, listCatalog, normalizeCatalogView } from "./listing.js";
import { catalogImageSvg, productPageMarkup, resultsMarkup } from "./markup.js";
import type { ProductCatalogState } from "./types.js";

const PRODUCT_SUBPATH = /^products\/([a-z0-9-]+)$/;
const IMAGE_SUBPATH = /^images\/([a-z0-9-]+)\.svg$/;

/**
 * `results?page=&q=&stock=in` serves the results fragment for one view and
 * records that view (`show`); `products/<slug>` serves a product page and
 * records the visit (`view-product`); `images/<slug>.svg` serves a card photo,
 * which records nothing because loading an image is not a visit. All three
 * follow the armed variant. Anything else, including a product the variant's
 * catalog lacks, is a 404.
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
  const imageSlug = IMAGE_SUBPATH.exec(request.subpath)?.[1];
  if (imageSlug !== undefined) {
    const known = imageSlug === CATALOG_PLACEHOLDER_SLUG || catalogFor(state.variant).some((candidate) => candidate.slug === imageSlug);
    return known ? { status: 200, headers: { "content-type": "image/svg+xml" }, body: catalogImageSvg(imageSlug) } : undefined;
  }
  const slug = PRODUCT_SUBPATH.exec(request.subpath)?.[1];
  const product = slug === undefined ? undefined : catalogFor(state.variant).find((candidate) => candidate.slug === slug);
  if (!product) return undefined;
  return { status: 200, body: productPageMarkup(product, state.variant), mutation: { operation: "view-product", payload: { slug: product.slug } } };
}
