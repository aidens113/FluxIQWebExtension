/**
 * The store's vocabulary: what a product is, where an advert sits, and what a
 * shopper can ask the search for. Types only; every value lives beside the
 * data or the logic that owns it.
 */

/** What a listing is for. An accessory shares every search word with the thing it fits, and is still not one. */
export type ProductKind = "earbuds" | "accessory" | "kettle" | "household";

/** A kettle child's position in its family's two pickers. */
export type KettleVariant = { colour: string; capacity: string };

/**
 * One listing, as the store holds it.
 *
 * `priceCents` is what the listing charges and what every card and buy box
 * prints; `listPriceCents` is the struck-through reference price some
 * listings show beside it. `rating` is the average to one decimal, which is
 * the number the card prints; the star icon beside it is rounded to half a
 * star, and so is the review filter, which is why "4 Stars & Up" admits a
 * 3.8. `plus` is Brightaisle Plus eligibility, which a card shows only as an
 * icon with an accessible name. `seller` is who sells it: "Brightaisle" for
 * the store itself, anyone else for a marketplace seller.
 */
export type Product = {
  sku: string;
  kind: ProductKind;
  brand: string;
  title: string;
  slug: string;
  priceCents: number;
  listPriceCents: number | null;
  rating: number;
  ratingCount: number;
  plus: boolean;
  seller: string;
  bought: string | null;
  coupon: string | null;
  stock: string;
  available: boolean;
  /** Variant family id, or null for a listing with no pickers. */
  family: string | null;
  variant: KettleVariant | null;
  /** The hue of the product's placeholder photo. */
  hue: number;
};

/** A paid placement: the advert's own id and the listing it promotes. */
export type AdPlacement = { adId: string; product: Product };

/** The price bands the filter rail offers. Each band's upper bound is inclusive, as the rail's labels say. */
export type PriceBand = "under-25" | "25-50" | "50-100" | "100-up";

export type SortOrder = "featured" | "price-asc" | "price-desc" | "review";

/**
 * What the filter rail narrows by. `low` and `high` are the custom range's
 * bounds in cents, both inclusive; `brands` are brand slugs.
 */
export type SearchFilters = {
  plus: boolean;
  stars4: boolean;
  band: PriceBand | null;
  low: number | null;
  high: number | null;
  brands: readonly string[];
};

/** A search as its URL carries it. `page` is one-based. */
export type SearchQuery = {
  keywords: string;
  department: string;
  filters: SearchFilters;
  sort: SortOrder;
  page: number;
};
