import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { STORE_PATHS } from "../catalog/index.js";
import { ACCOUNT_LITERALS } from "./account-literals.js";

const BATTERIES_ROW = `[data-name="Active Items"] [data-line="L1"]`;

/** The cart as the task leaves it, newest line first; prices are each, as the cart prints them. */
const RECORDS = [
  { item: "Tidewell Kettle Descaler, Citric Acid Limescale Remover, 4 Pack", quantity: "1", price: "$9.99" },
  { item: "Ridgeline Slim Case for Aurel 8 Pro, Shockproof Phone Case with Raised Edges, Midnight", quantity: "1", price: "$19.99" },
  { item: "Brightaisle Basics AA Alkaline Batteries, 48 Count", quantity: "3", price: "$17.49" },
];

/**
 * Raise the batteries already in the cart to three, add one pack of the
 * Tidewell descaler, and read the cart back.
 *
 * The lasting act is judged by the account fact, not by the table: deleting
 * the batteries and adding three again leaves a cart that reads the same and
 * holds a new line the shopper never had. Raising the line, or adding two to
 * it (which the store merges into the same line), is the asked-for change.
 */
export const TOPPED_UP_CART_WORKFLOW: ScenarioWorkflow = {
  id: "topped-up-cart",
  recordingDescription: "Demonstrates changing an existing cart line's quantity and adding a recommended item.",
  description: "Raise the AA batteries already in the cart to three, add one Tidewell Kettle Descaler 4 Pack, and read back the active cart.",
  recordingScript: [
    { id: "topup-notifications", operation: "waitForState", target: "role:dialog:Never miss a deal", timeoutMs: 15_000 },
    { id: "topup-decline-notifications", operation: "click", target: "role:button:Not now" },
    { id: "topup-consent", operation: "click", target: "role:button:Accept" },
    { id: "topup-cart", operation: "navigate", path: STORE_PATHS.cart },
    { id: "topup-raise-once", operation: "click", target: `${BATTERIES_ROW} [data-act="inc"]` },
    { id: "topup-at-two", operation: "waitForState", target: `${BATTERIES_ROW} [aria-live="polite"]:text-is("2")`, timeoutMs: 5000 },
    { id: "topup-raise-twice", operation: "click", target: `${BATTERIES_ROW} [data-act="inc"]` },
    { id: "topup-at-three", operation: "waitForState", target: `${BATTERIES_ROW} [aria-live="polite"]:text-is("3")`, timeoutMs: 5000 },
    { id: "topup-add-descaler", operation: "click", target: `[data-add-sku="B0TWDESC04"]` },
    { id: "topup-descaler-added", operation: "waitForState", target: `[data-name="Active Items"] [data-line="L3"]`, timeoutMs: 5000 },
    { id: "extract-topped-up-cart", operation: "extract", target: `[data-name="Active Items"] [data-line]`, fields: { item: `a[href*="/dp/"] > span`, quantity: `[aria-live="polite"]`, price: ":scope > p > span" } },
    { id: "topup-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [ACCOUNT_LITERALS.startFact("topup-start")],
    extracted: [{ step: "extract-topped-up-cart", count: RECORDS.length, records: RECORDS }],
    finalState: [ACCOUNT_LITERALS.accountFact("topup-account", ACCOUNT_LITERALS.toppedUp), ACCOUNT_LITERALS.checkoutFact("topup-no-checkout", "null")],
    allowedConsoleErrors: [],
  },
};
