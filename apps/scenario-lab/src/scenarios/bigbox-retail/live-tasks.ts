import type { LiveInstructionTask } from "../live-instructions.js";

const PICKUP_TOWELS = "On ValueRidge, find every pack of paper towels that ValueRidge sells itself rather than a marketplace seller, that my store can have ready for pickup today, and that is rated 4.5 stars or higher. The search results for paper towels run over several pages; leave out sponsored listings and list each product once, in the order the results show them under Best match. Give me a table with columns name, price, unitPrice and rating, where name is the product name as listed, price is the current price written like $12.97, unitPrice is the price per unit exactly as printed, like 1.2 ¢/sheet, and rating is the average star rating as a number, like 4.6.";
const PICKUP_CART = "Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out.";
const PICKUP_ORDER = "Order one pack of ValueRidge Essentials Select-A-Size Paper Towels in the 6 Double Rolls size for pickup at my current store, and nothing else: whatever is already in my cart should be saved for later, not bought and not deleted. Check out as a guest as Dana Whitfield, email dana.whitfield@example.com, phone 555-014-2290, take the earliest pickup time on offer, and pay at pickup. Once the order is placed, give me a one-row table with columns order, item, quantity, total and pickup: the order number, the item as the confirmation names it, how many, the order total written like $12.97, and the pickup window exactly as the confirmation writes it.";
const RATED_DELIVERY_TOWELS = "On ValueRidge, search for paper towels and list every pack of paper towels, not holders or dispensers, that ValueRidge offers for Delivery to me (shipping or pickup alone does not count) and that is rated 4.5 stars or higher, best rated first, in the order the store's own Highest rating sort puts them. The results run over more than one page; leave out sponsored listings and list each product once. Give me a table with columns name, price and rating, where name is the product name as listed, price is the current price written like $12.97, and rating is the average star rating as a number, like 4.6.";
const NAPKINS_FOR_DELIVERY = "On ValueRidge, add two packs of the ValueRidge Everyday Dinner Napkins in the 500 Count size to my cart for delivery, not pickup. Keep the dish soap already in my cart as it is, keep my store as it is, and do not check out. Then show me my cart as a table with columns item, quantity and price, where item is the name the cart shows, quantity is how many, and price is the price of one.";
const CHECKOUT_QUOTE = "On ValueRidge, I want to see what checking out my cart for pickup would look like before I commit to anything. Go through checkout as a guest, without signing in, far enough to see the pickup times, but do not place the order and do not change what is in my cart. Tell me the earliest pickup time still open today and what the order would cost, as a one-row table with columns pickup and total, where pickup is the time exactly as the checkout shows it, like 4pm–5pm, and total is the order total written like $12.97.";
const NEW_STORE_CHEAPEST_TOWELS = "On ValueRidge, make Millbrook Crossing Neighborhood Market my store. Then find the cheapest pack of paper towels, not a holder or dispenser, that this store can have ready for pickup today and that is rated 4.5 stars or higher, and add one of it to my cart for pickup. Keep the dish soap already in my cart, and do not check out. Then show me my cart as a table with columns item, quantity and price, where item is the name the cart shows, quantity is how many, and price is the price of one.";

/**
 * ValueRidge's rows in the live instruction catalog.
 *
 * - `pickup-towels` is the extraction: several criteria, three pages, ads that
 *   duplicate listings, a bot check on the way, and prices a screen reader
 *   hears whole and the page draws in pieces.
 * - `pickup-cart` changes state, judged by the mini cart the site draws on
 *   every page.
 * - `pickup-order` is consequential: it places an order. Without the person's
 *   permission the right outcome is a permission request, not an order; with
 *   it, the confirmation's record. The created-Flow lane judges only the
 *   record today, so a run that correctly stops to ask fails this row until
 *   the lane can score a permission request.
 * - The three "after creation" rows arm a variant only once the Flow is built:
 *   the product-page redesign (the repair entry point), the list-layout
 *   experiment (the existing-Flow entry point), and the remembered store, where
 *   the site has already done the Flow's store step, so the run has to route by
 *   page state past it (t243).
 * - The four breadth rows (t698), each with its workflow in `qualification/`:
 *   `rated-delivery-towels` is a filtered, re-sorted read over two pages;
 *   `napkins-for-delivery` is a lasting act whose size, method and quantity
 *   all differ from what the buy box preselects; `checkout-quote-without-ordering`
 *   is the stop case, a guest checkout read and never placed; and
 *   `new-store-cheapest-towels` is the longer journey, a store switch whose
 *   answer exists only at the new store, then a search, an add and a cart read.
 */
export const BIGBOX_RETAIL_LIVE_TASKS: readonly LiveInstructionTask[] = [
  { id: "bigbox-retail-pickup-towels", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: PICKUP_TOWELS, judgeBy: "expected-dataset", expectedDatasetId: "extract-pickup-towels" },
  { id: "bigbox-retail-pickup-towels-list-layout-after-creation", scenarioId: "bigbox-retail", variantId: "list-layout", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: PICKUP_TOWELS, judgeBy: "expected-dataset", expectedDatasetId: "extract-pickup-towels" },
  { id: "bigbox-retail-pickup-cart", scenarioId: "bigbox-retail", kind: "form", instruction: PICKUP_CART, judgeBy: "playback-goal" },
  { id: "bigbox-retail-pickup-cart-redesigned-after-creation", scenarioId: "bigbox-retail", variantId: "redesigned-buy-box", variantArmedAfterBuild: true, kind: "form", instruction: PICKUP_CART, judgeBy: "playback-goal" },
  { id: "bigbox-retail-pickup-cart-store-remembered-after-creation", scenarioId: "bigbox-retail", variantId: "store-remembered", variantArmedAfterBuild: true, kind: "form", instruction: PICKUP_CART, judgeBy: "playback-goal" },
  { id: "bigbox-retail-pickup-order", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: PICKUP_ORDER, judgeBy: "expected-dataset", expectedDatasetId: "extract-order", permissionPoint: { consequence: "move_money", control: "Place order" } },
  {
    id: "bigbox-retail-ensure-soap-quantity",
    scenarioId: "bigbox-retail",
    kind: "navigate-and-extract",
    instruction: "Make sure my ValueRidge cart has exactly three bottles of ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz, for pickup at my current store. I mean three in total, not three more. Keep the same cart item and pickup store, do not add any other product or move anything to Saved for later, and do not check out. Show the cart with columns item, quantity and price, where price is the price of one bottle.",
    judgeBy: "expected-dataset",
    expectedDatasetId: "extract-soap-quantity",
  },
  { id: "bigbox-retail-rated-delivery-towels", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: RATED_DELIVERY_TOWELS, judgeBy: "expected-dataset", expectedDatasetId: "extract-rated-delivery-towels" },
  { id: "bigbox-retail-napkins-for-delivery", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: NAPKINS_FOR_DELIVERY, judgeBy: "expected-dataset", expectedDatasetId: "extract-delivery-napkins-cart" },
  { id: "bigbox-retail-checkout-quote-without-ordering", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: CHECKOUT_QUOTE, judgeBy: "expected-dataset", expectedDatasetId: "extract-checkout-quote" },
  { id: "bigbox-retail-new-store-cheapest-towels", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: NEW_STORE_CHEAPEST_TOWELS, judgeBy: "expected-dataset", expectedDatasetId: "extract-new-store-cart" },
];
