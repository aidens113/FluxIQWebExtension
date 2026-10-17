import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { ORGANIC_LISTINGS, storeById } from "../catalog/index.js";
import { formatMoney } from "../locale/index.js";
import { marketClasses } from "../styles/index.js";
import { MARKET_SEED } from "./answers.js";
import { cartCount, FIRST_VISIT, ordersShipped } from "./facts.js";
import { SITE_NOISE } from "./site-noise.js";
import { ARRIVE } from "./steps.js";

const c = marketClasses(MARKET_SEED, "baseline");

/** The price ceiling the buyer names, 10,00 €, in the euro cents the catalogue holds; a price at the ceiling is in. */
const CEILING_CENTS = 1000;

/**
 * Every hub the search returns at 10,00 € or less that ships free whatever the
 * order -- not the "free shipping over" listings, which charge for a single
 * cheap piece -- cheapest first, as the cards write them for a buyer in
 * Germany. Computed from the catalogue rather than read off a page, so the
 * browser test that reads the rendered results is what proves the page.
 */
function freeHubsUnderTenRecords(): Array<Record<string, string>> {
  return ORGANIC_LISTINGS
    .filter((listing) => listing.shipping.kind === "free" && listing.priceCents <= CEILING_CENTS)
    .sort((left, right) => left.priceCents - right.priceCents)
    .map((listing) => ({
      title: listing.title,
      store: storeById(listing.storeId).name,
      price: formatMoney(listing.priceCents, "DE"),
      rating: listing.rating === null ? "" : (listing.rating / 10).toFixed(1),
    }));
}

/**
 * Narrow the search to free shipping and a 10 € ceiling with the site's own
 * filters, answer the traffic check the third results load brings, sort by
 * price, and read the cards that are not ads. Narrowed, the results fit on one
 * page; the three paid placements on it ignore the filters and are dearer than
 * the ceiling, so a read that keeps them is wrong by three rows.
 */
const SCRIPT: ScenarioWorkflow["recordingScript"] = [
  ...ARRIVE,
  { id: "cheap-prompt-arrives", operation: "waitForState", target: 'text="Never miss a price drop"', timeoutMs: 8000 },
  { id: "cheap-decline-notifications", operation: "click", target: 'text="Not now"' },
  { id: "cheap-only-free-shipping", operation: "click", target: `.${c.sidebar} >> text="Free shipping"` },
  { id: "cheap-free-listed", operation: "waitForState", target: `.${c.chips} >> text="Free shipping ×"`, timeoutMs: 6000 },
  { id: "cheap-type-ceiling", operation: "type", target: `.${c.priceInputs} input[placeholder="Max"]`, value: "10" },
  { id: "cheap-apply-ceiling", operation: "click", target: `.${c.priceInputs} >> text="OK"` },
  { id: "cheap-traffic-check", operation: "waitForState", target: `text="I'm not a robot"`, timeoutMs: 6000 },
  { id: "cheap-pass-check", operation: "click", target: `text="I'm not a robot"` },
  { id: "cheap-results-back", operation: "waitForState", target: `.${c.sortTab} >> text="Price ↑"`, timeoutMs: 8000 },
  { id: "cheap-sort-by-price", operation: "click", target: `.${c.sortTab} >> text="Price ↑"` },
  { id: "cheap-sorted", operation: "waitForState", target: `.${c.sortTab}.${c.sortTabOn} >> text="Price ↑"`, timeoutMs: 6000 },
  { id: "cheap-first-cards", operation: "waitForState", target: `.${c.grid} > .${c.card} >> nth=0`, timeoutMs: 4000 },
  { id: "cheap-scroll-results", operation: "scroll", value: 2400 },
  { id: "cheap-last-cards", operation: "waitForState", target: `.${c.grid} > .${c.card} >> nth=11`, timeoutMs: 6000 },
  {
    id: "extract-free-hubs-under-ten",
    operation: "extract",
    target: `.${c.grid} > .${c.card}:not(:has(.${c.adTag}))`,
    fields: { title: `.${c.cardTitle}`, store: `.${c.storeName}`, price: `.${c.price}`, rating: `.${c.ratingValue}` },
  },
  { id: "free-hubs-under-ten-read", operation: "checkpoint" },
];

/** A filtered extraction: every free-shipping hub at 10,00 € or less, no ads, each once, cheapest first. */
export const freeHubsUnderTenWorkflow: ScenarioWorkflow = {
  id: "free-hubs-under-ten",
  recordingDescription: "Demonstrates narrowing marketplace results by delivery and a price ceiling, then sorting them by price.",
  description: "Collect every USB-C hub the search returns that costs 10,00 € or less and ships free on its own, leaving out ads and listing each once, cheapest first.",
  recordingScript: SCRIPT,
  expected: {
    pageFacts: FIRST_VISIT,
    extracted: [{ step: "extract-free-hubs-under-ten", count: freeHubsUnderTenRecords().length, records: freeHubsUnderTenRecords() }],
    finalState: [cartCount(0), ordersShipped(0)],
    allowedConsoleErrors: SITE_NOISE,
  },
};
