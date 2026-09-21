import { EARBUDS } from "./earbuds.js";
import { sponsoredListing } from "../sponsored-listing.js";
import type { AdPlacement, Product } from "../types.js";

function organic(rank: number): Product {
  const product = EARBUDS[rank];
  if (!product) throw new Error(`No organic earbud listing at rank ${rank}`);
  return product;
}

/**
 * The advertisers bidding on an earbud search, in rotation order. Six promote
 * a listing the search also returns on its own merits, and six promote one it
 * never returns: those are sponsored placements and nothing else, however well
 * they fit what a shopper asked for. Adverts ignore the filter rail, as they
 * do on the real thing, so a narrowed search still shows them.
 */
export const EARBUD_ADS: readonly AdPlacement[] = [
  { adId: "sp-7Q2K91", product: sponsoredListing({ sku: "B0DPN4ANC7", brand: "Pulsebud", title: "Pulsebud Neo ANC Wireless Earbuds, Hybrid Active Noise Cancelling Bluetooth 5.4 Headphones, 50H Playtime, App EQ, Black", priceCents: 3999, rating: 4.5, ratingCount: 8_214, plus: true, seller: "Brightaisle", hue: 210 }) },
  { adId: "sp-3M8XT4", product: organic(3) },
  { adId: "sp-9F1LB6", product: sponsoredListing({ sku: "B0CSCAPR53", brand: "SoundCrest", title: "SoundCrest AirPro Wireless Earbuds Bluetooth 5.3 In-Ear Headphones Stereo Bass 40H Playtime IPX7 Waterproof", priceCents: 1999, rating: 4.0, ratingCount: 1_106, plus: false, seller: "Loudpeak Store", hue: 18 }) },
  { adId: "sp-4H6RZ2", product: sponsoredListing({ sku: "B0KRUNHK42", brand: "Kinetra", title: "Kinetra Run Hook Wireless Earbuds with Ear Hooks, Bluetooth 5.3 Sports Headphones, 60H Playtime, IPX7 Sweatproof, Black", priceCents: 4499, rating: 4.2, ratingCount: 3_377, plus: true, seller: "Brightaisle", hue: 95 }) },
  { adId: "sp-2W5NC8", product: organic(20) },
  { adId: "sp-6J3DP1", product: sponsoredListing({ sku: "B0ZPH5PRGR", brand: "Zephyrline", title: "Zephyrline Z5 Pro Wireless Earbuds, Adaptive Noise Cancelling, Spatial Audio, 45H Playtime, Wireless Charging, Graphite", priceCents: 7999, rating: 4.6, ratingCount: 12_950, plus: true, seller: "Brightaisle", hue: 260 }) },
  { adId: "sp-8T7KV5", product: organic(13) },
  { adId: "sp-1B4QS9", product: sponsoredListing({ sku: "B0TSARCLW1", brand: "Tessaro", title: "Tessaro Arc Lite Wireless Earbuds, Bluetooth 5.3, Clear Calls with 4 Mics, 32H Playtime, White", priceCents: 2499, rating: 4.1, ratingCount: 642, plus: false, seller: "Tessaro Audio", hue: 40 }) },
  { adId: "sp-5R9GM3", product: sponsoredListing({ sku: "B0HLDN3PMB", brand: "Halden", title: "Halden Buds 3 Pro Wireless Earbuds, Lossless Audio, Multipoint Connection, 40H Playtime, Midnight Blue", priceCents: 5999, rating: 4.3, ratingCount: 2_418, plus: true, seller: "Brightaisle", hue: 230 }) },
  { adId: "sp-0C2HW7", product: organic(35) },
  { adId: "sp-7L6YF4", product: organic(50) },
  { adId: "sp-3D8UE6", product: organic(8) },
];
