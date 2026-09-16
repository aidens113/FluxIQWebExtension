/**
 * The catalog's modes: the baseline and one per corpus variant. `set-variant`
 * switches between them.
 *
 * The extraction modes change one property of the card or its pagination and
 * nothing else, so a run that reads them differently has measured that one
 * property: `sparse-cards` drops a field from some cards, `absolute-links`
 * rewrites the link's `href` without moving the target, `link-pagination`
 * makes Next an anchor rather than a button, and `lazy-images` defers the
 * photo into `data-src`.
 */
export const catalogVariants = [
  "baseline", "text-variant", "short-catalog", "no-results",
  "sparse-cards", "absolute-links", "link-pagination", "lazy-images",
] as const;

export type CatalogVariant = (typeof catalogVariants)[number];

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  /** Tenths of a star: 46 renders as "4.6 out of 5". */
  ratingTenths: number;
  inStock: boolean;
};

/** What the shopper asked to see: one page, the submitted search, and the in-stock filter. */
export type CatalogView = { page: number; query: string; inStockOnly: boolean };

/** One page of matches for a view; `view.page` is clamped to `pageCount`. */
export type CatalogListing = {
  view: CatalogView;
  resultCount: number;
  pageCount: number;
  items: readonly CatalogProduct[];
};

export type ProductCatalogState = {
  variant: CatalogVariant;
  /** The results view last served. The start page itself always shows the default view. */
  view: CatalogView;
  /** What `view` displays under `variant`: the oracle a run's final state is checked against. */
  oracle: { resultCount: number; pageCount: number; productIds: string[] };
  /** Every results view served, oldest first, capped. */
  viewHistory: CatalogView[];
  /** Slugs of product pages opened, oldest first, capped. */
  productViews: string[];
};
