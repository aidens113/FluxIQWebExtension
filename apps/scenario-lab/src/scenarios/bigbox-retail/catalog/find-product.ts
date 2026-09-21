import { PRODUCTS } from "./products.js";
import type { Product, Variant } from "../types.js";

/** A product and one of its sizes, by item id and sku; undefined for anything the catalog does not carry. */
export function findProduct(productId: string, sku?: string): { product: Product; variant: Variant } | undefined {
  const product = PRODUCTS.find((candidate) => candidate.id === productId);
  if (!product) return undefined;
  const variant = sku === undefined ? product.variants[0] : product.variants.find((candidate) => candidate.sku === sku);
  return variant ? { product, variant } : undefined;
}
