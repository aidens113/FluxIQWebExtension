import { HOUSEHOLD } from "../household.js";
import { listing } from "../listing.js";
import { TIDEWELL_KETTLES } from "./tidewell-kettles.js";
import type { Product } from "../types.js";

function kettle(sku: string, brand: string, title: string, priceCents: number, rating: number, ratingCount: number, plus: boolean, seller: string, hue: number): Product {
  return listing({
    sku, kind: "kettle", brand, title, priceCents, listPriceCents: null, rating, ratingCount, plus, seller,
    bought: null, coupon: null, stock: "In Stock", available: true, family: null, variant: null, hue,
  });
}

/**
 * What a kettle search returns, in relevance order. The family shows as one
 * card, its first child. Around it: the same kettle refurbished by a
 * marketplace seller, the same brand's gooseneck kettle, the store's own
 * kettle, and other brands; and a descaler, which is not a kettle at all.
 */
export const KETTLES: readonly Product[] = [
  TIDEWELL_KETTLES[0] as Product,
  kettle("B0RNW17BRS", "Tidewell", "Tidewell Electric Kettle 1.7 L, Stainless Steel Cordless Tea Kettle, Brushed Steel (Renewed)", 2749, 4.1, 512, false, "RefreshTech Outlet", 205),
  kettle("B0TWGOOSE9", "Tidewell", "Tidewell Gooseneck Electric Kettle with Variable Temperature, 0.9 L Pour-Over Kettle for Coffee and Tea, Matte Black", 6999, 4.7, 6_021, true, "Brightaisle", 5),
  kettle("B0BAKTL15W", "Brightaisle Basics", "Brightaisle Basics Electric Kettle 1.5 L, BPA-Free, Auto Shut-Off, White", 1999, 4.4, 32_114, true, "Brightaisle", 60),
  kettle("B0LUMGLS18", "Lumo Home", "Lumo Home Glass Electric Kettle 1.8 L with Blue LED, Borosilicate Glass Tea Kettle", 3299, 4.5, 14_870, true, "Brightaisle", 220),
  HOUSEHOLD.descaler,
  kettle("B0OAKRTR17", "Oakhaven Kitchen", "Oakhaven Kitchen Retro Electric Kettle 1.7 L, Stainless Steel, Cream", 5499, 4.3, 3_102, true, "Brightaisle", 40),
  kettle("B0VIRVT17S", "Vireo Home", "Vireo Home Variable Temperature Electric Kettle 1.7 L with Keep Warm, Stainless Steel", 4999, 4.4, 7_755, true, "Brightaisle", 190),
  kettle("B0QLTRV08C", "Quillon", "Quillon Travel Electric Kettle 0.8 L, Collapsible Silicone, Dual Voltage", 2799, 3.9, 861, false, "Quillon Gear", 280),
];
