import type { Product } from "../types.js";

export type SortOption = { value: string; label: string; compare(left: Product, right: Product): number };

const price = (product: Product) => product.variants[0]!.priceCents;

/** The sort select, in its order; the first is the default and keeps the catalog's best-match order. */
export const SORT_OPTIONS: readonly SortOption[] = [
  { value: "best_match", label: "Best match", compare: () => 0 },
  { value: "price_low", label: "Price low to high", compare: (left, right) => price(left) - price(right) },
  { value: "price_high", label: "Price high to low", compare: (left, right) => price(right) - price(left) },
  { value: "best_seller", label: "Best seller", compare: (left, right) => right.reviews - left.reviews },
  { value: "rating_high", label: "Highest rating", compare: (left, right) => right.rating - left.rating || right.reviews - left.reviews },
];
