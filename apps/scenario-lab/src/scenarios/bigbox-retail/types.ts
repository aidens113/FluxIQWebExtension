/**
 * The vocabulary of ValueRidge, a fictional big-box retailer: stores, the
 * catalog, a shopper's cart, and what a run leaves behind.
 *
 * Nothing here depends on the wall clock. Every "today" and "tomorrow" on the
 * site is measured from one fixed store-local moment, Monday 21 September 2026
 * at 10:05, so a run at any hour reads the same page. The lab seed reaches
 * only the build's generated class names and element ids.
 */

/**
 * The renderings the fixture can be armed into.
 *
 * - `baseline` is the site as it ships.
 * - `redesigned-buy-box` is a product-page redesign: Add to cart lost its
 *   automation id and moved up into the buy box, and Buy now -- which skips
 *   the cart -- now stands in the sticky bar where Add to cart was.
 * - `list-layout` is a search-results experiment: results render as a list
 *   of rows rather than a grid of tiles, prices as plain text, and sponsored
 *   rows carry an "Ad" pill rather than a "Sponsored" label.
 */
export const bigboxModes = ["baseline", "redesigned-buy-box", "list-layout"] as const;

export type BigboxMode = (typeof bigboxModes)[number];

/** How an item reaches the shopper. */
export type Fulfilment = "pickup" | "delivery" | "shipping";

/** How soon an item can be picked up or delivered from a store. */
export type Speed = "today" | "tomorrow" | "none";

export type Department = "Paper Towels" | "Paper Towel Holders" | "Napkins" | "Dish Soap";

export type Store = {
  id: string;
  name: string;
  address: string;
  distance: string;
  hours: string;
  /** Sales tax in basis points of the subtotal. */
  taxBasisPoints: number;
};

/**
 * One purchasable size or pack of a product. `pickup` is per store id, and a
 * store it does not name cannot hand the variant over.
 */
export type Variant = {
  sku: string;
  /** The size as the swatch spells it; empty for a product sold in one size, whose name already says it. */
  label: string;
  priceCents: number;
  /** The price before a Rollback, when there is one. */
  wasCents?: number;
  /** The shelf's unit price, as printed: "1.2 ¢/sheet", "$1.87/roll". Empty for goods sold by the each. */
  unit: string;
  pickup: Readonly<Record<string, Speed>>;
  delivery: Speed;
  /** The arrival day a shipped order promises, "Thu, Sep 24", or empty when the variant does not ship. */
  shipping: string;
};

export type Product = {
  /** The nine-digit item id the product page URL ends in. */
  id: string;
  slug: string;
  /** The product's name; a multi-size product appends the chosen size to it. */
  name: string;
  brand: string;
  department: Department;
  /** "ValueRidge" for goods the store sells itself, or the marketplace seller's name. */
  seller: string;
  rating: number;
  reviews: number;
  badge?: "Best seller" | "Popular pick";
  /** The first is the size a tile and a fresh product page show. */
  variants: readonly Variant[];
  about: readonly string[];
};

export type CartLine = {
  lineId: string;
  productId: string;
  sku: string;
  qty: number;
  fulfilment: Fulfilment;
};

export type PlacedOrder = {
  number: string;
  storeId: string;
  slotId: string;
  lines: CartLine[];
  firstName: string;
  payment: "card" | "pickup";
  subtotalCents: number;
  taxCents: number;
};

/**
 * What the run left behind. Every field is something the page reported
 * through `mutate` or a route recorded, so a reload renders the run's own
 * changes and the page and the oracle cannot disagree.
 */
export type BigboxState = {
  mode: BigboxMode;
  consent: "pending" | "accepted" | "rejected";
  promo: "pending" | "dismissed" | "signed-up";
  /** Newsletter sign-ups whose hidden field was filled in; nothing a person sees can fill it. */
  flaggedSignups: number;
  chatCard: "pending" | "dismissed";
  storeId: string;
  cart: CartLine[];
  saved: CartLine[];
  nextLine: number;
  /** Search-results documents served since the last reset, and the bot check the third one raises. */
  robot: { searchLoads: number; status: "idle" | "challenged" | "cleared"; clearedBy: "" | "held" | "waited" };
  /** Pickup-time requests served; the first is refused as rate-limited. */
  slotFetches: number;
  checkout: "account-wall" | "guest";
  checkoutError: string;
  /** A "Buy now" item, which checks out on its own and never enters the cart. */
  express: CartLine | null;
  orders: PlacedOrder[];
  /** Order attempts refused because the hidden form field was filled in. */
  flaggedOrders: number;
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
};

/** Which of the store's pages a document is, as the shell and its script need to know. */
export type PageKind = "home" | "search" | "product" | "cart" | "checkout" | "order" | "seller" | "ad";

/** What a tile's quick-add button adds: the product's first size, by the fastest way the shopper's store offers it. */
export type TileDefault = { sku: string; fulfilment: Fulfilment };
