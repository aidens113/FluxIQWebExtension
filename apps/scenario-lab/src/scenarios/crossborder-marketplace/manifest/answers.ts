import { listingById, ORGANIC_LISTINGS, storeById, VOLTBAY_OFFICIAL_ID, type SkuChoice } from "../catalog/index.js";
import { formatMoney } from "../locale/index.js";
import { miniCartLineText } from "../markup/index.js";
import { orderNumber, sessionTotals } from "../state/index.js";

/** The fixture's canonical seed. The recorded selectors name its class hashes and the order answer names its first order number. */
export const MARKET_SEED = 7342;

/** The option set both purchase tasks ask for. */
export const HUB_CHOICE: SkuChoice = { color: "Space Grey", spec: "7-in-1", origin: "Spain" };
/** How many the cart task adds, and how many the purchase task buys. */
export const CART_QUANTITY = 3;
export const ORDER_QUANTITY = 2;

/**
 * The hubs a buyer asked for "ships from Spain, free shipping, rated 4.5 or
 * better, no ads, each once" gets, in the search's Best Match order, as the
 * cards write them for a buyer in Germany. Computed from the catalogue rather
 * than read off a page, so the page is what is tested: the browser test reads
 * the same thirteen records off the rendered results, by the filters and by
 * paging through the unfiltered search and deduplicating, and both must equal
 * this list.
 */
export function spainHubRecords(): Array<Record<string, string>> {
  return ORGANIC_LISTINGS
    .filter((listing) => listing.origins.includes("Spain") && listing.shipping.kind === "free" && listing.rating !== null && listing.rating >= 45)
    .map((listing) => ({
      title: listing.title,
      store: storeById(listing.storeId).name,
      price: formatMoney(listing.priceCents, "DE"),
      rating: (listing.rating! / 10).toFixed(1),
    }));
}

/** The one line the cart task leaves in the cart, as the header's cart flyout writes it. */
export function cartLineText(): string {
  return miniCartLineText(VOLTBAY_OFFICIAL_ID, HUB_CHOICE, CART_QUANTITY);
}

/** The Voltbay Official Store coupon as the account flyout lists it for a buyer in Germany. */
export function officialCouponText(): string {
  const coupon = storeById("voltbay-official").coupon!;
  return `Store coupons: Voltbay Official Store ${formatMoney(coupon.offCents, "DE")} off orders over ${formatMoney(coupon.minimumCents, "DE")}`;
}

/**
 * What the confirmation page of the purchase task shows: the first order the
 * canonical seed numbers, the listing, its options, the quantity, and the
 * total -- two at 22,99 €, less the store's 2,00 € coupon, shipped free.
 */
export function orderRecord(): Record<string, string> {
  const listing = listingById(VOLTBAY_OFFICIAL_ID)!;
  const line = { id: "now", listingId: listing.id, choice: HUB_CHOICE, quantity: ORDER_QUANTITY };
  const totals = sessionTotals([line], {}, ["voltbay-official"]);
  return {
    order: orderNumber(MARKET_SEED, 0),
    item: listing.title,
    options: "Space Grey · 7-in-1 · Ships from Spain",
    quantity: String(ORDER_QUANTITY),
    total: formatMoney(totals.totalCents, "DE"),
  };
}
