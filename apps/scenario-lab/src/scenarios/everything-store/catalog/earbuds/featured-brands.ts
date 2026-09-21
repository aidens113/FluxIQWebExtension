import { EARBUDS } from "./earbuds.js";
import { sponsoredListing } from "../sponsored-listing.js";
import type { Product } from "../types.js";

/**
 * The store's own brand, promoted in a carousel the results page places after
 * the fourth result under a "Sponsored" heading. The heading is the only thing
 * that says so: the tiles themselves carry no label. One of the four is also
 * an organic result further down; the others appear nowhere else.
 */
export const FEATURED_BRANDS: readonly Product[] = [
  sponsoredListing({ sku: "B0BABUDS30", brand: "Brightaisle Basics", title: "Brightaisle Basics Wireless Earbuds, Bluetooth 5.3 with 30H Playtime, IPX5 Water Resistant, Black", priceCents: 1799, rating: 4.1, ratingCount: 21_530, plus: true, seller: "Brightaisle", hue: 200 }),
  sponsoredListing({ sku: "B0BABUDSPR", brand: "Brightaisle Basics", title: "Brightaisle Basics Wireless Earbuds Pro, Active Noise Cancelling, 40H Playtime, White", priceCents: 2999, rating: 4.3, ratingCount: 9_804, plus: true, seller: "Brightaisle", hue: 45 }),
  EARBUDS[12] as Product,
  sponsoredListing({ sku: "B0BAKIDS85", brand: "Brightaisle Basics", title: "Brightaisle Basics Kids Wireless Earbuds, Volume Limited to 85dB, 20H Playtime, Blue", priceCents: 1599, rating: 3.9, ratingCount: 4_120, plus: true, seller: "Brightaisle", hue: 190 }),
];
