import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingByHandle, moneyText, postageText } from "../catalog/index.js";
import { itemPath } from "../paths.js";
import { createAuctionState } from "../state.js";
import { accountFacts } from "./account-facts.js";
import { arrivalSteps } from "./arrival.js";

const FRESH = createAuctionState();
/** The one Kestrel 35 auction that still offers Buy it now: rust_and_brass's body and case, £140.00 outright. */
const QUOTED = listingByHandle("m4");
const REVIEW = `div[role="dialog"][aria-label="Review your purchase"]`;

/**
 * The price of buying the auction outright, read from the purchase review
 * that Buy it now opens and left there: Confirm and pay is never pressed, so
 * nothing is bought, bid on or watched. The fixed-price listing whose title
 * says "Buy it now" is not an auction, and the auction's current bid is not
 * what buying it costs.
 */
export const buyItNowQuoteWorkflow: ScenarioWorkflow = {
  id: "buy-it-now-quote",
  recordingDescription: "Demonstrates opening a purchase review and reading it without confirming.",
  description: "Find the Kestrel 35 auction that still offers Buy it now and read what buying it outright costs from the purchase review, without paying.",
  recordingScript: [
    ...arrivalSteps("quote"),
    { id: "quote-open-listing", operation: "navigate", path: itemPath(QUOTED.id) },
    { id: "quote-listing-open", operation: "waitForState", target: "role:button:Buy it now", timeoutMs: 5000 },
    { id: "quote-open-review", operation: "click", target: "role:button:Buy it now" },
    { id: "quote-review-open", operation: "waitForState", target: REVIEW, timeoutMs: 4000 },
    {
      id: "extract-buy-it-now-quote",
      operation: "extract",
      target: `${REVIEW} section:first-of-type`,
      fields: { title: ":scope > p:nth-of-type(1)", price: ":scope > p:nth-of-type(2) > strong", postage: ":scope > p:nth-of-type(3) > span" },
    },
    { id: "quote-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: accountFacts(FRESH, "quote-start"),
    extracted: [{
      step: "extract-buy-it-now-quote",
      count: 1,
      records: [{ title: QUOTED.title, price: moneyText(QUOTED.currency, QUOTED.binPrice!), postage: postageText(QUOTED.currency, QUOTED.postage) }],
    }],
    finalState: accountFacts(FRESH, "quote-unchanged"),
    allowedConsoleErrors: [],
  },
};
