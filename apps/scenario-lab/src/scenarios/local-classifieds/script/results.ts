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

/**
 * Scrolls a results feed to its end: through the batch that fails once until
 * Try again, a bare span, is pressed, and on until "Results outside your
 * search" says the real results are over. `firstKey` is the listing that opens
 * the filtered list, so the scroll starts on the narrowed results.
 */
export const scrollWholeFeed = (prefix: string, heading: string, firstKey: string): ScenarioStep[] => [
  { id: `${prefix}-listed`, operation: "waitForState", target: resultLink(firstKey), timeoutMs: 12000 },
  { id: `${prefix}-point-at-results`, operation: "click", target: `role:heading:${heading}` },
  { id: `${prefix}-scroll-for-more`, operation: "scroll", value: 2500 },
  { id: `${prefix}-scroll-for-more-again`, operation: "scroll", value: 2500 },
  { id: `${prefix}-scroll-for-still-more`, operation: "scroll", value: 2500 },
  { id: `${prefix}-load-failed`, operation: "waitForState", target: "text=Try again", timeoutMs: 12000 },
  { id: `${prefix}-try-again`, operation: "click", target: "text=Try again" },
  { id: `${prefix}-scroll-to-end`, operation: "scroll", value: 2500 },
  { id: `${prefix}-scroll-to-end-again`, operation: "scroll", value: 2500 },
  { id: `${prefix}-results-ended`, operation: "waitForState", target: "text=Results outside your search", timeoutMs: 12000 },
];
