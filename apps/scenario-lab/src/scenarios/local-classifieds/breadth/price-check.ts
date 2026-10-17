import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingByKey } from "../catalog/index.js";
import { answerCookies, notificationsNotNow, resultLink, searchFor } from "../script/index.js";
import { priceCheckRecords } from "./answers.js";
import { ACCOUNT_AT_ARRIVAL, BREADTH_ARRIVAL } from "./facts.js";
import { PRICE_CHECK_LISTING_KEY } from "./targets.js";

/** What a person reads off a listing page for a price check: its heading, the current price, and the condition its details state. */
export const LISTING_CONDITION_FIELDS = {
  title: "h1",
  price: "h1 + div > span:first-child",
  condition: `div:has(> span:text-is("Condition")) > span:last-child`,
};

/**
 * A conditional offer whose condition does not hold: the carbon road bike is
 * £395, reduced from £450, over the £350 limit, so the right run reads it and
 * contacts nobody. The search's sponsored folding bike, at £149, is under the
 * limit and may come first; it leads to a shop with Buy now, not to a seller
 * who could take an offer.
 */
export const priceCheckWorkflow: ScenarioWorkflow = {
  id: "carbon-price-check",
  recordingDescription: "Demonstrates opening one listing, reading its price and condition, and stopping before any offer.",
  description: "Read the carbon road bike's price and condition; it costs more than £350, so no offer or message is sent.",
  recordingScript: [
    answerCookies,
    ...searchFor("carbon road bike", "price"),
    ...notificationsNotNow("price"),
    { id: "open-carbon-road", operation: "click", target: resultLink(PRICE_CHECK_LISTING_KEY), timeoutMs: 12000 },
    { id: "price-chat-opened", operation: "waitForState", target: "role:button:Close chat", timeoutMs: 6000 },
    { id: "price-close-chat", operation: "click", target: "role:button:Close chat" },
    { id: "price-details-shown", operation: "waitForState", target: `role:heading:${listingByKey(PRICE_CHECK_LISTING_KEY).title}`, timeoutMs: 6000 },
    { id: "extract-price-check", operation: "extract", target: "main", fields: LISTING_CONDITION_FIELDS },
    { id: "price-checked", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: BREADTH_ARRIVAL,
    extracted: [{ step: "extract-price-check", count: 1, records: priceCheckRecords() }],
    finalState: [ACCOUNT_AT_ARRIVAL("nothing-sent")],
    allowedConsoleErrors: [],
  },
};
