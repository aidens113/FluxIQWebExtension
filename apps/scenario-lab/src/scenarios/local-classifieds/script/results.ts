import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { listingByKey } from "../catalog/index.js";
import { listingPath } from "../view/index.js";

/** The results feed, as the page names it to assistive technology. */
export const RESULTS = `section[aria-label="Collection of Marketplace items"]`;

/** A listing's card in the feed, by the address it links to. */
export const resultLink = (key: string): string => `${RESULTS} a[href="${listingPath(listingByKey(key))}"]`;

/** Every listing card of the real results, and none from "Results outside your search", which follows in a grid of its own. */
export const RESULT_CARDS = `${RESULTS} > div:first-child a[href*="/item/"]`;

/** What a person reads off each card in the grid: the title, the current price and not the one struck through, the place, and the link. */
export const CARD_FIELDS = {
  title: "div:nth-of-type(3) > span",
  price: "div:nth-of-type(2) > span:first-child",
  location: "div:nth-of-type(4) > span",
  url: "@href",
};

/** The grid's `n`th card or advert, counting from 1: a batch is six, so the 7th is the first of the second batch. */
const GRID_ENTRY = (n: number): string => `${RESULTS} > div:first-child > :nth-child(${n})`;

/** What the person watches for after a scroll: the next batch's first card or, for the batch that fails, "Try again". */
/** Both alternatives can be on screen at once, and a wait for one element refuses two, so it takes the first. */
const NEXT_BATCH_OR_RETRY = (firstEntry: number): string => `${GRID_ENTRY(firstEntry)}, :text("Try again") >> nth=0`;

/** The same, with "Results outside your search" standing for the end when no further batch is coming. */
const NEXT_BATCH_OR_END = (firstEntry: number): string => `${GRID_ENTRY(firstEntry)}, :text("Results outside your search") >> nth=0`;

/**
 * Scrolls a results feed to its end: through the batch that fails once until
 * Try again, a bare span, is pressed, and on until "Results outside your
 * search" says the real results are over. `firstKey` is the listing that opens
 * the filtered list, so the scroll starts on the narrowed results.
 *
 * A person scrolls, sees grey cards standing in, and scrolls again only once
 * the cards (or the failure) have come: the feed ignores a scroll made while
 * it is still loading, so each scroll here waits for what the last one asked
 * for rather than for a fixed time, which a busy machine outruns.
 */
export const scrollWholeFeed = (prefix: string, heading: string, firstKey: string): ScenarioStep[] => [
  { id: `${prefix}-listed`, operation: "waitForState", target: resultLink(firstKey), timeoutMs: 12000 },
  { id: `${prefix}-point-at-results`, operation: "click", target: `role:heading:${heading}` },
  { id: `${prefix}-scroll-for-more`, operation: "scroll", value: 2500 },
  { id: `${prefix}-second-batch-or-failure`, operation: "waitForState", target: NEXT_BATCH_OR_RETRY(7), timeoutMs: 20000 },
  { id: `${prefix}-scroll-for-more-again`, operation: "scroll", value: 2500 },
  { id: `${prefix}-third-batch-or-failure`, operation: "waitForState", target: NEXT_BATCH_OR_RETRY(13), timeoutMs: 20000 },
  { id: `${prefix}-load-failed`, operation: "waitForState", target: "text=Try again", timeoutMs: 20000 },
  { id: `${prefix}-try-again`, operation: "click", target: "text=Try again" },
  { id: `${prefix}-retried-batch`, operation: "waitForState", target: GRID_ENTRY(7), timeoutMs: 20000 },
  { id: `${prefix}-scroll-to-end`, operation: "scroll", value: 2500 },
  { id: `${prefix}-next-batch-or-end`, operation: "waitForState", target: NEXT_BATCH_OR_END(13), timeoutMs: 20000 },
  { id: `${prefix}-scroll-to-end-again`, operation: "scroll", value: 2500 },
  { id: `${prefix}-last-batch-or-end`, operation: "waitForState", target: NEXT_BATCH_OR_END(19), timeoutMs: 20000 },
  { id: `${prefix}-results-ended`, operation: "waitForState", target: "text=Results outside your search", timeoutMs: 20000 },
];
