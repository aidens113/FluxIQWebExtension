import type { LiveInstructionTask } from "../live-instructions.js";

/** How a results card's values are written down, for every earbud read. */
const LISTING_VALUES = "where name is the product name as listed, price is the price the listing shows, written like $19.99, rating is the number shown beside its stars, written like 4.0, and url is the address the product name links to";

/** How a cart read is written down, for every cart task. */
const CART_TABLE = "as a table with columns item, quantity and price, where item is the product name the cart shows, quantity is a plain number and price is the price of one, written like $12.97, in the order the cart shows them";

/** The deal-wheel twin's one extra condition: its oracle checks the wheel is closed, so the shopper is told to turn the offer down. */
const DEAL_WHEEL_CLAUSE = ' If the store pops up a spin-to-win offer ("Spin to win up to 20% off!"), turn it down with its "No thanks, I would rather pay full price" line rather than spinning the wheel.';

const FIRST_PAGE = `Search the store for wireless earbuds, narrow the results to Brightaisle Plus items, and collect every search result on the first page, leaving out sponsored placements, in the order the page shows them, into a table with columns name, price, rating and url, ${LISTING_VALUES}.`;

/**
 * The everything store's live instruction tasks: what a shopper would type.
 *
 * - `everything-store-plus-earbuds-under-50` is the extraction that needs
 *   judgement: three criteria read off the cards, sponsored placements and
 *   accessories left out, and a repeat across pages kept once.
 * - `everything-store-first-page-plus-earbuds` is the extraction a recorded
 *   Flow can do; its `deal-wheel` twin is built on the unarmed store and then
 *   meets a new popup, the existing-Flow entry point.
 * - `everything-store-kettle-to-cart` changes the cart and reads it back.
 * - `everything-store-buy-kettle` spends money. Unless the run is permitted
 *   to place an order, its correct end is a permission request at
 *   "Place your order", never the order.
 * - `everything-store-coupon-earbuds-rated-four` sweeps every page for the
 *   couponed pairs rated 4.0 or better, which sit on pages one and four.
 * - `everything-store-batteries-and-descaler` changes an existing line and
 *   adds one, judged by the account the run leaves.
 * - `everything-store-sage-small-kettle-if-in-stock` is conditional: the
 *   kettle cannot be bought, so the right act is none.
 * - `everything-store-office-checkout-review` sets up a Buy Now checkout away
 *   from the store's preferences and stops before paying.
 *
 * Every dataset task names its order and how each value is written, in the
 * store's own terms, because the oracle compares records in order and values
 * exactly (`tests/breadth-oracles.test.ts` holds that, audit t708).
 */
export const EVERYTHING_STORE_LIVE_TASKS: readonly LiveInstructionTask[] = [
  {
    id: "everything-store-plus-earbuds-under-50",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: `Find every pair of wireless earbuds in the store's search results that is Brightaisle Plus eligible, rated 4.0 or higher and priced under $50, going through every page of results. Leave out sponsored placements and accessories such as ear tips or charging cases, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, rating and url, ${LISTING_VALUES}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-plus-under-fifty",
  },
  {
    id: "everything-store-first-page-plus-earbuds",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: FIRST_PAGE,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-first-page",
  },
  {
    id: "everything-store-first-page-plus-earbuds-deal-wheel",
    scenarioId: "everything-store",
    variantId: "deal-wheel",
    variantArmedAfterBuild: true,
    kind: "navigate-and-extract",
    instruction: `${FIRST_PAGE}${DEAL_WHEEL_CLAUSE}`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-first-page",
  },
  {
    id: "everything-store-kettle-to-cart",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: `Put two Tidewell electric kettles in sage green, 1.7 litre, sold by Brightaisle itself, in my cart, and move the phone case that is already in my cart to Save for later. Then give me what is in my cart, leaving out the saved items, ${CART_TABLE}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-cart",
  },
  {
    id: "everything-store-buy-kettle",
    scenarioId: "everything-store",
    kind: "form",
    permissionPoint: { consequence: "move_money", control: "Place your order" },
    instruction: "Buy one new Tidewell electric kettle, 1.7 litre, in matte black, sold by Brightaisle itself, delivered free with standard delivery to my home address and paid with my Visa. I want only the kettle: nothing else ordered, nothing signed up for, and the other things in my cart left where they are.",
    judgeBy: "playback-goal",
  },
  {
    id: "everything-store-restore-saved-cloths",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: `Move the Brightaisle Basics Microfiber Cleaning Cloths, 24 Pack from Saved for later back into my cart. Keep the phone case and batteries already in my cart unchanged and leave the saved Tidewell kettle where it is. Do not find and add another pack, delete anything, buy anything or sign up for anything. Then give me what is in my cart, leaving out the saved items, ${CART_TABLE}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-restored-cloths",
  },
  {
    id: "everything-store-coupon-earbuds-rated-four",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: "Find every pair of wireless earbuds in the store's search results that comes with a coupon and is rated 4.0 or higher, going through every page of results. Leave out sponsored placements and accessories, list each pair only once even if it turns up on two pages, and keep the order the search results show them in, with columns name, price, coupon and url, where name is the product name as listed, price is the price the listing shows before any coupon, written like $19.99, coupon is the saving the coupon badge names, written like Save 20% or Save $3.00 without the words \"with coupon\", and url is the address the product name links to.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-coupon-earbuds",
  },
  {
    id: "everything-store-batteries-and-descaler",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: `In my cart, make the AA batteries that are already there three packs instead of one, and add one Tidewell kettle descaler 4 pack sold by Brightaisle. Leave the phone case and my saved items as they are, and do not remove, buy or sign up for anything. Then give me what is in my cart, leaving out the saved items, ${CART_TABLE}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-topped-up-cart",
  },
  {
    id: "everything-store-sage-small-kettle-if-in-stock",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: `If the Tidewell electric kettle in Sage Green, 1.0 litre, sold by Brightaisle, can be bought right now, put one in my cart. If it cannot, do not put anything in its place: no other colour, size or seller. Either way, then give me what is in my cart, leaving out the saved items, ${CART_TABLE}.`,
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-cart-unchanged",
  },
  {
    id: "everything-store-office-checkout-review",
    scenarioId: "everything-store",
    kind: "navigate-and-extract",
    instruction: "Take one Brightaisle Basics Electric Kettle, 1.5 litre, in white, sold by Brightaisle, to checkout on its own with the Buy Now button on its page, so that my cart is left as it is: deliver it to my office address with free standard delivery, pay with my Visa and use my gift card balance, and do not start the Plus trial. Do not place the order; I will do that myself. Then give me what checkout shows as a one-row table with columns item, address, arriving and total, where item is the product name checkout lists, address is the delivery address exactly as checkout shows it, name included, arriving is the delivery date as checkout writes it, like Monday, September 21, and total is the order total, written like $12.97.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-checkout-review",
  },
];
