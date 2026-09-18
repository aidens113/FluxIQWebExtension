import { createScenarioManifest } from "../../types.js";
import { listingPath } from "./format.js";
import { PROPERTY_COUNT } from "./listings.js";
import { detailRecords, listingRecords } from "./records.js";
import {
  allMatchingProperties, defaultPropertySearch, filterSummaryText,
  PROPERTY_PAGE_SIZE, pageStatusText, resultCountText, searchProperties,
} from "./search.js";
import type { PropertyListing, PropertySearch } from "./types.js";

/** Every results card, the first of them, its link, and a home's own page, addressed as the design presents them rather than by a test hook. */
const RESULT_CARDS = "ol.results > li";
const FIRST_CARD = "ol.results > li:first-child";
const FIRST_CARD_LINK = "ol.results > li:first-child .listing-link";
const LISTING_PAGE = "main.listing";

/**
 * What a person copying this portal into a table would take from each card:
 * the asking price, the address, the bedrooms, the floor area when the agent
 * published one, who is marketing it, and how long it has been on the market.
 * Each is visible text under the design's own class -- no card carries a test
 * hook -- and each is written as a portal writes it, with a currency symbol,
 * thousands separators, a unit, and a date given as an age.
 */
const cardFields = {
  price: ".price",
  address: ".address",
  bedrooms: ".beds",
  floorArea: ".floor-area",
  agent: ".agent-name",
  listed: ".listed-on",
};

/** What a home's own page yields. Tenure, council tax and the EPC rating appear on no card. */
const detailFields = {
  address: ".address",
  price: ".price",
  tenure: ".tenure",
  councilTax: ".council-tax",
  epc: ".epc",
};

/** Kelford runs to six pages, so the bound has room and is still a bound. */
const followNext = { next: "testid:next-page", maxPages: 12 };

const search = (overrides: Partial<PropertySearch>): PropertySearch => ({ ...defaultPropertySearch(), ...overrides });
const OPENING = defaultPropertySearch();
const KELFORD = search({ area: "kelford" });
const KELFORD_THREE_BEDS = search({ area: "kelford", beds: "3" });
const CHEAPEST_FIRST = search({ area: "kelford", beds: "3", sort: "price-asc" });
const NOTHING_MATCHES = search({ beds: "5", band: "up-to-250000" });

const OPENING_PAGE = searchProperties(OPENING);
const KELFORD_MATCHES = allMatchingProperties(KELFORD);
const THREE_BED_MATCHES = allMatchingProperties(KELFORD_THREE_BEDS);
const CHEAPEST = searchProperties(CHEAPEST_FIRST).items.slice(0, 1);
const SWEPT = OPENING_PAGE.items.slice(0, 3);

const pagesFor = (matchCount: number) => Math.max(1, Math.ceil(matchCount / PROPERTY_PAGE_SIZE));
const resultCount = (matchCount: number) => ({ id: "result-count", subject: "result-count", predicate: "text", value: resultCountText(matchCount) });
const pageStatus = (page: number, pageCount: number, reworded = false) => ({ id: "page-status", subject: "page-status", predicate: "text", value: pageStatusText(page, pageCount, reworded) });
const lastPage = (matchCount: number, reworded = false) => pageStatus(pagesFor(matchCount), pagesFor(matchCount), reworded);
const filterSummary = (applied: PropertySearch) => ({ id: "filter-summary", subject: "filter-summary", predicate: "text", value: filterSummaryText(applied) ?? "" });
const nextAbsent = { id: "next-absent", subject: "next-page", predicate: "exists", value: false };
const backOnResults = { id: "back-on-results", subject: "results-list", predicate: "exists", value: true };
const listingOpen = { id: "listing-open", subject: "listing-detail", predicate: "exists", value: true };
const onListingPage = (listing: PropertyListing) => ({ id: "on-listing-page", subject: "document", predicate: "path", value: listingPath(listing) });

const openingCards = listingRecords(OPENING_PAGE.items, "baseline");
const withheldCards = listingRecords(OPENING_PAGE.items, "agent-withheld");
const sweptDetail = detailRecords(SWEPT);

/**
 * One row of the per-row sweep: open home `position + 1` on the opening page,
 * read the facts only its own page carries, and come back before the next one.
 * The steps are generated because the three rows differ in one number, and a
 * hand-written copy of each would be three places for that number to be wrong.
 */
function sweepRow(position: number) {
  const listing = SWEPT[position];
  const detail = sweptDetail[position];
  if (!listing || !detail) throw new Error(`property-listings: the opening page has no home ${position + 1}`);
  const ordinal = position + 1;
  return {
    steps: [
      { id: `open-home-${ordinal}`, operation: "click" as const, target: `ol.results > li:nth-child(${ordinal}) .listing-link` },
      { id: `home-${ordinal}-open`, operation: "waitForState" as const, target: "testid:listing-detail", timeoutMs: 3000 },
      { id: `extract-home-${ordinal}-facts`, operation: "extract" as const, target: LISTING_PAGE, fields: detailFields },
      { id: `leave-home-${ordinal}`, operation: "click" as const, target: "testid:back-to-results" },
      { id: `results-after-home-${ordinal}`, operation: "waitForState" as const, target: "testid:results-list", timeoutMs: 3000 },
    ],
    expected: { step: `extract-home-${ordinal}-facts`, count: 1, records: [detail], optionalFields: ["councilTax"] },
  };
}

