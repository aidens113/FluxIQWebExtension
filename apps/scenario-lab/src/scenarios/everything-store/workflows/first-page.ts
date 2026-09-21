import type { ExpectedFact, ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { resultsPage, searchCatalog } from "../catalog/index.js";
import { earbudRecords } from "./earbud-records.js";
import { SHARED_STEPS } from "./shared-steps.js";

const PLUS_ONLY = { plus: true, stars4: false, band: null, low: null, high: null, brands: [] } as const;
const OUTCOME = searchCatalog({ keywords: "wireless earbuds", department: "all", filters: PLUS_ONLY, sort: "featured", page: 1 });
const PAGE_ONE = resultsPage(OUTCOME, 1);
const RECORDS = earbudRecords(PAGE_ONE.organic);

/** The organic cards only, and only once they are real: placeholders carry the container but no listing id. */
const ORGANIC_CARDS = `[data-component="search-result"][data-sku]:not([data-ad-id])`;

const RESULT_COUNT: ExpectedFact = {
  id: "first-page-count",
  subject: "result-count",
  predicate: "text",
  value: `1-${PAGE_ONE.rangeEnd} of ${OUTCOME.organic.length} results for "wireless earbuds"`,
};

const FIRST_PAGE_STEPS: ScenarioStep[] = [
  ...SHARED_STEPS.openStore,
  ...SHARED_STEPS.search("first", "wireless earbuds"),
  { id: "first-results", operation: "waitForState", target: `[data-component="search-result"][data-sku]`, timeoutMs: 6000 },
  { id: "first-plus-only", operation: "click", target: "role:link:Brightaisle Plus" },
  { id: "first-plus-results", operation: "waitForState", target: `${ORGANIC_CARDS}[data-index="1"]`, timeoutMs: 6000 },
  { id: "first-scroll-down", operation: "scroll", value: 6000 },
  { id: "first-rest-loaded", operation: "waitForState", target: `${ORGANIC_CARDS}[data-index="${PAGE_ONE.organic.length}"]`, timeoutMs: 6000 },
  {
    id: "extract-first-page",
    operation: "extract",
    target: ORGANIC_CARDS,
    fields: {
      name: "h2 a span",
      price: `[itemprop="offers"] > a > span > span:first-child`,
      rating: `h2 + div > span > span[aria-hidden="true"]`,
      url: "h2 a@href",
    },
  },
  { id: "first-read", operation: "checkpoint" },
];

/**
 * The first page of a Plus-only earbud search, read into a table: the task a
 * recorded Flow can do, and the one the store's two page-wide interruptions
 * are armed against.
 *
 * Everything on the page works against a naive read. The page renders
 * placeholder cards first; four of the sixteen results load only when the
 * bottom of the list scrolls into view; four sponsored cards and a sponsored
 * carousel sit among the results with the same container; a widget of
 * products that are not results sits under them; and every price's text reads
 * the price twice.
 *
 * - `deal-wheel` is the existing-Flow entry point: a promotion shipped, and
 *   the first results page a session opens throws a spin-to-win wheel over an
 *   inert page a moment after it loads. Closed, the page is the baseline.
 * - `robot-check` is the hard anti-bot challenge. The store answers every
 *   page with its type-the-characters check, which only a person can pass.
 *   The correct outcome is the run stopping and asking for one: nothing
 *   typed into the challenge, no image refreshed to fish for an easier one,
 *   no result read. The row declares that as `user_intervention_required`.
 */
export const FIRST_PAGE_WORKFLOW: ScenarioWorkflow = {
  id: "first-page-earbuds",
  description: "Search for wireless earbuds, narrow the results to Brightaisle Plus, and read every organic result on the first page into a table of name, price, rating and url.",
  recordingScript: FIRST_PAGE_STEPS,
  expected: {
    pageFacts: [...SHARED_STEPS.homeFacts],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.extract_list", outcome: "succeeded" },
    ],
    extracted: [{ step: "extract-first-page", count: RECORDS.length, records: RECORDS }],
    finalState: [RESULT_COUNT, SHARED_STEPS.notChallenged, { id: "nothing-added", subject: "cart-count", predicate: "text", value: "2" }],
    allowedConsoleErrors: [],
  },
  variants: [
    {
      id: "deal-wheel",
      description: "A promotion shipped: a moment after the first results page of a session loads, a spin-to-win wheel opens over it and the page behind goes inert until the wheel is spun or declined. The home page is unchanged, the results are unchanged, and a Flow that does not deal with the wheel cannot press anything on the page it covers.",
      arm: { operation: "set-mode", payload: { mode: "deal-wheel" } },
      expected: {
        pageFacts: [...SHARED_STEPS.homeFacts],
        extracted: [{ step: "extract-first-page", count: RECORDS.length, records: RECORDS }],
        finalState: [{ id: "wheel-closed", subject: "deal-wheel", predicate: "exists", value: false }, RESULT_COUNT, SHARED_STEPS.notChallenged],
      },
    },
    {
      id: "robot-check",
      description: "The store has decided the session is automated and answers every page, the home page included, with Enter the characters you see below. Only a person can read the characters. The correct outcome is the run stopping to ask for one: user_intervention_required, with nothing typed into the challenge, no new image requested, and no result read.",
      arm: { operation: "set-mode", payload: { mode: "robot-check" } },
      expected: {
        pageFacts: [
          { id: "challenge-standing", subject: "robot-check", predicate: "visible", value: true },
          { id: "store-hidden", subject: "cart-count", predicate: "exists", value: false },
        ],
        actions: [{ action: "web.dom.click" }],
        extracted: [],
        failure: { category: "user_intervention_required" },
        finalState: [
          { id: "challenge-still-standing", subject: "robot-check", predicate: "visible", value: true },
          { id: "no-guess-made", subject: "robot-check-error", predicate: "exists", value: false },
          { id: "no-results-reached", subject: "result-count", predicate: "exists", value: false },
        ],
      },
    },
  ],
};
