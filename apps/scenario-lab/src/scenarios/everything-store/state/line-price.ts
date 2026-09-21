import { CATALOG } from "../catalog/index.js";

/**
 * What one unit of a listing costs from a given seller: the store's own price,
 * or a marketplace offer's. `undefined` when the listing cannot be bought --
 * unknown, out of stock, or an offer that is not for that listing.
 */
export function linePrice(sku: string, offerId: string | null): number | undefined {
  const product = CATALOG.bySku(sku);
  if (!product || !product.available) return undefined;
  if (offerId === null) return product.priceCents;
  const offer = CATALOG.offer(offerId);
  return offer && offer.sku === sku ? offer.priceCents : undefined;
}
