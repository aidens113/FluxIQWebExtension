import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { SITE_ROOT } from "../catalog/index.js";
import { OPENING_STEPS, openListingStep, searchSteps } from "../manifest/opening-steps.js";
import { bigboxClasses } from "../theme/index.js";
import { accountFact } from "./account-fact.js";
import { cartReadStep } from "./cart-read.js";
import { LEFTOVER_SOAP_LINE } from "./leftover-soap-line.js";

const c = bigboxClasses("baseline", 239);
const fact = (id: string, subject: string, value: string) => ({ id, subject, predicate: "text", value });

/** Two 500-count packs at $11.88 for delivery, after the soap's $3.97: three items, $27.73. */
const NAPKINS = { lineId: "L2", productId: "418831402", sku: "5530103", qty: 2, fulfilment: "delivery" } as const;
const START = { storeId: "2291", cart: [LEFTOVER_SOAP_LINE], saved: [], nextLine: 2, checkout: "account-wall", expressOpen: false, orderCount: 0, flaggedOrders: 0 } as const;

/**
 * A lasting act with two choices the buy box makes for the shopper unless
 * told otherwise: the first size, and pickup, the fastest way the home store
 * offers it. The run picks the 500 Count size, Delivery and a quantity of two,
 * adds once (after the press that only wakes the page), and reads the cart,
 * whose pickup group is drawn before its delivery group.
 */
export const NAPKINS_FOR_DELIVERY_WORKFLOW: ScenarioWorkflow = {
  id: "napkins-for-delivery",
  recordingDescription: "Demonstrates choosing a size, a fulfilment method and a quantity before adding to the cart.",
  description: "Add two 500 Count packs of the store-brand dinner napkins for delivery, keeping the soap and the store, and read the cart.",
  recordingScript: [
    ...OPENING_STEPS,
    ...searchSteps("delivery-napkin-search", "dinner napkins"),
    openListingStep("open-delivery-napkins", "418831402"),
    { id: "delivery-napkin-box-ready", operation: "waitForState", target: "p:text-is(\"How you'll get this item:\")", timeoutMs: 5000 },
    { id: "delivery-napkin-assistant-opens", operation: "waitForState", target: "vr-assist strong:has-text(\"Hi, I'm Val\")", timeoutMs: 8000 },
    { id: "delivery-napkin-close-assistant", operation: "click", target: "vr-assist div:text-is(\"×\") >> nth=0" },
    { id: "choose-500", operation: "click", target: "div[tabindex=\"0\"]:has-text(\"500 Count\")" },
    { id: "choose-delivery", operation: "click", target: "div[tabindex=\"0\"]:has(> strong:text-is(\"Delivery\"))" },
    { id: "two-napkin-packs", operation: "click", target: "span:text-is(\"+\")" },
    { id: "wake-delivery-napkins", operation: "click", target: "testid:atc" },
    { id: "add-delivery-napkins", operation: "click", target: "testid:atc" },
    { id: "delivery-napkins-added", operation: "waitForState", target: "aside strong:has-text(\"Added to cart\")", timeoutMs: 5000 },
    { id: "delivery-napkin-cart", operation: "navigate", path: `${SITE_ROOT}cart` },
    { id: "delivery-napkin-cart-ready", operation: "waitForState", target: `.${c.cartLayout}:not([hidden])`, timeoutMs: 5000 },
    cartReadStep("extract-delivery-napkins-cart"),
    { id: "delivery-napkins-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [accountFact("delivery-napkins-start", START)],
    extracted: [{
      step: "extract-delivery-napkins-cart",
      count: 2,
      records: [
        { item: "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz", quantity: "1", price: "$3.97" },
        { item: "ValueRidge Everyday Dinner Napkins, 500 Count", quantity: "2", price: "$11.88" },
      ],
    }],
    finalState: [
      accountFact("delivery-napkins-account", { ...START, cart: [LEFTOVER_SOAP_LINE, NAPKINS], nextLine: 3 }),
      fact("delivery-napkins-line", "mini-cart-line-5530103-delivery", "2 × ValueRidge Everyday Dinner Napkins, 500 Count · Delivery"),
      fact("delivery-napkins-total", "mini-cart-summary", "3 items · Subtotal $27.73"),
    ],
    allowedConsoleErrors: [],
  },
};
