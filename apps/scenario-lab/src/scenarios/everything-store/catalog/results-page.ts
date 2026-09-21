import type { SearchOutcome } from "./search.js";
import type { AdPlacement, Product } from "./types.js";

/** Results a page lists, the first twelve of which arrive with the page. */
const PER_PAGE = 16;
const EAGER = 12;

/**
 * One page of a search, as the store composes it.
 *
 * Every page after the first opens with the last result of the page before:
 * the store re-ranks between requests and the boundary result is served
 * again, as a real one does. `organic` therefore holds seventeen results on a
 * full later page, and `eager` and `lazy` split them where the page stops
 * rendering and starts loading on scroll. The range the results bar prints is
 * the store's arithmetic, which knows nothing of the repeat.
 */
export type ResultsPage = {
  page: number;
  pageCount: number;
  organic: readonly Product[];
  eager: readonly Product[];
  lazy: readonly Product[];
  top: readonly AdPlacement[];
  mid: AdPlacement | null;
  bottom: AdPlacement | null;
  rangeStart: number;
  rangeEnd: number;
};

/** Four adverts per page, taken in rotation and never the same one twice on a page. */
function adsFor(ads: readonly AdPlacement[], page: number): AdPlacement[] {
  const chosen: AdPlacement[] = [];
  for (let offset = 0; offset < 4 && chosen.length < ads.length; offset += 1) {
    const ad = ads[(4 * (page - 1) + offset) % ads.length];
    if (ad && !chosen.includes(ad)) chosen.push(ad);
  }
  return chosen;
}

export function resultsPage(outcome: SearchOutcome, requestedPage: number): ResultsPage {
  const count = outcome.organic.length;
  const pageCount = Math.max(1, Math.ceil(count / PER_PAGE));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = page === 1 ? 0 : PER_PAGE * (page - 1) - 1;
  const end = Math.min(count, PER_PAGE * page);
  const organic = outcome.organic.slice(start, end);
  const ads = adsFor(outcome.ads, page);
  return {
    page,
    pageCount,
    organic,
    eager: organic.slice(0, EAGER),
    lazy: organic.slice(EAGER),
    top: ads.slice(0, 2),
    mid: ads[2] ?? null,
    bottom: ads[3] ?? null,
    rangeStart: count === 0 ? 0 : PER_PAGE * (page - 1) + 1,
    rangeEnd: end,
  };
}
