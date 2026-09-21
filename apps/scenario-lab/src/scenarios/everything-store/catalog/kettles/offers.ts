import type { Product } from "../types.js";
import { TIDEWELL_KETTLES } from "./tidewell-kettles.js";

/** A marketplace seller's offer on a listing: same product page, different seller, price and condition. */
export type Offer = { offerId: string; sku: string; seller: string; condition: "New" | "Used - Like New"; priceCents: number };

function child(index: number): Product {
  const product = TIDEWELL_KETTLES[index];
  if (!product) throw new Error(`No Tidewell kettle child ${index}`);
  return product;
}

/**
 * The "Other sellers" behind the kettle's buy box. Cheaper than the store's
 * own offer, which is exactly why a shopper who asked for the kettle sold by
 * Brightaisle must not take one.
 */
export const OFFERS: readonly Offer[] = [
  { offerId: "ofr-kw-mb17", sku: child(1).sku, seller: "Kettleworks Direct", condition: "New", priceCents: 4150 },
  { offerId: "ofr-hg-mb17", sku: child(1).sku, seller: "HomeGoods Resale", condition: "Used - Like New", priceCents: 3300 },
  { offerId: "ofr-kw-sg17", sku: child(2).sku, seller: "Kettleworks Direct", condition: "New", priceCents: 4150 },
  { offerId: "ofr-kw-bs17", sku: child(0).sku, seller: "Kettleworks Direct", condition: "New", priceCents: 3725 },
];
