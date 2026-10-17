import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { matchingListings } from "../catalog/index.js";
import { answerCookies, CARD_FIELDS, notificationsNotNow, priceBound, radius, RESULT_CARDS, scrollWholeFeed, sortBy } from "../script/index.js";
import { furnitureRecords } from "./answers.js";
import { ACCOUNT_AT_ARRIVAL, BREADTH_ARRIVAL } from "./facts.js";
import { FURNITURE_QUERY } from "./targets.js";

/**
 * Furniture within 5 miles of Kelford at £100 or less, newest first, read
 * across both batches of the feed: through the batch that fails once, past
 * the Oakhaus adverts (dearer than the limit, which an advert
 * ignores) and the card the feed sends twice, and stopping where "Results
 * outside your search" begins. Like the bike search, the recording reads every
 * card of the real results, the repeat included; the answer holds each once.
 */
export const furnitureWorkflow: ScenarioWorkflow = {
  id: "furniture-nearby",
  recordingDescription: "Demonstrates narrowing a category by distance, price and date order, and reading every batch of its feed.",
  description: "Every furniture listing within 5 miles of Kelford at £100 or less, newest first, each once, with no advert and nothing from outside the search.",
  recordingScript: [
    answerCookies,
    { id: "open-furniture", operation: "click", target: "role:link:Furniture" },
    ...notificationsNotNow("furniture"),
    ...radius(20, 5, "furniture"),
    ...priceBound("furniture", "Max", 100),
    ...sortBy("furniture", "Date listed: newest first", "newest-first"),
    ...scrollWholeFeed("furniture", "Furniture", matchingListings(FURNITURE_QUERY)[0]!.key),
    { id: "extract-nearby-furniture", operation: "extract", target: RESULT_CARDS, fields: CARD_FIELDS },
    { id: "furniture-extracted", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: BREADTH_ARRIVAL,
    extracted: [{ step: "extract-nearby-furniture", count: furnitureRecords().length, records: furnitureRecords() }],
    finalState: [ACCOUNT_AT_ARRIVAL("account-unchanged")],
    allowedConsoleErrors: [],
  },
};
