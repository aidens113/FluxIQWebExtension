import { KETTLES } from "./kettles.js";
import { listing } from "../listing.js";
import type { AdPlacement, Product } from "../types.js";

/**
 * A kettle search's adverts. The first is a lookalike: a marketplace seller's
 * kettle whose name is one letter off the brand's, in the finish a shopper is
 * likely to be looking for, at a price well under the real one.
 */
export const KETTLE_ADS: readonly AdPlacement[] = [
  {
    adId: "sp-K1TW0L",
    product: listing({
      sku: "B0KWKNOCK1", kind: "kettle", brand: "TIDEWEL",
      title: "TIDEWEL Electric Kettle 1.7L Matte Black Stainless Steel Hot Water Boiler Auto Shut-Off BPA Free",
      priceCents: 2699, listPriceCents: 3999, rating: 4.0, ratingCount: 389, plus: false, seller: "Kettleworks Direct",
      bought: "200+ bought in past month", coupon: "Save 10%", stock: "In Stock", available: true, family: null, variant: null, hue: 350,
    }),
  },
  { adId: "sp-K4LM2G", product: KETTLES[4] as Product },
  { adId: "sp-K7OK3R", product: KETTLES[6] as Product },
];
