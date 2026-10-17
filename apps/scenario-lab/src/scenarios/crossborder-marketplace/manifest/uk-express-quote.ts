import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { listingById, type SkuChoice } from "../catalog/index.js";
import { formatMoney } from "../locale/index.js";
import { itemHref } from "../markup/index.js";
import { sessionTotals } from "../state/index.js";
import { marketClasses } from "../styles/index.js";
import { MARKET_SEED } from "./answers.js";
import { FIRST_VISIT, ordersShipped } from "./facts.js";
import { SITE_NOISE } from "./site-noise.js";
import { ARRIVE } from "./steps.js";

const c = marketClasses(MARKET_SEED, "baseline");

/** The Keelson 9 in 1 hub, one piece in Silver from its only warehouse. */
const KEELSON_NINE_IN_ONE_ID = "1005008698840";
const CHOICE: SkuChoice = { color: "Silver", spec: "", origin: "Spain" };

/**
 * The checkout summary for one Keelson 9 in 1 shipped express to the United
 * Kingdom, as the checkout writes it in pounds: the item, the store's express
 * charge (its standard shipping is free), and the total. Computed with the
 * checkout's own totals, so the browser test reading the rendered summary is
 * what proves the page.
 */
function ukExpressQuoteRecord(): Record<string, string> {
  const listing = listingById(KEELSON_NINE_IN_ONE_ID)!;
  const totals = sessionTotals([{ id: "now", listingId: listing.id, choice: CHOICE, quantity: 1 }], { [listing.storeId]: "express" }, []);
  return { items: formatMoney(totals.itemsCents, "GB"), shipping: formatMoney(totals.shippingCents, "GB"), total: formatMoney(totals.totalCents, "GB") };
}

/**
 * Ship to the United Kingdom through the header's region picker (its own
 * shadow root; saving reloads the page in pounds), decline the notification
 * prompt the reload brings back, open the Keelson listing from the results,
 * choose Silver, take it to checkout with Buy now, choose express shipping,
 * and read the summary. "Place order" is never pressed.
 */
const SCRIPT: ScenarioWorkflow["recordingScript"] = [
  ...ARRIVE,
  { id: "uk-open-region", operation: "click", target: "fb-region .t" },
  { id: "uk-choose-country", operation: "select", target: "fb-region select", value: "GB" },
  { id: "uk-save-country", operation: "click", target: "fb-region .s" },
  { id: "uk-region-saved", operation: "waitForState", target: 'fb-region .t:has-text("United Kingdom / GBP")', timeoutMs: 8000 },
  { id: "uk-prompt-arrives", operation: "waitForState", target: 'text="Never miss a price drop"', timeoutMs: 8000 },
  { id: "uk-decline-notifications", operation: "click", target: 'text="Not now"' },
  { id: "uk-first-cards", operation: "waitForState", target: `.${c.grid} > .${c.card} >> nth=0`, timeoutMs: 4000 },
  { id: "uk-scroll-results", operation: "scroll", value: 2400 },
  { id: "uk-keelson-drawn", operation: "waitForState", target: `a[href="${itemHref(KEELSON_NINE_IN_ONE_ID)}"] >> nth=1`, timeoutMs: 6000 },
  { id: "uk-open-keelson", operation: "click", target: `a[href="${itemHref(KEELSON_NINE_IN_ONE_ID)}"] >> nth=1` },
  { id: "uk-keelson-tab", operation: "switchTab", path: itemHref(KEELSON_NINE_IN_ONE_ID), timeoutMs: 30_000 },
  { id: "uk-chat-arrives", operation: "waitForState", target: '[title="Minimize chat"] >> nth=0', timeoutMs: 6000 },
  { id: "uk-minimize-chat", operation: "click", target: '[title="Minimize chat"] >> nth=0' },
  { id: "uk-choose-silver", operation: "click", target: `.${c.swatch}[title="Silver"]` },
  { id: "uk-buy-now", operation: "click", target: 'text="Buy now"' },
  { id: "uk-checkout-open", operation: "waitForState", target: `.${c.shipSelect}`, timeoutMs: 8000 },
  { id: "uk-choose-express", operation: "select", target: `.${c.shipSelect}`, value: "express" },
  { id: "uk-express-applied", operation: "waitForState", target: `.${c.cartSummary} >> text="${ukExpressQuoteRecord().shipping}"`, timeoutMs: 8000 },
  {
    id: "extract-uk-express-quote",
    operation: "extract",
    target: `.${c.cartSummary}`,
    fields: { items: `.${c.summaryRow}:nth-child(2) > span:last-child`, shipping: `.${c.summaryRow}:nth-child(4) > span:last-child`, total: `.${c.summaryTotal} > span:last-child` },
  },
  { id: "uk-express-quote-read", operation: "checkpoint" },
];

/** A longer journey: change the ship-to country, find one listing, take it to checkout with express shipping, read the summary, buy nothing. */
export const ukExpressQuoteWorkflow: ScenarioWorkflow = {
  id: "uk-express-quote",
  recordingDescription: "Demonstrates changing the ship-to country, choosing a listing's option, and reading an express-shipping checkout summary without placing the order.",
  description: "Ship to the United Kingdom, take one Keelson 9 in 1 hub in Silver to checkout with express shipping, and read the summary in pounds; no order is placed.",
  recordingScript: SCRIPT,
  expected: {
    pageFacts: FIRST_VISIT,
    extracted: [{ step: "extract-uk-express-quote", count: 1, records: [ukExpressQuoteRecord()] }],
    finalState: [ordersShipped(0)],
    allowedConsoleErrors: SITE_NOISE,
  },
};
