/**
 * What each workflow must end with, written out by hand rather than computed
 * by the code that renders the site, so a bug in the site's own filtering or
 * arithmetic cannot make the page and its oracle agree on a wrong answer.
 * `tests/scenario.test.ts` checks each against the catalog independently.
 */

/**
 * The paper towels ValueRidge sells itself, that the home store (Carden Falls
 * Supercenter) can hand over today, and that are rated 4.5 or better, once
 * each and in best-match order. Sponsored copies are not listings.
 */
export const PICKUP_TOWEL_RECORDS: ReadonlyArray<Readonly<Record<string, string>>> = [
  { name: "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", price: "$8.97", unitPrice: "1.2 ¢/sheet", rating: "4.6" },
  { name: "Loftwell Ultra Strong Paper Towels, 6 Double Rolls", price: "$10.47", unitPrice: "1.4 ¢/sheet", rating: "4.8" },
  { name: "Loftwell Select-A-Size Paper Towels, 12 Double Rolls", price: "$19.94", unitPrice: "1.3 ¢/sheet", rating: "4.7" },
  { name: "Softerra Paper Towels, 6 Double Rolls", price: "$9.47", unitPrice: "1.3 ¢/sheet", rating: "4.5" },
  { name: "Hearthside Paper Towels, 12 Double Rolls", price: "$17.48", unitPrice: "1.2 ¢/sheet", rating: "4.6" },
  { name: "Softerra Pick-A-Sheet Paper Towels, 12 Triple Rolls", price: "$27.97", unitPrice: "1.2 ¢/sheet", rating: "4.7" },
  { name: "Kindleaf Unbleached Paper Towels, 4 Rolls", price: "$7.48", unitPrice: "$1.87/roll", rating: "4.5" },
  { name: "ValueRidge Essentials Paper Towels Value Pack, 15 Rolls", price: "$15.88", unitPrice: "$1.06/roll", rating: "4.7" },
  { name: "Hearthside Select-A-Size Paper Towels, 8 Double Rolls", price: "$14.47", unitPrice: "1.1 ¢/sheet", rating: "4.9" },
];

const fact = (id: string, subject: string, value: string) => ({ id, subject, predicate: "text", value });

/** The mini cart of a returning shopper: the home store, and the dish soap left from the last visit. */
export const START_FACTS = [
  fact("home-store", "mini-cart-store", "Pickup store: Carden Falls Supercenter"),
  fact("leftover-cart", "mini-cart-summary", "1 item · Subtotal $3.97"),
];

/**
 * The pickup cart, built for Millbrook Crossing Supercenter: the soap kept,
 * two 12-roll packs and one 250-count pack added, all three for pickup, and
 * nothing else. $3.97 + 2 × $16.47 + $6.48 is $43.39.
 */
export const PICKUP_CART_FACTS = [
  fact("store-switched", "mini-cart-store", "Pickup store: Millbrook Crossing Supercenter"),
  fact("soap-kept", "mini-cart-line-5530601-pickup", "1 × ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz · Pickup"),
  fact("towels-added", "mini-cart-line-5510202-pickup", "2 × ValueRidge Essentials Select-A-Size Paper Towels, 12 Double Rolls · Pickup"),
  fact("napkins-added", "mini-cart-line-5530102-pickup", "1 × ValueRidge Everyday Dinner Napkins, 250 Count · Pickup"),
  fact("nothing-else", "mini-cart-summary", "4 items · Subtotal $43.39"),
];

/** Reading the results changes nothing: the cart is as the shopper left it. */
export const UNCHANGED_CART_FACTS = [fact("cart-untouched", "mini-cart-summary", "1 item · Subtotal $3.97")];

/**
 * The first order placed since a reset: one 6-roll pack for pickup at the home
 * store in its earliest open slot, paid at pickup. $8.97 plus 7.25% tax
 * ($0.65) is $9.62; the three slots before 2pm are full.
 */
export const ORDER_RECORDS: ReadonlyArray<Readonly<Record<string, string>>> = [
  { order: "2000958-40713", item: "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", quantity: "1", total: "$9.62", pickup: "Mon, Sep 21, 2pm–3pm" },
];

/** After the order: the cart empty, and the soap saved for later rather than bought or deleted. */
export const ORDER_FINAL_FACTS = [
  fact("cart-emptied", "mini-cart-summary", "0 items · Subtotal $0.00"),
  fact("soap-saved", "mini-cart-saved", "Saved for later: 1 item"),
];
