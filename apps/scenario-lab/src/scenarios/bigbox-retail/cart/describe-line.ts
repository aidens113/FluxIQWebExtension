import { findProduct, variantTitle } from "../catalog/index.js";
import type { CartLine, Product, Variant } from "../types.js";

export type LineView = { line: CartLine; product: Product; variant: Variant; title: string; unitCents: number; totalCents: number };

/** A cart line with the product it names, or undefined for a line naming something the catalog does not carry. */
export function describeLine(line: CartLine): LineView | undefined {
  const found = findProduct(line.productId, line.sku);
  if (!found) return undefined;
  const { product, variant } = found;
  return { line, product, variant, title: variantTitle(product, variant), unitCents: variant.priceCents, totalCents: variant.priceCents * line.qty };
}
