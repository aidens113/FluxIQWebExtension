import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { PICKUP_TOWEL_RECORDS, UNCHANGED_CART_FACTS } from "./expected-values.js";
import { OPENING_STEPS, searchSteps } from "./opening-steps.js";

const facet = (legend: string, option: string) => `fieldset:has(legend:text-is("${legend}")) label:has-text("${option}")`;
const ticked = (legend: string) => `fieldset:has(legend:text-is("${legend}")) label:has(input:checked)`;

/**
 * The listings the read keeps: not an ad, available for pickup today, and
 * rated 4.5 or better. The sidebar's filters narrow the results but cannot
 * say any of the three: "Today" counts delivery too, the rating filter stops
 * at "4 & up", and ads ignore filters altogether.
 */
const KEPT_LISTINGS = "div[data-item-id]:not(:has-text(\"Sponsored\")):has-text(\"Pickup today\"):has(span:text-matches(\"^(4[.][5-9]|5[.]0)$\"))";

/**
 * Reads the qualifying paper towels across every page. The second filter is
 * the third results document served, which raises the bot check; nothing is
 * done about it but waiting, and the page passes itself after its countdown.
 * The filtered results still run to two pages, and the Next arrow would drop
 * every filter, so the read follows the page number after the current one.
 */
export const PICKUP_TOWELS_WORKFLOW: ScenarioWorkflow = {
  id: "pickup-towels",
  description: "Find every pack of paper towels that ValueRidge sells itself, that the home store can have ready for pickup today and that is rated 4.5 or better, across every page of results, leaving out ads, and read name, price, unit price and rating.",
  recordingScript: [
    ...OPENING_STEPS,
    ...searchSteps("towel-search", "paper towels"),
    { id: "only-paper-towels", operation: "click", target: facet("Department", "Paper Towels") },
    { id: "department-ticked", operation: "waitForState", target: ticked("Department"), timeoutMs: 8000 },
    { id: "only-valueridge", operation: "click", target: facet("Retailer", "ValueRidge") },
    { id: "bot-check-passed", operation: "waitForState", target: ticked("Retailer"), timeoutMs: 25000 },
    { id: "only-pickup", operation: "click", target: facet("Fulfillment", "Pickup") },
    { id: "pickup-ticked", operation: "waitForState", target: ticked("Fulfillment"), timeoutMs: 8000 },
    { id: "only-today", operation: "click", target: facet("Speed", "Today") },
    { id: "today-ticked", operation: "waitForState", target: ticked("Speed"), timeoutMs: 8000 },
    { id: "four-and-up", operation: "click", target: facet("Customer Rating", "4 & up") },
    { id: "rating-ticked", operation: "waitForState", target: ticked("Customer Rating"), timeoutMs: 8000 },
    {
      id: "extract-pickup-towels",
      operation: "extract",
      target: KEPT_LISTINGS,
      fields: {
        name: "a span",
        price: "span:text-matches(\"^[$][0-9]+[.][0-9]{2}$\")",
        unitPrice: "div:text-matches(\"/(sheet|roll)$\")",
        rating: "span:text-matches(\"^[0-5][.][0-9]$\")",
      },
      pagination: { next: "nav[aria-label=\"Pagination\"] a[aria-current=\"page\"] + a", maxPages: 5 },
    },
    { id: "towels-read", operation: "checkpoint" },
  ],
  expected: {
    recordingEvents: [{ type: "web.element.clicked" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list", outcome: "succeeded" }],
    extracted: [{ step: "extract-pickup-towels", count: PICKUP_TOWEL_RECORDS.length, records: PICKUP_TOWEL_RECORDS.map((record) => ({ ...record })) }],
    finalState: [...UNCHANGED_CART_FACTS],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "list-layout",
    description: "A results-page experiment: listings render as rows of a list rather than tiles of a grid, the price as plain text, and an ad carries a small Ad pill instead of the word Sponsored. The same job has the same answer; a Flow that found listings by the grid's structure, or ads by the word Sponsored, reads nothing or reads the ads as well.",
    arm: { operation: "set-mode", payload: { mode: "list-layout" } },
    expected: {
      extracted: [{ step: "extract-pickup-towels", count: PICKUP_TOWEL_RECORDS.length, records: PICKUP_TOWEL_RECORDS.map((record) => ({ ...record })) }],
      finalState: [...UNCHANGED_CART_FACTS],
    },
  }],
};