const SWEEP = [0, 1, 2].map(sweepRow);

/**
 * A property portal at the size of a real one: 288 homes on the market, ten to
 * a page, four facets and a sort order that apply when Search is pressed, and
 * a page per home carrying three facts no card shows.
 *
 * Six workflows, and every one of them requires a real automation to be built
 * and run. The primary one reads the opening page of results. `area-search`
 * narrows to one neighbourhood and follows pagination to its end.
 * `no-matches` asks the market a question it cannot answer and must return
 * nothing rather than something near. `cheapest-match` sorts and takes the
 * first result. `listing-detail` opens that home and reads the facts only its
 * own page has. `detail-sweep` does the same for each of the first three homes
 * in turn, one page visit per row.
 *
 * Every expected record is built from the authored market with the page's own
 * formatting, so a change to the market has to be reviewed here.
 */
export const propertyListingsManifest = createScenarioManifest({
  id: "property-listings",
  title: "Property listings",
  tags: ["property", "extraction", "pagination", "facets", "detail-page", "scraping"],
  seed: 161,
  startPath: "/scenarios/property-listings/",
  capabilities: ["navigation", "forms", "mutation"],
  playbackGoal: {
    id: "last-page-of-kelford-three-beds",
    description: "Narrow the search to three-bedroom homes in Kelford and show the last page of those results.",
    successFacts: [filterSummary(KELFORD_THREE_BEDS), lastPage(THREE_BED_MATCHES.length), nextAbsent],
  },
  recordingScript: [
    { id: "extract-newest-homes", operation: "extract", target: RESULT_CARDS, fields: cardFields },
    { id: "newest-homes-extracted", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [resultCount(PROPERTY_COUNT), pageStatus(1, OPENING_PAGE.pageCount)],
    actions: [{ action: "web.dom.extract_list" }],
    extracted: [{ step: "extract-newest-homes", count: PROPERTY_PAGE_SIZE, records: openingCards, optionalFields: ["floorArea"] }],
    finalState: [resultCount(PROPERTY_COUNT), pageStatus(1, OPENING_PAGE.pageCount)],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "agent-withheld",
    description: "A seventh of the market has stopped naming its marketing agent, so that line is absent from the card rather than blank and the agent reads as no value at all.",
    arm: { operation: "set-variant", payload: { variant: "agent-withheld" } },
    expected: {
      pageFacts: [resultCount(PROPERTY_COUNT), pageStatus(1, OPENING_PAGE.pageCount)],
      extracted: [{ step: "extract-newest-homes", count: PROPERTY_PAGE_SIZE, records: withheldCards, optionalFields: ["floorArea", "agent"] }],
      finalState: [resultCount(PROPERTY_COUNT), pageStatus(1, OPENING_PAGE.pageCount)],
    },
  }],
  workflows: [
    {
      id: "area-search",
      description: "Narrow the search to Kelford, then collect every home it returns by following the pagination control until it is gone.",
      recordingScript: [
        { id: "choose-area", operation: "select", target: "testid:area-filter", value: "kelford" },
        { id: "run-area-search", operation: "click", target: "testid:search-submit" },
        { id: "area-results-shown", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 3000 },
        { id: "extract-area-homes", operation: "extract", target: RESULT_CARDS, fields: cardFields, pagination: followNext },
        { id: "area-homes-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [resultCount(PROPERTY_COUNT)],
        recordingEvents: [{ type: "web.element.changed" }, { type: "web.element.clicked" }],
        actions: [
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.extract_list" },
        ],
        extracted: [{
          step: "extract-area-homes",
          count: KELFORD_MATCHES.length,
          records: listingRecords(KELFORD_MATCHES, "baseline"),
          pages: pagesFor(KELFORD_MATCHES.length),
          optionalFields: ["floorArea"],
        }],
        finalState: [filterSummary(KELFORD), resultCount(KELFORD_MATCHES.length), lastPage(KELFORD_MATCHES.length), nextAbsent],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "renamed-pagination",
        description: "The control that reaches the next page is a link reading \"More homes\" over a reworded counter. It stands where it stood and does what it did, so the same homes must still be collected over the same pages.",
        arm: { operation: "set-variant", payload: { variant: "renamed-pagination" } },
        expected: {
          pageFacts: [resultCount(PROPERTY_COUNT), pageStatus(1, OPENING_PAGE.pageCount, true)],
          finalState: [filterSummary(KELFORD), resultCount(KELFORD_MATCHES.length), lastPage(KELFORD_MATCHES.length, true), nextAbsent],
        },
      }],
    },
    {
      id: "no-matches",
      description: "Ask for five-bedroom homes up to 250,000, which this market does not have, and report that nothing matched rather than something near it.",
      recordingScript: [
        { id: "choose-five-bedrooms", operation: "select", target: "testid:beds-filter", value: "5" },
        { id: "choose-lowest-band", operation: "select", target: "testid:band-filter", value: "up-to-250000" },
        { id: "run-impossible-search", operation: "click", target: "testid:search-submit" },
        { id: "no-homes-shown", operation: "waitForState", target: "testid:empty-results", timeoutMs: 3000 },
        // The right answer here is an empty table, which an extract step refuses unless it declares minItems: 0 (D4).
        { id: "extract-no-matches", operation: "extract", target: RESULT_CARDS, fields: cardFields, minItems: 0 },
        { id: "no-matches-extracted", operation: "checkpoint" },
      ],
      expected: {
        actions: [{ action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
        extracted: [{ step: "extract-no-matches", count: 0, records: [] }],
        finalState: [
          filterSummary(NOTHING_MATCHES),
          resultCount(0),
          { id: "no-homes", subject: "empty-results", predicate: "contains", value: "No homes match this search." },
        ],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "cheapest-match",
      description: "Narrow the search to three-bedroom homes in Kelford, order it by price from the lowest, and record only the cheapest one.",
      recordingScript: [
        { id: "choose-cheapest-area", operation: "select", target: "testid:area-filter", value: "kelford" },
        { id: "choose-three-bedrooms", operation: "select", target: "testid:beds-filter", value: "3" },
        { id: "sort-by-lowest-price", operation: "select", target: "testid:sort-order", value: "price-asc" },
        { id: "run-cheapest-search", operation: "click", target: "testid:search-submit" },
        { id: "cheapest-results-shown", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 3000 },
        { id: "extract-cheapest-home", operation: "extract", target: FIRST_CARD, fields: cardFields },
        { id: "cheapest-home-extracted", operation: "checkpoint" },
      ],
      expected: {
        actions: [{ action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
        extracted: [{ step: "extract-cheapest-home", count: 1, records: listingRecords(CHEAPEST, "baseline"), optionalFields: ["floorArea"] }],
        finalState: [filterSummary(CHEAPEST_FIRST), resultCount(THREE_BED_MATCHES.length), pageStatus(1, pagesFor(THREE_BED_MATCHES.length))],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "listing-detail",
      description: "Find the cheapest three-bedroom home in Kelford, open it, and read the tenure, the council tax band and the EPC rating, none of which any card shows.",
      recordingScript: [
        { id: "choose-detail-area", operation: "select", target: "testid:area-filter", value: "kelford" },
        { id: "choose-detail-bedrooms", operation: "select", target: "testid:beds-filter", value: "3" },
        { id: "sort-detail-by-price", operation: "select", target: "testid:sort-order", value: "price-asc" },
        { id: "run-detail-search", operation: "click", target: "testid:search-submit" },
        { id: "detail-results-shown", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 3000 },
        { id: "open-cheapest-home", operation: "click", target: FIRST_CARD_LINK },
        { id: "home-page-open", operation: "waitForState", target: "testid:listing-detail", timeoutMs: 3000 },
        { id: "extract-home-facts", operation: "extract", target: LISTING_PAGE, fields: detailFields },
        { id: "home-facts-extracted", operation: "checkpoint" },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.changed" }, { type: "web.element.clicked" }],
        actions: [{ action: "web.dom.select", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
        extracted: [{ step: "extract-home-facts", count: 1, records: detailRecords(CHEAPEST), optionalFields: ["councilTax"] }],
        finalState: [onListingPage(cheapestHome()), listingOpen],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "redesigned-search",
        description: "The search panel was redesigned and the Search button is gone; a button reading \"Show homes\" stands where it stood and runs the same search. The recorded press has nothing to land on until it is re-pointed at the new name.",
        arm: { operation: "set-variant", payload: { variant: "redesigned-search" } },
        expected: {
          pageFacts: [
            { id: "search-button-gone", subject: "search-submit", predicate: "exists", value: false },
            { id: "show-homes-button", subject: "apply-filters", predicate: "text", value: "Show homes" },
          ],
          finalState: [onListingPage(cheapestHome()), listingOpen],
        },
      }],
    },
    {
      id: "detail-sweep",
      description: "For each of the first three homes on the opening page, open its own page, read the facts only that page carries, and return to the results before the next one.",
      recordingScript: [
        ...SWEEP.flatMap(({ steps }) => steps),
        { id: "detail-sweep-done", operation: "checkpoint" },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.clicked" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list" }],
        extracted: SWEEP.map(({ expected }) => expected),
        finalState: [backOnResults, resultCount(PROPERTY_COUNT)],
        allowedConsoleErrors: [],
      },
    },
  ],
});

/** The home the cheapest-first search puts first; a market with none would be a defect in the authored data, not a run. */
function cheapestHome(): PropertyListing {
  const listing = CHEAPEST[0];
  if (!listing) throw new Error("property-listings: no three-bedroom home in Kelford to open");
  return listing;
}
