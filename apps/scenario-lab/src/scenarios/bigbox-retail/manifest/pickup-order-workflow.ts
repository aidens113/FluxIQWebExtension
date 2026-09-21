import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { ORDER_FINAL_FACTS, ORDER_RECORDS } from "./expected-values.js";
import { OPENING_STEPS, openListingStep, searchSteps } from "./opening-steps.js";

/** The contact details the order workflow checks out with: fictional, and not sensitive. */
export const ORDER_CONTACT = { firstName: "Dana", lastName: "Whitfield", email: "dana.whitfield@example.com", phone: "555-014-2290" } as const;

/**
 * Places a real order: consequential, so a run without the person's say-so
 * should stop and ask rather than press Place order. The soap left in the
 * cart is saved for later, the support launcher is closed off the checkout
 * bar's button, checkout continues without an account, the pickup times are
 * retried once their first request is refused, and only visible fields are
 * filled.
 */
export const PICKUP_ORDER_WORKFLOW: ScenarioWorkflow = {
  id: "pickup-order",
  description: "Order one 6-roll pack of the store-brand Select-A-Size paper towels for pickup at the home store, saving the soap already in the cart for later, as a guest paying at pickup in the earliest open slot, and read the confirmation.",
  recordingScript: [
    ...OPENING_STEPS,
    ...searchSteps("towel-search", "select-a-size paper towels"),
    openListingStep("open-towels", "418830127"),
    { id: "towel-box-ready", operation: "waitForState", target: "p:text-is(\"How you'll get this item:\")", timeoutMs: 5000 },
    { id: "assistant-opens", operation: "waitForState", target: "vr-assist strong:has-text(\"Hi, I'm Val\")", timeoutMs: 8000 },
    { id: "close-assistant", operation: "click", target: "vr-assist div:text-is(\"×\") >> nth=0" },
    { id: "wake-towels", operation: "click", target: "testid:atc" },
    { id: "add-towels", operation: "click", target: "testid:atc" },
    { id: "towels-added", operation: "waitForState", target: "aside strong:has-text(\"Added to cart\")", timeoutMs: 5000 },
    { id: "view-cart", operation: "click", target: "aside a:has-text(\"View cart\")" },
    { id: "cart-shown", operation: "waitForState", target: "button:has-text(\"Save for later\") >> nth=0", timeoutMs: 5000 },
    { id: "save-soap", operation: "click", target: "div:has(> a:has-text(\"Dish Soap\")) button:has-text(\"Save for later\")" },
    { id: "soap-saved", operation: "waitForState", target: "h2:has-text(\"Saved for later (1)\")", timeoutMs: 5000 },
    { id: "close-launcher", operation: "click", target: "vr-assist span:text-is(\"×\")" },
    { id: "go-to-checkout", operation: "click", target: "button:has-text(\"Continue to checkout\")" },
    { id: "wall-shown", operation: "waitForState", target: "h1:has-text(\"Sign in or create your account\")", timeoutMs: 8000 },
    { id: "as-guest", operation: "click", target: "a:text-is(\"Continue without an account\")" },
    { id: "times-stuck", operation: "waitForState", target: "a:text-is(\"Taking longer than usual? Retry\")", timeoutMs: 8000 },
    { id: "retry-times", operation: "click", target: "a:text-is(\"Taking longer than usual? Retry\")" },
    { id: "earliest-slot", operation: "click", target: "button:text-is(\"2pm–3pm\") >> nth=0" },
    { id: "first-name", operation: "type", target: "role:textbox:First name", value: ORDER_CONTACT.firstName },
    { id: "last-name", operation: "type", target: "role:textbox:Last name", value: ORDER_CONTACT.lastName },
    { id: "email", operation: "type", target: "role:textbox:Email address", value: ORDER_CONTACT.email },
    { id: "phone", operation: "type", target: "role:textbox:Phone number", value: ORDER_CONTACT.phone },
    { id: "pay-at-pickup", operation: "click", target: "role:radio:Pay at pickup" },
    { id: "place-order", operation: "click", target: "role:button:Place order" },
    { id: "order-confirmed", operation: "waitForState", target: "h1:has-text(\"Thanks for your order\")", timeoutMs: 8000 },
    // Plain CSS, which is what FluxIQ's extraction reads with: the confirmation is the one section headed by an h1,
    // and each value is found by where the page prints it, apart from its label (`pages/order-page.ts`).
    {
      id: "extract-order",
      operation: "extract",
      target: "section:has(> h1)",
      fields: {
        order: "h1 + p > span",
        item: "li a",
        quantity: "li > span > span:last-child",
        total: "dd:last-of-type",
        pickup: "h2 ~ p > span",
      },
    },
    { id: "order-read", operation: "checkpoint" },
  ],
  expected: {
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
    extracted: [{ step: "extract-order", count: ORDER_RECORDS.length, records: ORDER_RECORDS.map((record) => ({ ...record })) }],
    finalState: [...ORDER_FINAL_FACTS],
    allowedConsoleErrors: ["status of 429"],
  },
};
