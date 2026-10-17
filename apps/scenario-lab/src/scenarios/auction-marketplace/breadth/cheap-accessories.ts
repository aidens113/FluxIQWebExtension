import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingByHandle } from "../catalog/index.js";
import { cardSlots } from "../pages/index.js";
import { createAuctionState } from "../state.js";
import { accountFacts } from "./account-facts.js";
import { arrivalSteps } from "./arrival.js";

const FRESH = createAuctionState();
const SEARCH_BOX = `form[role="search"] input[name="_nkw"]`;
const railOption = (section: string, label: string) => `section[aria-label="${section}"] a[role="checkbox"]:has(span:text-is("${label}"))`;
const railChosen = (section: string, label: string) => `section[aria-label="${section}"] a[role="checkbox"][aria-checked="true"]:has(span:text-is("${label}"))`;

/**
 * The accessory auctions "every accessory auction for my Kestrel 35 under
 * £10" is owed, soonest ending first: the lens cap, the manual reprint, the
 * self-timer priced in euros (EUR 6,50, about £5.64), the flashgun, the strap
 * and the UV filter. Left out are the shop display dummy at £9.00 -- a camera,
 * if a dead one -- and the cable release at £8.99, which is fixed price.
 */
const OWED = ["a1", "a3", "a9", "o2", "a5", "a8"].map((handle) => listingByHandle(handle))
  .sort((left, right) => (left.endsIn ?? 0) - (right.endsIn ?? 0));

const records = OWED.map((listing) => {
  const slots = cardSlots(listing, FRESH);
  return { title: listing.title, price: slots[0]!, bids: slots[2]! };
});

/**
 * The cheap-accessories read, by the site's own filters: Pre-owned (which
 * drops the dummy, listed for parts), then the Auction tab, because the
 * Condition links quietly reset the buying format, then a £10 ceiling, which
 * is the fourth results page and so meets the bot check, then ending soonest.
 * Every card the page then shows is owed.
 */
export const cheapAccessoriesWorkflow: ScenarioWorkflow = {
  id: "cheap-accessories",
  recordingDescription: "Demonstrates narrowing auction results by condition, buying format and price, and reading the cards left.",
  description: "Collect every accessory auction a search for the Kestrel 35 returns whose current bid is under £10 at the site's pound estimate, soonest ending first, leaving out the display dummy camera and the fixed-price cable release.",
  recordingScript: [
    ...arrivalSteps("cheap"),
    { id: "cheap-search", operation: "type", target: SEARCH_BOX, value: "kestrel 35" },
    { id: "cheap-run-search", operation: "press", target: SEARCH_BOX, value: "Enter" },
    { id: "cheap-results", operation: "waitForState", target: `ul[aria-busy="false"]`, timeoutMs: 5000 },
    { id: "cheap-pre-owned", operation: "click", target: railOption("Condition", "Pre-owned") },
    { id: "cheap-pre-owned-applied", operation: "waitForState", target: railChosen("Condition", "Pre-owned"), timeoutMs: 5000 },
    { id: "cheap-only-auctions", operation: "click", target: `nav[aria-label="Buying format"] a:text-is("Auction")` },
    { id: "cheap-auctions-applied", operation: "waitForState", target: `nav[aria-label="Buying format"] a[aria-current="page"]:text-is("Auction")`, timeoutMs: 5000 },
    { id: "cheap-max-price", operation: "type", target: `input[name="_udhi"]`, value: "10" },
    { id: "cheap-apply-price", operation: "click", target: `section[aria-label="Price"] div[title="Submit price range"]` },
    { id: "cheap-check-shown", operation: "waitForState", target: "role:button:Continue", timeoutMs: 6000 },
    { id: "cheap-pass-check", operation: "click", target: "role:button:Continue" },
    { id: "cheap-price-applied", operation: "waitForState", target: `input[name="_udhi"][value="10"]`, timeoutMs: 8000 },
    { id: "cheap-wake-sort", operation: "click", target: "role:button:Sort: Best Match" },
    { id: "cheap-open-sort", operation: "click", target: "role:button:Sort: Best Match" },
    { id: "cheap-ending-soonest", operation: "click", target: "role:menuitem:Time: ending soonest" },
    { id: "cheap-sorted", operation: "waitForState", target: "role:button:Sort: Time: ending soonest", timeoutMs: 5000 },
    { id: "cheap-sorted-hydrated", operation: "waitForState", target: `ul[aria-busy="false"]`, timeoutMs: 5000 },
    {
      id: "extract-cheap-accessories",
      operation: "extract",
      target: "ul[aria-busy] > li[data-listingid]",
      fields: {
        title: ":scope > div:nth-child(2) > a span:last-child",
        price: ":scope > div:nth-child(2) > div:nth-child(4) > span:first-child",
        bids: ":scope > div:nth-child(2) > div:nth-child(5) > span:first-child",
      },
    },
    { id: "cheap-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: accountFacts(FRESH, "cheap-start"),
    extracted: [{ step: "extract-cheap-accessories", count: records.length, records }],
    finalState: accountFacts(FRESH, "cheap-unchanged"),
    allowedConsoleErrors: [],
  },
};
