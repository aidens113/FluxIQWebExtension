import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { searchCatalog } from "../catalog/index.js";
import { earbudRecords } from "./earbud-records.js";
import { SHARED_STEPS } from "./shared-steps.js";

const NO_FILTERS = { plus: false, stars4: false, band: null, low: null, high: null, brands: [] } as const;

/**
 * The answer, from the store's own relevance order: every pair of earbuds --
 * not an accessory -- that is Plus eligible, rated 4.0 or higher as its card
 * prints it, and priced under $50.00, each once, in the order the results
 * first show them.
 */
const ANSWER = searchCatalog({ keywords: "wireless earbuds", department: "all", filters: NO_FILTERS, sort: "featured", page: 1 }).organic
  .filter((product) => product.kind === "earbuds" && product.plus && product.rating >= 4 && product.priceCents < 5000);
const RECORDS = earbudRecords(ANSWER);

/**
 * Every Plus-eligible pair of wireless earbuds rated 4.0 or better and priced
 * under $50, across every page of results.
 *
 * This is the task that needs judgement rather than a selector, and each
 * shortcut the store offers is wrong in its own way. "4 Stars & Up" admits a
 * 3.8 and a 3.9, because the store rounds to the star icon. "$25 to $50"
 * admits a pair at exactly $50.00 and leaves out every qualifying pair under
 * $25. Two accessories -- ear tips and a charging case -- are Plus eligible,
 * well rated and cheap. Four sponsored placements a page, and a sponsored
 * carousel of the store's own brand, show pairs that fit every criterion and
 * are not results. Every page after the first repeats the last result of the
 * page before, so a sweep that keeps everything lists some pairs twice. Four
 * results a page load only on scroll, the Next link on page two leads back to
 * page two, and a sweep faster than a person reads is refused with a 429.
 *
 * No recording of this workflow can pass, and that is deliberate: a recorded
 * extract has no step that drops rows by a rule or removes a repeat, so the
 * script below reads everything its filters let through. The workflow exists
 * because its dataset is the created-Flow lane's judgement of a Flow that can
 * reason about what it reads.
 */
export const PLUS_UNDER_FIFTY_WORKFLOW: ScenarioWorkflow = {
  id: "plus-under-fifty",
  description: "Find every Plus-eligible pair of wireless earbuds rated 4.0 or higher and priced under $50 across every page of results, leaving out sponsored placements and accessories, each once, in the order the results first show them.",
  recordingScript: [
    ...SHARED_STEPS.openStore,
    ...SHARED_STEPS.search("sweep", "wireless earbuds"),
    { id: "sweep-results", operation: "waitForState", target: `[data-component="search-result"][data-sku][data-index="1"]`, timeoutMs: 6000 },
    { id: "sweep-plus-only", operation: "click", target: "role:link:Brightaisle Plus" },
    { id: "sweep-plus-results", operation: "waitForState", target: `[data-component="search-result"][data-sku][data-index="1"]`, timeoutMs: 6000 },
    { id: "sweep-four-stars", operation: "click", target: "role:link:4 Stars & Up" },
    { id: "sweep-rated-results", operation: "waitForState", target: `[data-component="search-result"][data-sku][data-index="1"]`, timeoutMs: 6000 },
    { id: "sweep-max-price", operation: "type", target: `input[name="high"]`, value: "49.99" },
    { id: "sweep-apply-price", operation: "click", target: `form:has(input[name="high"]) input[type="submit"]` },
    { id: "sweep-priced-results", operation: "waitForState", target: `[data-component="search-result"][data-sku][data-index="1"]`, timeoutMs: 6000 },
    { id: "sweep-scroll-down", operation: "scroll", value: 6000 },
    {
      id: "extract-plus-under-fifty",
      operation: "extract",
      target: `[data-component="search-result"][data-sku]:not([data-ad-id])`,
      fields: {
        name: "h2 a span",
        price: `[itemprop="offers"] > a > span > span:first-child`,
        rating: `h2 + div > span > span[aria-hidden="true"]`,
        url: "h2 a@href",
      },
      pagination: { next: `a[aria-label^="Go to next page"]`, maxPages: 5 },
    },
    { id: "sweep-read", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [...SHARED_STEPS.homeFacts],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.extract_list", outcome: "succeeded" },
    ],
    extracted: [{ step: "extract-plus-under-fifty", count: RECORDS.length, records: RECORDS }],
    finalState: [SHARED_STEPS.notChallenged, { id: "nothing-added", subject: "cart-count", predicate: "text", value: "2" }],
    allowedConsoleErrors: [],
  },
};
