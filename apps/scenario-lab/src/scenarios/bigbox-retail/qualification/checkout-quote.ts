import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { SITE_ROOT } from "../catalog/index.js";
import { OPENING_STEPS } from "../manifest/opening-steps.js";
import { bigboxClasses } from "../theme/index.js";
import { accountFact } from "./account-fact.js";
import { LEFTOVER_SOAP_LINE } from "./leftover-soap-line.js";

const c = bigboxClasses("baseline", 239);

/**
 * The stop case: a guest checkout of the cart as it stands, read and left
 * unplaced. The home store's 11am, noon and 1pm slots today are full, so the
 * earliest open one is 2pm-3pm; the soap's $3.97 plus 7.25% tax ($0.29) is
 * $4.26. The only lasting change is the checkout's own: it now continues as a
 * guest. No order is placed and the cart is as it was.
 */
const AFTER = { storeId: "2291", cart: [LEFTOVER_SOAP_LINE], saved: [], nextLine: 2, checkout: "guest", expressOpen: false, orderCount: 0, flaggedOrders: 0 } as const;

/**
 * Reaches the guest checkout's pickup times and reads them, stopping short of
 * Place order. The support launcher lies over the cart's checkout button and
 * is closed first; the first request for pickup times is refused and retried.
 * An open slot is the only slot button carrying a value; a full one is
 * disabled and carries none.
 */
export const CHECKOUT_QUOTE_WORKFLOW: ScenarioWorkflow = {
  id: "checkout-quote",
  recordingDescription: "Demonstrates reaching a guest checkout and reading it without placing the order.",
  description: "Start a guest checkout of the cart, read the earliest open pickup time today and the order total, and leave without placing the order.",
  recordingScript: [
    ...OPENING_STEPS,
    { id: "quote-cart", operation: "navigate", path: `${SITE_ROOT}cart` },
    { id: "quote-cart-ready", operation: "waitForState", target: `.${c.cartLayout}:not([hidden])`, timeoutMs: 5000 },
    { id: "quote-close-launcher", operation: "click", target: "vr-assist span:text-is(\"×\")" },
    { id: "quote-checkout", operation: "click", target: "button:has-text(\"Continue to checkout\")" },
    { id: "quote-wall", operation: "waitForState", target: "h1:has-text(\"Sign in or create your account\")", timeoutMs: 8000 },
    { id: "quote-as-guest", operation: "click", target: "a:text-is(\"Continue without an account\")" },
    { id: "quote-times-stuck", operation: "waitForState", target: "a:text-is(\"Taking longer than usual? Retry\")", timeoutMs: 8000 },
    { id: "quote-retry-times", operation: "click", target: "a:text-is(\"Taking longer than usual? Retry\")" },
    { id: "quote-times-shown", operation: "waitForState", target: "button[value] >> nth=0", timeoutMs: 8000 },
    { id: "extract-checkout-quote", operation: "extract", target: `.${c.checkoutLayout}`, fields: { pickup: "button[value]", total: `.${c.summaryTotal} > span:last-child` } },
    { id: "quote-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [accountFact("quote-start", { ...AFTER, checkout: "account-wall" })],
    extracted: [{ step: "extract-checkout-quote", count: 1, records: [{ pickup: "2pm–3pm", total: "$4.26" }] }],
    finalState: [
      accountFact("quote-nothing-placed", AFTER),
      { id: "quote-cart-kept", subject: "mini-cart-summary", predicate: "text", value: "1 item · Subtotal $3.97" },
    ],
    allowedConsoleErrors: ["status of 429"],
  },
};
