import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingByKey } from "../catalog/index.js";
import { answerCookies, conditions, notificationsNotNow, radius, resultLink, searchFor, sortCheapestFirst } from "../script/index.js";
import { createClassifiedsState, mutateClassifiedsState } from "../state.js";
import { testRideRecords } from "./answers.js";
import { accountIs, BREADTH_ARRIVAL } from "./facts.js";
import { TEST_RIDE_LISTING_KEY, TEST_RIDE_MESSAGE } from "./targets.js";

/** What a person reads off a listing page: its heading, the current price beside it, and the seller under "Seller information". */
export const LISTING_SELLER_FIELDS = {
  title: "h1",
  price: "h1 + div > span:first-child",
  seller: `h2:text-is("Seller information") + div > div:last-child > div:first-child`,
};

/**
 * The one message the account sent: the test-ride question, delivered, to the
 * cheapest road bike within 5 miles in good condition or better. The listing
 * page's message box comes ready-written with "Hi, is this still available?",
 * and pressing Send on that first both sends the wrong words and puts the
 * question inside the rate limit; the chat window from Alex Rowe opens over
 * the box with a "Message" box of its own that sends nothing.
 */
const QUESTION_SENT = mutateClassifiedsState(createClassifiedsState(), "send-message", { listingId: listingByKey(TEST_RIDE_LISTING_KEY).id, text: TEST_RIDE_MESSAGE }, 0);

export const testRideWorkflow: ScenarioWorkflow = {
  id: "test-ride-question",
  recordingDescription: "Demonstrates choosing a listing by filters and sending its seller one written message.",
  description: "Ask the seller of the cheapest road bike within 5 miles of Kelford in good condition or better whether it can be test ridden on Saturday morning, and send nothing else.",
  recordingScript: [
    answerCookies,
    ...searchFor("road bike", "ride"),
    ...notificationsNotNow("ride"),
    ...radius(20, 5, "ride"),
    ...conditions("ride", ["New", "Used – like new", "Used – good"]),
    ...sortCheapestFirst("ride"),
    { id: "open-road-bike", operation: "click", target: resultLink(TEST_RIDE_LISTING_KEY), timeoutMs: 12000 },
    { id: "ride-chat-opened", operation: "waitForState", target: "role:button:Close chat", timeoutMs: 6000 },
    { id: "ride-close-chat", operation: "click", target: "role:button:Close chat" },
    { id: "ride-write-question", operation: "type", target: "role:textbox:Message", value: TEST_RIDE_MESSAGE, timeoutMs: 6000 },
    { id: "ride-send-question", operation: "click", target: "role:button:Send" },
    { id: "ride-question-sent", operation: "waitForState", target: "testid:marketplace_conversation", timeoutMs: 6000 },
    { id: "extract-test-ride-listing", operation: "extract", target: "main", fields: LISTING_SELLER_FIELDS },
    { id: "ride-question-asked", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: BREADTH_ARRIVAL,
    extracted: [{ step: "extract-test-ride-listing", count: 1, records: testRideRecords() }],
    finalState: [accountIs("only-the-question", QUESTION_SENT)],
    allowedConsoleErrors: [],
  },
};
