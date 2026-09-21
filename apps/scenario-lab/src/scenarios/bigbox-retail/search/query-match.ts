import type { Product } from "../types.js";

/** Lower-cased words with a plural "s" dropped, so "towels" finds "Towel". */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean).map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
}

/**
 * Whether a product answers a query: every word of the query starts some word
 * of the product's name, brand or department. "paper towels" therefore finds
 * holders and a dispenser too, as a store search does.
 */
export function matchesQuery(product: Product, query: string): boolean {
  const wanted = words(query);
  if (wanted.length === 0) return false;
  const have = words(`${product.name} ${product.brand} ${product.department}`);
  return wanted.every((word) => have.some((candidate) => candidate.startsWith(word)));
}
