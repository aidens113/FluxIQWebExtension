import { catalogFor, defaultCatalogView, listCatalog, normalizeCatalogView } from "./listing.js";
import { catalogVariants, type CatalogListing, type CatalogVariant, type ProductCatalogState } from "./types.js";

const HISTORY_LIMIT = 50;

/** The baseline catalog on its start page. The lab seed does not change the catalog (see `products.ts`). */
export function createCatalogState(): ProductCatalogState {
  return withListing({ variant: "baseline", viewHistory: [], productViews: [] }, listCatalog("baseline", defaultCatalogView()));
}

/**
 * `show` records a served results view; `set-variant` arms a corpus variant
 * (`baseline` restores) and resets the view to the start page, which is
 * where a run begins; `view-product` records an opened product page. Any
 * other operation, or an invalid payload, leaves the state unchanged.
 */
export function mutateCatalogState(state: ProductCatalogState, operation: string, payload: unknown): ProductCatalogState {
  if (!isRecord(payload)) return state;
  if (operation === "show") {
    const listing = listCatalog(state.variant, normalizeCatalogView({ page: payload.page, query: payload.query, inStockOnly: payload.inStockOnly }));
    return { ...withListing(state, listing), viewHistory: [...state.viewHistory, listing.view].slice(-HISTORY_LIMIT) };
  }
  const variant = payload.variant;
  if (operation === "set-variant" && isCatalogVariant(variant)) {
    return withListing({ ...state, variant }, listCatalog(variant, defaultCatalogView()));
  }
  const slug = payload.slug;
  if (operation === "view-product" && typeof slug === "string" && catalogFor(state.variant).some((product) => product.slug === slug)) {
    return { ...state, productViews: [...state.productViews, slug].slice(-HISTORY_LIMIT) };
  }
  return state;
}

function withListing(state: Omit<ProductCatalogState, "view" | "oracle">, listing: CatalogListing): ProductCatalogState {
  return {
    ...state,
    view: listing.view,
    oracle: { resultCount: listing.resultCount, pageCount: listing.pageCount, productIds: listing.items.map((product) => product.id) },
  };
}

function isCatalogVariant(value: unknown): value is CatalogVariant {
  return typeof value === "string" && (catalogVariants as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
