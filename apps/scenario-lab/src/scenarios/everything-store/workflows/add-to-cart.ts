import type { ExpectedFact, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { HOUSEHOLD, TIDEWELL_KETTLES, formatMoney } from "../catalog/index.js";
import { SHARED_STEPS } from "./shared-steps.js";

const FAMILY_CARD = TIDEWELL_KETTLES[0]?.sku ?? "";
const SAGE_17 = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L");
if (!SAGE_17) throw new Error("The Tidewell family has no Sage Green 1.7 L child");
const CASE = HOUSEHOLD.phoneCase.sku;

/**
 * The cart as the task leaves it, newest line first: two Sage Green kettles
 * above the batteries that were already there. The phone case has gone to
 * Saved for later, so it is not a line of the cart.
 */
const CART_RECORDS = [
  { item: SAGE_17.title, quantity: "2", price: formatMoney(SAGE_17.priceCents) },
  { item: HOUSEHOLD.batteries.title, quantity: "1", price: formatMoney(HOUSEHOLD.batteries.priceCents) },
];

const SUBTOTAL: ExpectedFact = {
  id: "cart-subtotal",
  subject: "cart-subtotal",
  predicate: "text",
  value: `Subtotal (3 items): ${formatMoney(SAGE_17.priceCents * 2 + HOUSEHOLD.batteries.priceCents)}`,
};

/**
 * Put two Sage Green 1.7 L kettles in the cart, move the phone case already
 * there to Saved for later, and read the cart back. The state change is
 * judged by that read: the cart page is rendered from the store's own record,
 * so what it lists is what the store holds.
 *
 * Save for later fails its first request of a session: the row keeps its
 * spinner and only offers "Try again" after four seconds. The recording waits
 * for that and retries, as a person does.
 *
 * `redesigned-header` is the repair entry point. The header was redesigned
 * between the recording and the run: the search button the recording names
 * by test id is gone, the button that searches is now named "Search
 * Brightaisle" and sits further left, and "Search with your camera" stands
 * where it stood. A correct repair re-points the press at the search button;
 * the camera opens an image upload and searches nothing.
 */
export const ADD_TO_CART_WORKFLOW: ScenarioWorkflow = {
  id: "add-to-cart",
  description: "Add two Sage Green 1.7 L Tidewell kettles sold by Brightaisle to the cart, move the phone case already in it to Saved for later, and read back what the cart holds.",
  recordingScript: [
    ...SHARED_STEPS.openStore,
    ...SHARED_STEPS.search("cart", "tidewell kettle"),
    { id: "cart-kettle-listed", operation: "waitForState", target: `[data-component="search-result"][data-sku="${FAMILY_CARD}"]`, timeoutMs: 6000 },
    { id: "cart-open-kettle", operation: "click", target: `[data-component="search-result"][data-sku="${FAMILY_CARD}"]:not([data-ad-id]) h2 a` },
    { id: "cart-chat-opened", operation: "waitForState", target: "role:dialog:Brightaisle Assistant", timeoutMs: 9000 },
    { id: "cart-minimize-chat", operation: "click", target: "role:button:Minimize chat" },
    { id: "cart-choose-sage", operation: "click", target: `[title="Click to select Sage Green"]` },
    { id: "cart-app-banner", operation: "waitForState", target: `[title="Close"]`, timeoutMs: 6000 },
    { id: "cart-close-app-banner", operation: "click", target: `[title="Close"]` },
    { id: "cart-quantity-two", operation: "select", target: `select[name="quantity"]`, value: "2" },
    { id: "cart-add", operation: "click", target: "role:button:Add to Cart" },
    { id: "cart-added", operation: "waitForState", target: "role:dialog:Added to cart", timeoutMs: 6000 },
    { id: "cart-go-to-cart", operation: "click", target: "role:link:Go to Cart" },
    { id: "cart-save-case", operation: "click", target: `[data-name="Active Items"] [data-sku="${CASE}"] [data-action="save-for-later"]` },
    { id: "cart-save-failed", operation: "waitForState", target: `[data-sku="${CASE}"] p span[tabindex="0"]`, timeoutMs: 8000 },
    { id: "cart-save-retry", operation: "click", target: `[data-sku="${CASE}"] p span[tabindex="0"]` },
    { id: "cart-case-saved", operation: "waitForState", target: `[data-name="Saved Cart Items"] [data-sku="${CASE}"]`, timeoutMs: 6000 },
    {
      id: "extract-cart",
      operation: "extract",
      target: `[data-name="Active Items"] [data-line]`,
      fields: { item: `a[href*="/dp/"] > span`, quantity: `[aria-live="polite"]`, price: ":scope > p > span" },
    },
    { id: "cart-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [...SHARED_STEPS.homeFacts],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }, { type: "web.element.changed" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.select", outcome: "succeeded" },
      { action: "web.dom.extract_list", outcome: "succeeded" },
    ],
    extracted: [{ step: "extract-cart", count: CART_RECORDS.length, records: CART_RECORDS }],
    finalState: [SUBTOTAL, SHARED_STEPS.notChallenged],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "redesigned-header",
    description: "Only a repair can pass this row. The header was redesigned: the search button the recording names by test id is gone, the button that searches is now named Search Brightaisle and has moved left, and Search with your camera and Search by voice stand where it stood. A provider-free run fails with target_not_found; the expectations are the repaired run's, so a model that re-points the press at Search Brightaisle completes the task, and one that presses the camera opens an upload dialog and searches nothing.",
    arm: { operation: "set-mode", payload: { mode: "redesigned-header" } },
    expected: {
      pageFacts: [
        { id: "recorded-search-button-gone", subject: "nav-search-submit", predicate: "exists", value: false },
        { id: "cart-starts-with-two", subject: "cart-count", predicate: "text", value: "2" },
        { id: "search-box-label", subject: "document", predicate: "label-count:Search Brightaisle", value: 1 },
      ],
      extracted: [{ step: "extract-cart", count: CART_RECORDS.length, records: CART_RECORDS }],
      finalState: [SUBTOTAL, SHARED_STEPS.notChallenged],
    },
  }],
};
