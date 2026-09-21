import { listing } from "../listing.js";
import type { Product } from "../types.js";

type Child = readonly [sku: string, colour: string, capacity: string, priceCents: number, stock: string];

/** One kettle in three finishes and two sizes; one combination is out of stock. */
const CHILDREN: readonly Child[] = [
  ["B0D7KX2M4P", "Brushed Steel", "1.7 L", 3999, "In Stock"],
  ["B0D7KX9MBL", "Matte Black", "1.7 L", 4499, "Only 3 left in stock - order soon."],
  ["B0D7KXS4G7", "Sage Green", "1.7 L", 4499, "Only 4 left in stock - order soon."],
  ["B0D7KX1B10", "Brushed Steel", "1.0 L", 3499, "In Stock"],
  ["B0D7KX1M10", "Matte Black", "1.0 L", 3699, "In Stock"],
  ["B0D7KX1S10", "Sage Green", "1.0 L", 3699, "Currently unavailable."],
];

const HUES: Readonly<Record<string, number>> = { "Brushed Steel": 210, "Matte Black": 0, "Sage Green": 120 };

/**
 * The Tidewell electric kettle family, the listing both kettle tasks are
 * about. Every child is its own listing with its own id and URL, as a
 * product with pickers is; the first is the one the search card shows and the
 * page opens on. Each child's title ends in its finish, which is how a cart or
 * an order names the one that was bought.
 */
export const TIDEWELL_KETTLES: readonly Product[] = CHILDREN.map(([sku, colour, capacity, priceCents, stock]) => listing({
  sku,
  kind: "kettle",
  brand: "Tidewell",
  title: `Tidewell Electric Kettle ${capacity}, Stainless Steel Cordless Tea Kettle with Auto Shut-Off and Boil-Dry Protection, ${colour}`,
  priceCents,
  listPriceCents: capacity === "1.7 L" ? 5999 : null,
  rating: 4.6,
  ratingCount: 18_342,
  plus: true,
  seller: "Brightaisle",
  bought: capacity === "1.7 L" ? "3K+ bought in past month" : null,
  coupon: null,
  stock,
  available: stock !== "Currently unavailable.",
  family: "tidewell-kettle",
  variant: { colour, capacity },
  hue: HUES[colour] ?? 0,
}));
