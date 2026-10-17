import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { SITE_ROOT } from "../catalog/index.js";
import { OPENING_STEPS, openListingStep, searchSteps } from "../manifest/opening-steps.js";
import { bigboxClasses } from "../theme/index.js";
import { accountFact } from "./account-fact.js";
import { cartReadStep } from "./cart-read.js";
import { FACET_TARGETS as facet } from "./facet-targets.js";
import { LEFTOVER_SOAP_LINE } from "./leftover-soap-line.js";

const c = bigboxClasses("baseline", 239);
const fact = (id: string, subject: string, value: string) => ({ id, subject, predicate: "text", value });
const STORE = "Millbrook Crossing Neighborhood Market";

/**
 * The cheapest paper towels Millbrook Crossing Neighborhood Market can hand
 * over today rated 4.5 or better: the store-brand single roll at $1.28, which
 * the home store has only tomorrow. At the home store the answer would be the
 * Kindleaf 4-roll pack at $7.48 (the $2.97 Kitchen pack is rated 4.3), so a
 * run that skipped the store switch adds the wrong item. Two items, $5.25.
 */
const ROLL = { lineId: "L2", productId: "418830166", sku: "5510204", qty: 1, fulfilment: "pickup" } as const;
const START = { storeId: "2291", cart: [LEFTOVER_SOAP_LINE], saved: [], nextLine: 2, checkout: "account-wall", expressOpen: false, orderCount: 0, flaggedOrders: 0 } as const;

/**
 * A longer journey: the store picker in its shadow root (whose other
 * Millbrook Crossing store is a Supercenter), a search narrowed by three
 * filters with the bot check on the way, the price sort, the product page and
 * its two-press Add to cart, and a read of the cart.
 */
export const NEW_STORE_CHEAPEST_TOWELS_WORKFLOW: ScenarioWorkflow = {
  id: "new-store-cheapest-towels",
  recordingDescription: "Demonstrates changing the store, narrowing and sorting a search, adding the chosen item and reviewing the cart.",
  description: "Make Millbrook Crossing Neighborhood Market the store, add one of the cheapest paper towels it can hand over today rated 4.5 or better, keeping the soap, and read the cart.",
  recordingScript: [
    ...OPENING_STEPS,
    { id: "new-store-picker", operation: "click", target: "vr-fulfillment-picker button >> nth=0" },
    { id: "choose-neighborhood-market", operation: "click", target: `vr-fulfillment-picker li:has(strong:text-is("${STORE}")) button` },
    { id: "new-store-changed", operation: "waitForState", target: `vr-fulfillment-picker span:text-is("${STORE}")`, timeoutMs: 8000 },
    ...searchSteps("new-store-search", "paper towels"),
    { id: "new-store-paper-towels", operation: "click", target: facet.option("Department", "Paper Towels") },
    { id: "new-store-department-ticked", operation: "waitForState", target: facet.ticked("Department"), timeoutMs: 8000 },
    { id: "new-store-pickup", operation: "click", target: facet.option("Fulfillment", "Pickup") },
    { id: "new-store-bot-check-passed", operation: "waitForState", target: facet.ticked("Fulfillment"), timeoutMs: 25000 },
    { id: "new-store-today", operation: "click", target: facet.option("Speed", "Today") },
    { id: "new-store-today-ticked", operation: "waitForState", target: facet.ticked("Speed"), timeoutMs: 8000 },
    { id: "new-store-cheapest-first", operation: "select", target: "select[name=sort]", value: "price_low" },
    { id: "new-store-sorted", operation: "waitForState", target: "div[data-item-id=\"418830166\"]:first-child", timeoutMs: 8000 },
    openListingStep("open-cheapest-towels", "418830166"),
    { id: "cheapest-box-ready", operation: "waitForState", target: "p:text-is(\"How you'll get this item:\")", timeoutMs: 5000 },
    { id: "cheapest-assistant-opens", operation: "waitForState", target: "vr-assist strong:has-text(\"Hi, I'm Val\")", timeoutMs: 8000 },
    { id: "cheapest-close-assistant", operation: "click", target: "vr-assist div:text-is(\"×\") >> nth=0" },
    { id: "wake-cheapest", operation: "click", target: "testid:atc" },
    { id: "add-cheapest", operation: "click", target: "testid:atc" },
    { id: "cheapest-added", operation: "waitForState", target: "aside strong:has-text(\"Added to cart\")", timeoutMs: 5000 },
    { id: "new-store-cart", operation: "navigate", path: `${SITE_ROOT}cart` },
    { id: "new-store-cart-ready", operation: "waitForState", target: `.${c.cartLayout}:not([hidden])`, timeoutMs: 5000 },
    cartReadStep("extract-new-store-cart"),
    { id: "new-store-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [accountFact("new-store-start", START)],
    extracted: [{
      step: "extract-new-store-cart",
      count: 2,
      records: [
        { item: "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz", quantity: "1", price: "$3.97" },
        { item: "ValueRidge Essentials Paper Towels, 1 Roll", quantity: "1", price: "$1.28" },
      ],
    }],
    finalState: [
      accountFact("new-store-account", { ...START, storeId: "4419", cart: [LEFTOVER_SOAP_LINE, ROLL], nextLine: 3 }),
      fact("new-store-chosen", "mini-cart-store", `Pickup store: ${STORE}`),
      fact("new-store-roll", "mini-cart-line-5510204-pickup", "1 × ValueRidge Essentials Paper Towels, 1 Roll · Pickup"),
      fact("new-store-total", "mini-cart-summary", "2 items · Subtotal $5.25"),
    ],
    allowedConsoleErrors: [],
  },
};
