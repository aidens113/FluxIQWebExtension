import type { LiveInstructionTask } from "../live-instructions.js";

const PICKUP_TOWELS = "On ValueRidge, find every pack of paper towels that ValueRidge sells itself rather than a marketplace seller, that my store can have ready for pickup today, and that is rated 4.5 stars or higher. The search results for paper towels run over several pages; leave out sponsored listings and list each product once, in the order the results show them under Best match. Give me a table with columns name, price, unitPrice and rating, where name is the product name as listed, price is the current price written like $12.97, unitPrice is the price per unit exactly as printed, like 1.2 ¢/sheet, and rating is the average star rating as a number, like 4.6.";
const PICKUP_CART = "Switch my pickup store to Millbrook Crossing Supercenter, then add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup. Keep what is already in my cart as it is, and do not check out.";
const PICKUP_ORDER = "Order one pack of ValueRidge Essentials Select-A-Size Paper Towels in the 6 Double Rolls size for pickup at my current store, and nothing else: whatever is already in my cart should be saved for later, not bought and not deleted. Check out as a guest as Dana Whitfield, email dana.whitfield@example.com, phone 555-014-2290, take the earliest pickup time on offer, and pay at pickup. Once the order is placed, give me a one-row table with columns order, item, quantity, total and pickup: the order number, the item as the confirmation names it, how many, the order total written like $12.97, and the pickup window exactly as the confirmation writes it.";

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
 * - The two "after creation" rows arm a variant only once the Flow is built:
 *   the product-page redesign (the repair entry point) and the list-layout
 *   experiment (the existing-Flow entry point).
 */
export const BIGBOX_RETAIL_LIVE_TASKS: readonly LiveInstructionTask[] = [
  { id: "bigbox-retail-pickup-towels", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: PICKUP_TOWELS, judgeBy: "expected-dataset", expectedDatasetId: "extract-pickup-towels" },
  { id: "bigbox-retail-pickup-towels-list-layout-after-creation", scenarioId: "bigbox-retail", variantId: "list-layout", variantArmedAfterBuild: true, kind: "navigate-and-extract", instruction: PICKUP_TOWELS, judgeBy: "expected-dataset", expectedDatasetId: "extract-pickup-towels" },
  { id: "bigbox-retail-pickup-cart", scenarioId: "bigbox-retail", kind: "form", instruction: PICKUP_CART, judgeBy: "playback-goal" },
  { id: "bigbox-retail-pickup-cart-redesigned-after-creation", scenarioId: "bigbox-retail", variantId: "redesigned-buy-box", variantArmedAfterBuild: true, kind: "form", instruction: PICKUP_CART, judgeBy: "playback-goal" },
  { id: "bigbox-retail-pickup-order", scenarioId: "bigbox-retail", kind: "navigate-and-extract", instruction: PICKUP_ORDER, judgeBy: "expected-dataset", expectedDatasetId: "extract-order" },
];
