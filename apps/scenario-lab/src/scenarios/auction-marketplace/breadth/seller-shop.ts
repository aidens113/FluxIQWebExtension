import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { currentPrice, LISTINGS, listingByHandle, moneyText } from "../catalog/index.js";
import { MARKET_ROOT } from "../paths.js";
import { createAuctionState } from "../state.js";
import { accountFacts } from "./account-facts.js";
import { arrivalSteps } from "./arrival.js";

const FRESH = createAuctionState();
const SEARCH_BOX = `form[role="search"] input[name="_nkw"]`;
/** The lens hood on its own; the collector's set "with 3 lenses & hood" that the same search returns is another seller's. */
const HOOD = listingByHandle("a4");

/** Everything the hood's seller has live, in the order the shop lists it. */
const records = LISTINGS.filter((listing) => listing.seller === HOOD.seller && !listing.ended)
  .map((listing) => ({ title: listing.title, price: moneyText(listing.currency, currentPrice(listing, FRESH.bids)) }));

/**
 * Search for the hood, open its listing to find who sells it, and read that
 * seller's shop. The listing opens the shop in a new tab; the recording goes
 * to the same address in its own.
 */
export const sellerShopWorkflow: ScenarioWorkflow = {
  id: "lens-hood-seller-shop",
  recordingDescription: "Demonstrates searching, opening a listing and reading its seller's shop.",
  description: "Search for a Kestrel 35 lens hood, open the hood's listing, and list everything its seller has for sale in their shop.",
  recordingScript: [
    ...arrivalSteps("shop"),
    { id: "shop-search", operation: "type", target: SEARCH_BOX, value: "kestrel 35 lens hood" },
    { id: "shop-run-search", operation: "press", target: SEARCH_BOX, value: "Enter" },
    { id: "shop-results", operation: "waitForState", target: `ul[aria-busy="false"]`, timeoutMs: 5000 },
    { id: "shop-open-hood", operation: "click", target: `li[data-listingid="${HOOD.id}"] a:has([role="heading"])` },
    { id: "shop-hood-open", operation: "waitForState", target: "role:button:Place bid", timeoutMs: 5000 },
    { id: "shop-open-shop", operation: "navigate", path: `${MARKET_ROOT}str/${encodeURIComponent(HOOD.seller)}` },
    { id: "shop-shop-open", operation: "waitForState", target: "main > ul", timeoutMs: 4000 },
    { id: "extract-seller-shop", operation: "extract", target: "main > ul > li", fields: { title: ":scope > a", price: ":scope > span" } },
    { id: "shop-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: accountFacts(FRESH, "shop-start"),
    extracted: [{ step: "extract-seller-shop", count: records.length, records }],
    finalState: accountFacts(FRESH, "shop-unchanged"),
    allowedConsoleErrors: [],
  },
};
