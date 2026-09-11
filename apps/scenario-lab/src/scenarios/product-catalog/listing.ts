import { catalogProducts } from "./products.js";
import type { CatalogListing, CatalogProduct, CatalogVariant, CatalogView } from "./types.js";

export const CATALOG_PAGE_SIZE = 8;
/** Products the `short-catalog` variant keeps: fewer than one page. */
export const SHORT_CATALOG_SIZE = 5;
const MAX_QUERY_LENGTH = 80;

/** Page 1 of the whole catalog: what the start page shows. */
export function defaultCatalogView(): CatalogView {
  return { page: 1, query: "", inStockOnly: false };
}

/** The products that exist under a variant, in listing order. */
export function catalogFor(variant: CatalogVariant): readonly CatalogProduct[] {
  return variant === "short-catalog" ? catalogProducts.slice(0, SHORT_CATALOG_SIZE) : catalogProducts;
}

/** Coerces untrusted view input: a whole page from 1, a trimmed and bounded query, and a strictly boolean filter. */
export function normalizeCatalogView(input: { page: unknown; query: unknown; inStockOnly: unknown }): CatalogView {
  const page = typeof input.page === "number" && Number.isSafeInteger(input.page) && input.page >= 1 ? input.page : 1;
  const query = typeof input.query === "string" ? input.query.trim().slice(0, MAX_QUERY_LENGTH) : "";
  return { page, query, inStockOnly: input.inStockOnly === true };
}

/**
 * Searches by case-insensitive name substring, keeps in-stock products when
 * asked, then pages the matches, clamping the page to the last one. The
 * `no-results` variant matches nothing for any non-empty query; browsing
 * without a query is unchanged.
 */
export function listCatalog(variant: CatalogVariant, view: CatalogView): CatalogListing {
  const needle = view.query.toLowerCase();
  const matches = catalogFor(variant).filter((product) =>
    (needle === "" || (variant !== "no-results" && product.name.toLowerCase().includes(needle)))
    && (!view.inStockOnly || product.inStock));
  const pageCount = Math.max(1, Math.ceil(matches.length / CATALOG_PAGE_SIZE));
  const page = Math.min(view.page, pageCount);
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  return { view: { ...view, page }, resultCount: matches.length, pageCount, items: matches.slice(start, start + CATALOG_PAGE_SIZE) };
}
