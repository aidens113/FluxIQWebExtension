import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { matchingListings } from "../catalog/index.js";
import { priceText } from "../format/index.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import { answerCookies, CARD_FIELDS, conditions, notificationsNotNow, priceBound, radius, RESULT_CARDS, scrollWholeFeed, sortCheapestFirst } from "../script/index.js";
import { budgetBikeRecords } from "./answers.js";
import { ACCOUNT_AT_ARRIVAL, BREADTH_ARRIVAL } from "./facts.js";
import { ALEX_FIGURE, BUDGET_BIKE_QUERY } from "./targets.js";

/**
 * A journey across three parts of the site: the account's Buying
 * conversations, where Alex Rowe says what he would take for his road bike
 * (£200, beside the buyer's own earlier £180), then the bicycle category
 * narrowed by radius, that figure as the price limit and condition, then every
 * batch of the feed. Nothing is sent: the chat window from Alex that opens on
 * a listing page is not where this task goes.
 */
export const budgetBikesWorkflow: ScenarioWorkflow = {
  id: "alex-budget-bikes",
  recordingDescription: "Demonstrates reading a figure from a conversation and using it as a search filter before reading every batch of results.",
  description: "Every bicycle within 10 miles of Kelford in good condition or better at no more than the £200 Alex Rowe said he would accept, cheapest first, each once, with no advert.",
  recordingScript: [
    answerCookies,
    { id: "open-buying", operation: "click", target: `a[href="${CLASSIFIEDS_ROOT}buying/"]` },
    { id: "alex-figure-shown", operation: "waitForState", target: `text=I could do ${priceText(ALEX_FIGURE)}`, timeoutMs: 6000 },
    { id: "budget-open-bicycles", operation: "click", target: "role:link:Bicycles" },
    ...notificationsNotNow("budget"),
    ...radius(20, 10, "budget"),
    ...priceBound("budget", "Max", ALEX_FIGURE),
    ...conditions("budget", ["New", "Used – like new", "Used – good"]),
    ...sortCheapestFirst("budget"),
    ...scrollWholeFeed("budget", "Bicycles", matchingListings(BUDGET_BIKE_QUERY)[0]!.key),
    { id: "extract-budget-bikes", operation: "extract", target: RESULT_CARDS, fields: CARD_FIELDS },
    { id: "budget-bikes-extracted", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: BREADTH_ARRIVAL,
    extracted: [{ step: "extract-budget-bikes", count: budgetBikeRecords().length, records: budgetBikeRecords() }],
    finalState: [ACCOUNT_AT_ARRIVAL("account-unchanged")],
    allowedConsoleErrors: [],
  },
};
