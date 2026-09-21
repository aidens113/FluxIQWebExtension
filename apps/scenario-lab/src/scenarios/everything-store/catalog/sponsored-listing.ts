import { listing } from "./listing.js";
import type { Product } from "./types.js";

/** A listing that exists to be advertised: in stock, no pickers, no coupon unless given. */
export function sponsoredListing(input: Pick<Product, "sku" | "brand" | "title" | "priceCents" | "rating" | "ratingCount" | "plus" | "seller" | "hue"> & Partial<Product>): Product {
  return listing({
    kind: "earbuds",
    listPriceCents: null,
    bought: null,
    coupon: null,
    stock: "In Stock",
    available: true,
    family: null,
    variant: null,
    ...input,
  });
}
