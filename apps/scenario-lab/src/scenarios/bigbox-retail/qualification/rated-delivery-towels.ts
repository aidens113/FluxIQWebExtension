import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { OPENING_STEPS, searchSteps } from "../manifest/opening-steps.js";
import { accountFact } from "./account-fact.js";
import { FACET_TARGETS as facet } from "./facet-targets.js";
import { LEFTOVER_SOAP_LINE } from "./leftover-soap-line.js";

/**
 * The paper towels that can be delivered and are rated 4.5 or better, in the
 * order the Highest rating sort draws them (rating, then review count), once
 * each. Derived by hand from `catalog/paper-towels.ts`: of the 27 paper towel
 * listings, the 8 marketplace ones and the 2 store-sold ones that only ship
 * have no delivery, and of the 17 left the Prints pack (4.4) and the Kitchen
 * pack (4.3) are rated too low. Holders are another department.
 */
const RECORDS: ReadonlyArray<Readonly<Record<string, string>>> = [
  { name: "Hearthside Select-A-Size Paper Towels, 8 Double Rolls", price: "$14.47", rating: "4.9" },
  { name: "Loftwell Ultra Strong Paper Towels, 6 Double Rolls", price: "$10.47", rating: "4.8" },
  { name: "ValueRidge Essentials Paper Towels Value Pack, 15 Rolls", price: "$15.88", rating: "4.7" },
  { name: "Loftwell Select-A-Size Paper Towels, 12 Double Rolls", price: "$19.94", rating: "4.7" },
  { name: "Softerra Pick-A-Sheet Paper Towels, 12 Triple Rolls", price: "$27.97", rating: "4.7" },
  { name: "Softerra Pick-A-Sheet Paper Towels, 8 Triple Rolls", price: "$19.97", rating: "4.7" },
  { name: "Hearthside Paper Towels, 6 Mega Rolls", price: "$12.47", rating: "4.7" },
  { name: "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls", price: "$8.97", rating: "4.6" },
  { name: "Hearthside Paper Towels, 12 Double Rolls", price: "$17.48", rating: "4.6" },
  { name: "Northmere Paper Towels, 12 Rolls", price: "$13.97", rating: "4.6" },
  { name: "Tidemark Everyday Paper Towels, 6 Rolls", price: "$6.97", rating: "4.6" },
  { name: "Loftwell Paper Towels, 1 Roll", price: "$1.97", rating: "4.6" },
  { name: "Softerra Paper Towels, 6 Double Rolls", price: "$9.47", rating: "4.5" },
  { name: "Kindleaf Unbleached Paper Towels, 4 Rolls", price: "$7.48", rating: "4.5" },
  { name: "Tidemark Paper Towels, 8 Double Rolls", price: "$12.94", rating: "4.5" },
  { name: "ValueRidge Essentials Paper Towels, 1 Roll", price: "$1.28", rating: "4.5" },
];

/** A listing that is not an ad and whose stars bar is drawn 90% to 100% wide, a rating of 4.5 or better (`pickup-towels-workflow.ts`). */
const NOT_AN_AD = ":not(:has(> div:first-child))";
const RATED_4_5_AND_UP = [90, 92, 94, 96, 98, 100].map((width) => `span[style="--pct:${width}%"]`).join(", ");

const START = { storeId: "2291", cart: [LEFTOVER_SOAP_LINE], saved: [], nextLine: 2, checkout: "account-wall", expressOpen: false, orderCount: 0, flaggedOrders: 0 } as const;

/**
 * A filtered, re-sorted read across two pages. The Fulfillment filter is the
 * third results document, so the bot check stands in the way and is waited
 * out. The sort reloads the results, the best-rated listing first; the Next
 * arrow would drop both the filters and the sort, so the read follows the
 * page number after the current one.
 */
export const RATED_DELIVERY_TOWELS_WORKFLOW: ScenarioWorkflow = {
  id: "rated-delivery-towels",
  recordingDescription: "Demonstrates filtering and re-sorting search results and reading them across pages.",
  description: "List every paper towel pack that can be delivered and is rated 4.5 or better, best rated first, across both pages, leaving out ads, with name, price and rating.",
  recordingScript: [
    ...OPENING_STEPS,
    ...searchSteps("rated-search", "paper towels"),
    { id: "rated-only-paper-towels", operation: "click", target: facet.option("Department", "Paper Towels") },
    { id: "rated-department-ticked", operation: "waitForState", target: facet.ticked("Department"), timeoutMs: 8000 },
    { id: "rated-only-delivery", operation: "click", target: facet.option("Fulfillment", "Delivery") },
    { id: "rated-bot-check-passed", operation: "waitForState", target: facet.ticked("Fulfillment"), timeoutMs: 25000 },
    { id: "rated-best-first", operation: "select", target: "select[name=sort]", value: "rating_high" },
    { id: "rated-sorted", operation: "waitForState", target: "div[data-item-id=\"417553188\"]:first-child", timeoutMs: 8000 },
    {
      id: "extract-rated-delivery-towels",
      operation: "extract",
      target: `div[data-item-id]${NOT_AN_AD}:has(${RATED_4_5_AND_UP})`,
      fields: { name: "a span", price: "span:has(+ span > sup)", rating: "span:has(+ span[style])" },
      pagination: { next: "nav[aria-label=\"Pagination\"] a[aria-current=\"page\"] + a", maxPages: 5 },
    },
    { id: "rated-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [accountFact("rated-start", START)],
    extracted: [{ step: "extract-rated-delivery-towels", count: RECORDS.length, records: RECORDS.map((record) => ({ ...record })) }],
    finalState: [accountFact("rated-account-untouched", START)],
    allowedConsoleErrors: [],
  },
};
