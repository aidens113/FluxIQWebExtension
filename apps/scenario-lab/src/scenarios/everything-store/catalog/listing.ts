import type { Product } from "./types.js";

/** Everything a listing needs except the parts derived from its title. */
export type ListingInput = Omit<Product, "slug">;

/**
 * A listing with its URL slug: the title's first eight words, stripped to
 * letters and digits and joined by hyphens, the way the store's product URLs
 * read (`/Tidewell-Electric-Kettle-1-7-L-Stainless/dp/B0...`).
 */
export function listing(input: ListingInput): Product {
  const words = input.title
    .replaceAll("&", " ")
    .split(/[^A-Za-z0-9]+/u)
    .filter((word) => word.length > 0)
    .slice(0, 8);
  return { ...input, slug: words.join("-") };
}
