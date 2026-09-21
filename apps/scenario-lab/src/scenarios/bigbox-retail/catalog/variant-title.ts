import type { Product, Variant } from "../types.js";

/** The name a tile, a product page and a cart line print: the product, then the size when it comes in several. */
export function variantTitle(product: Product, variant: Variant): string {
  return variant.label === "" ? product.name : `${product.name}, ${variant.label}`;
}
