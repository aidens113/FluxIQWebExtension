import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { ACCOUNT_LITERALS } from "./account-literals.js";
import { SHARED_STEPS } from "./shared-steps.js";

const KETTLE = "B0BAKTL15W";

/**
 * What checkout shows once it is set up as asked: the kettle alone, the office
 * address, standard delivery's date, and the $19.99 kettle less the $12.40
 * gift card balance (`state/account.ts`; Oregon charges no sales tax).
 */
const RECORDS = [{
  item: "Brightaisle Basics Electric Kettle 1.5 L, BPA-Free, Auto Shut-Off, White",
  address: "Dana Whitfield, Northgate Dental, 2100 N Vancouver Ave Suite 200, Portland, OR 97227",
  arriving: "Thursday, September 24",
  total: "$7.59",
}];

/**
 * A longer journey that stops short of paying: search, open the Basics
 * kettle, Buy Now, then four choices on a checkout that opens on the store's
 * preferences -- the office address instead of home, standard delivery
 * instead of Brightaisle Day, the gift card balance applied, the Plus trial
 * unticked -- and a read of the result, with the order never placed.
 *
 * Each choice reloads the page, and the recording waits for the reload to
 * show it. Placing the order, checking out the whole cart, or leaving any of
 * the store's preferences standing is caught by the checkout fact, which
 * every page carries.
 */
export const OFFICE_CHECKOUT_WORKFLOW: ScenarioWorkflow = {
  id: "office-checkout-review",
  recordingDescription: "Demonstrates setting up a checkout's address, delivery, gift card and trial and reading it without ordering.",
  description: "Buy Now the Brightaisle Basics 1.5 L kettle, set checkout to the office address, standard delivery, the gift card balance and no Plus trial, read the item, address, arrival date and total, and stop before placing the order.",
  recordingScript: [
    ...SHARED_STEPS.openStore,
    ...SHARED_STEPS.search("office", "brightaisle basics electric kettle"),
    { id: "office-kettle-listed", operation: "waitForState", target: `[data-component="search-result"][data-sku="${KETTLE}"]:not([data-ad-id])`, timeoutMs: 6000 },
    { id: "office-open-kettle", operation: "click", target: `[data-component="search-result"][data-sku="${KETTLE}"]:not([data-ad-id]) h2 a` },
    { id: "office-chat-opened", operation: "waitForState", target: "role:dialog:Brightaisle Assistant", timeoutMs: 9000 },
    { id: "office-minimize-chat", operation: "click", target: "role:button:Minimize chat" },
    { id: "office-app-banner", operation: "waitForState", target: `[title="Close"]`, timeoutMs: 6000 },
    { id: "office-close-app-banner", operation: "click", target: `[title="Close"]` },
    { id: "office-buy-now", operation: "click", target: "role:button:Buy Now" },
    { id: "office-checkout-open", operation: "waitForState", target: `[data-action="change-address"]`, timeoutMs: 6000 },
    { id: "office-change-address", operation: "click", target: `[data-action="change-address"]` },
    { id: "office-pick-office", operation: "check", target: `input[name="address"][value="office"]`, value: true },
    { id: "office-use-address", operation: "click", target: "role:button:Deliver to this address" },
    { id: "office-address-set", operation: "waitForState", target: `section[aria-labelledby="ship-heading"] > p:has-text("Northgate Dental")`, timeoutMs: 6000 },
    { id: "office-standard-delivery", operation: "check", target: `input[name="delivery"][value="standard"]`, value: true },
    { id: "office-delivery-set", operation: "waitForState", target: `input[name="delivery"][value="standard"][checked]`, timeoutMs: 6000 },
    { id: "office-gift-card", operation: "check", target: `section[aria-labelledby="pay-heading"] input[type="checkbox"]`, value: true },
    { id: "office-gift-card-set", operation: "waitForState", target: `section[aria-labelledby="pay-heading"] input[type="checkbox"][checked]`, timeoutMs: 6000 },
    { id: "office-decline-trial", operation: "check", target: `section:has-text("Brightaisle Plus trial") input[type="checkbox"]`, value: false },
    { id: "office-trial-declined", operation: "waitForState", target: `section:has-text("Brightaisle Plus trial") input[type="checkbox"]:not([checked])`, timeoutMs: 6000 },
    {
      id: "extract-checkout-review",
      operation: "extract",
      target: "main",
      fields: {
        item: `section[aria-labelledby="arrive-heading"] > ul > li > b`,
        address: `section[aria-labelledby="ship-heading"] > p`,
        arriving: `label:has(input[name="delivery"][checked]) > b`,
        total: `aside > div:last-child > span:last-child`,
      },
    },
    { id: "office-reviewed", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [...SHARED_STEPS.homeFacts, ACCOUNT_LITERALS.startFact("office-start")],
    extracted: [{ step: "extract-checkout-review", count: RECORDS.length, records: RECORDS }],
    finalState: [
      ACCOUNT_LITERALS.accountFact("office-cart-unchanged-nothing-ordered", ACCOUNT_LITERALS.checkoutOpen),
      ACCOUNT_LITERALS.checkoutFact("office-checkout-as-asked", ACCOUNT_LITERALS.officeCheckout),
      SHARED_STEPS.notChallenged,
    ],
    allowedConsoleErrors: [],
  },
};
