/**
 * The marketplace's catalogue vocabulary: a store, a listing, what a listing
 * costs to ship, and the options a buyer picks on its page.
 *
 * Every amount is held in euro cents, the currency the catalogue is priced in;
 * the page converts and formats it for the buyer's region at render time
 * (`locale/money.ts`), which is how a cross-border marketplace shows one
 * listing in four currencies.
 */

/** A warehouse a listing can ship from, spelled as the "Ships From" chips spell it. */
export type ShipOrigin = "China" | "Spain" | "Poland" | "Czech Republic";

/** What the card and the delivery box say about shipping. */
export type Shipping =
  | { kind: "free" }
  | { kind: "paid"; cents: number }
  | { kind: "free-over"; cents: number };

export type Store = {
  id: string;
  name: string;
  /** "96.8%" as the store card prints it. */
  positiveFeedback: string;
  followers: string;
  /** The store coupon a buyer can collect on the store's listings, if the store offers one. */
  coupon?: { offCents: number; minimumCents: number };
};

/**
 * How a listing's options are shaped:
 * - `hub`: Color, Specification and Ships From, priced per combination, with
 *   stock per combination -- the two listings the purchase tasks are about;
 * - `basic`: Color and a single Ships From, one price.
 */
export type SkuModel = "hub" | "basic";

export type Listing = {
  /** Thirteen digits, as the marketplace numbers items. */
  id: string;
  title: string;
  storeId: string;
  /** The lowest price across the listing's options: what a result card shows. */
  priceCents: number;
  /** The struck-through list price the discount is computed from. */
  originalCents: number;
  /** Tenths of a star (47 is 4.7), or `null` for a listing nobody has rated yet. */
  rating: number | null;
  reviews: number;
  /** "1,000+ sold", or an empty string for a listing that has sold nothing. */
  sold: string;
  /** Every warehouse the listing ships from; the first is its default option. */
  origins: readonly ShipOrigin[];
  shipping: Shipping;
  /** The marketplace's own fulfilment badge. */
  choice: boolean;
  skuModel: SkuModel;
  colors: readonly string[];
  /** A sponsored placement that is not also an organic result. */
  adOnly?: true;
  /** Breadcrumb category, deepest last. */
  category: readonly string[];
};

/** One option set a buyer can choose on a listing's page; `spec` is empty for a `basic` listing. */
export type SkuChoice = { color: string; spec: string; origin: ShipOrigin };

/** A result card on a search page: which listing, and whether that placement is paid for. */
export type ResultSlot = { listing: Listing; sponsored: boolean };
