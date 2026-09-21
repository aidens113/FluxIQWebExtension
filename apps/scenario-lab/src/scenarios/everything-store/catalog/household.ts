import { listing } from "./listing.js";
import type { Product } from "./types.js";

function item(sku: string, title: string, brand: string, priceCents: number, rating: number, ratingCount: number, seller: string, hue: number): Product {
  return listing({
    sku, kind: "household", brand, title, priceCents, listPriceCents: null, rating, ratingCount, plus: true, seller,
    bought: null, coupon: null, stock: "In Stock", available: true, family: null, variant: null, hue,
  });
}

/**
 * Everything else the shopper's account touches: what was already in the cart
 * before any run, what was saved for later, and the add-ons the kettle page
 * pushes. Named, because each is referred to by what it is.
 */
export const HOUSEHOLD = {
  phoneCase: item("B0RDGAU8PM", "Ridgeline Slim Case for Aurel 8 Pro, Shockproof Phone Case with Raised Edges, Midnight", "Ridgeline", 1999, 4.5, 7_731, "Ridgeline Official", 250),
  batteries: item("B0BAAA48CT", "Brightaisle Basics AA Alkaline Batteries, 48 Count", "Brightaisle Basics", 1749, 4.7, 88_402, "Brightaisle", 55),
  cloths: item("B0BAMFC24P", "Brightaisle Basics Microfiber Cleaning Cloths, 24 Pack", "Brightaisle Basics", 1299, 4.6, 51_220, "Brightaisle", 180),
  teaSampler: item("B0BATEA12S", "Brightaisle Basics Loose Leaf Tea Sampler, 12 Flavors", "Brightaisle Basics", 1549, 4.3, 2_904, "Brightaisle", 30),
  descaler: item("B0TWDESC04", "Tidewell Kettle Descaler, Citric Acid Limescale Remover, 4 Pack", "Tidewell", 999, 4.6, 5_380, "Brightaisle", 70),
  protectionPlan: item("B0CVG2YK30", "Covergard 2-Year Protection Plan for Kitchen Appliances, 30 to 49.99 Dollars", "Covergard", 799, 4.2, 1_874, "Covergard", 150),
} as const;
